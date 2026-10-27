import { daysBetween, lineAmountFcfa } from "@G-stock/core/sales";
import { planFifo, roundQty } from "@G-stock/core/stock";
import type { FifoLot } from "@G-stock/core/stock";
import type { Executor } from "@G-stock/db";
import { user } from "@G-stock/db/schema/auth";
import { products } from "@G-stock/db/schema/catalog";
import {
  customers,
  payments,
  saleDiscounts,
  saleItemLots,
  saleItems,
  sales,
} from "@G-stock/db/schema/sales";
import { stockLots } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, exists, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type {
  PaymentInput,
  ProductSalesFilters,
  SaleDiscountInput,
  SaleFilters,
  SaleInput,
} from "../schemas/sales";
import { loadLedgers, saleDiscountSql } from "./customers";
import { nextReference } from "./references";
import { getSettings } from "./settings";
import { consumeFifo, listAvailableLots, returnToLots } from "./stock";

const REFERENCE_PREFIX = "V";
const REFERENCE_DIGITS = 5;

const saleCostSql = sql<number>`coalesce((select sum(${saleItems.costFcfa}) from ${saleItems} where ${saleItems.saleId} = ${sales.id}), 0)`;

const getCustomerRow = async (executor: Executor, id: string) => {
  const [customer] = await executor.select().from(customers).where(eq(customers.id, id));
  if (!customer) {
    throw new ORPCError("NOT_FOUND", { message: "Client introuvable" });
  }
  return customer;
};

const getSaleRow = async (executor: Executor, id: string) => {
  const [sale] = await executor.select().from(sales).where(eq(sales.id, id));
  if (!sale) {
    throw new ORPCError("NOT_FOUND", { message: "Vente introuvable" });
  }
  return sale;
};

const assertSaleActive = (sale: typeof sales.$inferSelect): void => {
  if (sale.status === "cancelled") {
    throw new ORPCError("BAD_REQUEST", {
      message: `La vente ${sale.reference} est annulée`,
    });
  }
};

const loadProducts = async (executor: Executor, productIds: readonly string[]) => {
  const ids = [...new Set(productIds)];
  const rows =
    ids.length > 0 ? await executor.select().from(products).where(inArray(products.id, ids)) : [];
  if (rows.length !== ids.length) {
    throw new ORPCError("NOT_FOUND", {
      message: "Un des produits est introuvable",
    });
  }
  return new Map(rows.map((row) => [row.id, row]));
};

/**
 * Aperçu d'une vente : coût FIFO de chaque ligne et quantité manquante, sans rien écrire.
 * Les lignes d'un même produit se servent dans les lots l'une après l'autre.
 */
export const quoteSale = async (
  executor: Executor,
  lines: readonly { productId: string; qty: number }[],
) => {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const lotsByProduct = new Map<string, FifoLot[]>(
    await Promise.all(
      productIds.map(
        async (productId) => [productId, await listAvailableLots(executor, productId)] as const,
      ),
    ),
  );
  return lines.map((line) => {
    const lots = lotsByProduct.get(line.productId) ?? [];
    const availableQty = roundQty(lots.reduce((sum, lot) => sum + lot.qtyRemaining, 0));
    const plan = planFifo(lots, line.qty);
    const left = new Map(
      plan.allocations.map((allocation) => [allocation.lotId, allocation.qtyLeft]),
    );
    lotsByProduct.set(
      line.productId,
      lots.map((lot) => ({
        ...lot,
        qtyRemaining: left.get(lot.id) ?? lot.qtyRemaining,
      })),
    );
    return {
      availableQty,
      costFcfa: plan.costFcfa,
      missingQty: plan.missingQty,
      productId: line.productId,
      qty: line.qty,
    };
  });
};

/**
 * Enregistre une vente : sortie de stock FIFO ligne par ligne (coût figé), puis encaissement
 * du total (comptant) ou de l'acompte (crédit). À appeler dans une transaction : tout ou rien.
 */
export const createSale = async (executor: Executor, input: SaleInput, userId?: string | null) => {
  await getCustomerRow(executor, input.customerId);
  const productsById = await loadProducts(
    executor,
    input.lines.map((line) => line.productId),
  );
  const archived = [...productsById.values()].find((product) => product.archivedAt);
  if (archived) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Le produit « ${archived.name} » est archivé`,
    });
  }

  const totalFcfa = input.lines.reduce(
    (sum, line) => sum + lineAmountFcfa(line.qty, line.unitPriceFcfa),
    0,
  );
  const paidFcfa = input.paymentType === "cash" ? totalFcfa : input.paidFcfa;
  if (paidFcfa > totalFcfa) {
    throw new ORPCError("BAD_REQUEST", {
      message: "L'acompte dépasse le total de la vente",
    });
  }

  const reference = await nextReference(
    executor,
    REFERENCE_PREFIX,
    input.saleDate,
    REFERENCE_DIGITS,
  );
  const [sale] = await executor
    .insert(sales)
    .values({
      createdBy: userId ?? null,
      customerId: input.customerId,
      notes: input.notes,
      paymentType: input.paymentType,
      reference,
      saleDate: input.saleDate,
      totalFcfa,
    })
    .returning();
  if (!sale) {
    throw new Error("L'insertion de la vente n'a renvoyé aucune ligne");
  }

  for (const line of input.lines) {
    const product = productsById.get(line.productId);
    let allocations;
    try {
      // Séquentiel : deux lignes du même produit se servent l'une après l'autre dans les lots.
      // oxlint-disable-next-line no-await-in-loop
      allocations = await consumeFifo(executor, {
        productId: line.productId,
        qty: line.qty,
        reason: `Vente ${reference}`,
        referenceId: sale.id,
        referenceType: "sale",
        userId,
      });
    } catch (error) {
      if (error instanceof ORPCError) {
        throw new ORPCError("BAD_REQUEST", {
          message: `${product?.name} — ${error.message}`,
        });
      }
      throw error;
    }
    const costFcfa = Math.round(
      allocations.reduce((sum, allocation) => sum + allocation.qty * allocation.unitCostFcfa, 0),
    );
    // oxlint-disable-next-line no-await-in-loop
    const [item] = await executor
      .insert(saleItems)
      .values({
        costFcfa,
        productId: line.productId,
        qty: line.qty,
        saleId: sale.id,
        unitPriceFcfa: line.unitPriceFcfa,
      })
      .returning();
    if (!item) {
      throw new Error("L'insertion de la ligne de vente n'a renvoyé aucune ligne");
    }
    // oxlint-disable-next-line no-await-in-loop
    await executor.insert(saleItemLots).values(
      allocations.map((allocation) => ({
        lotId: allocation.lotId,
        qty: allocation.qty,
        saleItemId: item.id,
        unitCostFcfa: allocation.unitCostFcfa,
      })),
    );
  }

  if (paidFcfa > 0) {
    await executor.insert(payments).values({
      amountFcfa: paidFcfa,
      createdBy: userId ?? null,
      customerId: input.customerId,
      method: input.paymentMethod,
      paymentDate: input.saleDate,
      saleId: sale.id,
    });
  }
  return sale;
};

const userNames = async (executor: Executor, ids: readonly (string | null)[]) => {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) {
    return new Map<string, string>();
  }
  const rows = await executor
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
};

export const getSale = async (executor: Executor, id: string) => {
  const sale = await getSaleRow(executor, id);
  const [customer, items, discounts, salePayments, ledgers] = await Promise.all([
    getCustomerRow(executor, sale.customerId),
    executor
      .select({
        costFcfa: saleItems.costFcfa,
        id: saleItems.id,
        productId: saleItems.productId,
        productName: products.name,
        productUnit: products.unit,
        qty: saleItems.qty,
        unitPriceFcfa: saleItems.unitPriceFcfa,
      })
      .from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleItems.saleId, id))
      .orderBy(asc(saleItems.id)),
    executor
      .select()
      .from(saleDiscounts)
      .where(eq(saleDiscounts.saleId, id))
      .orderBy(asc(saleDiscounts.discountDate), asc(saleDiscounts.id)),
    executor
      .select()
      .from(payments)
      .where(eq(payments.saleId, id))
      .orderBy(asc(payments.paymentDate), asc(payments.id)),
    loadLedgers(executor, sale.customerId),
  ]);

  const lots =
    items.length > 0
      ? await executor
          .select({
            lotCode: stockLots.lotCode,
            lotId: saleItemLots.lotId,
            qty: saleItemLots.qty,
            saleItemId: saleItemLots.saleItemId,
            unitCostFcfa: saleItemLots.unitCostFcfa,
          })
          .from(saleItemLots)
          .innerJoin(stockLots, eq(stockLots.id, saleItemLots.lotId))
          .where(
            inArray(
              saleItemLots.saleItemId,
              items.map((item) => item.id),
            ),
          )
          .orderBy(asc(saleItemLots.id))
      : [];
  const lotsByItem = Map.groupBy(lots, (lot) => lot.saleItemId);
  const names = await userNames(executor, [
    sale.createdBy,
    sale.cancelledBy,
    ...discounts.map((discount) => discount.createdBy),
    ...salePayments.map((payment) => payment.createdBy),
  ]);
  const nameOf = (userId: string | null) => (userId ? (names.get(userId) ?? null) : null);

  const discountFcfa = discounts.reduce((sum, discount) => sum + discount.amountFcfa, 0);
  const costFcfa = items.reduce((sum, item) => sum + item.costFcfa, 0);
  const netFcfa = sale.totalFcfa - discountFcfa;
  const settlement = ledgers.get(sale.customerId)?.sales.get(sale.id);

  return {
    ...sale,
    cancelledByName: nameOf(sale.cancelledBy),
    createdByName: nameOf(sale.createdBy),
    customer,
    discounts: discounts.map((discount) => ({
      ...discount,
      createdByName: nameOf(discount.createdBy),
    })),
    items: items.map((item) => {
      const amountFcfa = lineAmountFcfa(item.qty, item.unitPriceFcfa);
      return {
        ...item,
        amountFcfa,
        lots: lotsByItem.get(item.id) ?? [],
        marginFcfa: amountFcfa - item.costFcfa,
      };
    }),
    payments: salePayments.map((payment) => ({
      ...payment,
      createdByName: nameOf(payment.createdBy),
    })),
    summary: {
      costFcfa,
      discountFcfa,
      dueFcfa: settlement?.dueFcfa ?? 0,
      marginFcfa: sale.status === "active" ? netFcfa - costFcfa : 0,
      netFcfa,
      paidFcfa: settlement?.paidFcfa ?? 0,
      totalFcfa: sale.totalFcfa,
    },
  };
};

const containsInsensitive = (column: AnyColumn, needle: string): SQL =>
  sql`instr(lower(coalesce(${column}, '')), lower(${needle})) > 0`;

const saleConditions = (filters: {
  customerId?: string | null;
  from?: Date | null;
  to?: Date | null;
}): SQL[] => {
  const conditions: SQL[] = [];
  if (filters.customerId) {
    conditions.push(eq(sales.customerId, filters.customerId));
  }
  if (filters.from) {
    conditions.push(gte(sales.saleDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(sales.saleDate, filters.to));
  }
  return conditions;
};

/** Historique filtrable des ventes, avec les totaux de la sélection (hors ventes annulées). */
export const listSales = async (executor: Executor, filters: SaleFilters) => {
  const conditions = saleConditions(filters);
  if (filters.status) {
    conditions.push(eq(sales.status, filters.status));
  }
  if (filters.productId) {
    conditions.push(
      exists(
        executor
          .select({ one: sql`1` })
          .from(saleItems)
          .where(and(eq(saleItems.saleId, sales.id), eq(saleItems.productId, filters.productId))),
      ),
    );
  }
  if (filters.search) {
    conditions.push(
      or(
        containsInsensitive(sales.reference, filters.search),
        containsInsensitive(customers.name, filters.search),
      ) as SQL,
    );
  }

  const [rows, ledgers] = await Promise.all([
    executor
      .select({
        costFcfa: saleCostSql,
        customerId: sales.customerId,
        customerName: customers.name,
        discountFcfa: saleDiscountSql,
        id: sales.id,
        paymentType: sales.paymentType,
        reference: sales.reference,
        saleDate: sales.saleDate,
        status: sales.status,
        totalFcfa: sales.totalFcfa,
      })
      .from(sales)
      .innerJoin(customers, eq(customers.id, sales.customerId))
      .where(and(...conditions))
      .orderBy(desc(sales.saleDate), desc(sales.id)),
    loadLedgers(executor, filters.customerId),
  ]);

  const enriched = rows.map((row) => {
    const active = row.status === "active";
    const netFcfa = row.totalFcfa - row.discountFcfa;
    const settlement = active ? ledgers.get(row.customerId)?.sales.get(row.id) : undefined;
    return {
      ...row,
      dueFcfa: settlement?.dueFcfa ?? 0,
      marginFcfa: active ? netFcfa - row.costFcfa : 0,
      netFcfa,
      paidFcfa: settlement?.paidFcfa ?? 0,
    };
  });
  const filtered = filters.paymentState
    ? enriched.filter((sale) =>
        filters.paymentState === "due"
          ? sale.dueFcfa > 0
          : sale.status === "active" && sale.dueFcfa === 0,
      )
    : enriched;

  const totals = {
    costFcfa: 0,
    count: filtered.length,
    dueFcfa: 0,
    marginFcfa: 0,
    netFcfa: 0,
  };
  for (const sale of filtered) {
    if (sale.status === "active") {
      totals.netFcfa += sale.netFcfa;
      totals.costFcfa += sale.costFcfa;
      totals.marginFcfa += sale.marginFcfa;
      totals.dueFcfa += sale.dueFcfa;
    }
  }

  const start = (filters.page - 1) * filters.pageSize;
  const page = filtered.slice(start, start + filters.pageSize);
  const lines =
    page.length > 0
      ? await executor
          .select({
            productName: products.name,
            productUnit: products.unit,
            qty: saleItems.qty,
            saleId: saleItems.saleId,
          })
          .from(saleItems)
          .innerJoin(products, eq(products.id, saleItems.productId))
          .where(
            inArray(
              saleItems.saleId,
              page.map((sale) => sale.id),
            ),
          )
          .orderBy(asc(saleItems.id))
      : [];
  const linesBySale = Map.groupBy(lines, (line) => line.saleId);

  return {
    items: page.map((sale) => ({
      ...sale,
      lines: linesBySale.get(sale.id) ?? [],
    })),
    total: filtered.length,
    totals,
  };
};

/** Ce qui a été vendu, produit par produit (ventes validées, montants avant remises). */
export const productSalesSummary = async (executor: Executor, filters: ProductSalesFilters) => {
  const conditions = [eq(sales.status, "active"), ...saleConditions(filters)];
  const rows = await executor
    .select({
      costFcfa: sql<number>`sum(${saleItems.costFcfa})`,
      lastSaleDate: sql<number>`max(${sales.saleDate})`,
      productId: products.id,
      productName: products.name,
      productUnit: products.unit,
      qty: sql<number>`sum(${saleItems.qty})`,
      revenueFcfa: sql<number>`sum(round(${saleItems.qty} * ${saleItems.unitPriceFcfa}))`,
      saleCount: sql<number>`count(distinct ${sales.id})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(and(...conditions))
    .groupBy(products.id)
    .orderBy(desc(sql`sum(round(${saleItems.qty} * ${saleItems.unitPriceFcfa}))`));

  return rows.map((row) => ({
    ...row,
    averagePriceFcfa: row.qty > 0 ? Math.round(row.revenueFcfa / row.qty) : 0,
    lastSaleDate: new Date(row.lastSaleDate),
    marginFcfa: row.revenueFcfa - row.costFcfa,
    qty: roundQty(row.qty),
  }));
};

/**
 * Annule une vente : le stock revient dans les lots d'où il était sorti, les paiements de la
 * vente sont annulés, et la vente reste dans l'historique avec son motif.
 */
export const cancelSale = async (
  executor: Executor,
  params: { id: string; reason: string },
  userId?: string | null,
) => {
  const sale = await getSaleRow(executor, params.id);
  assertSaleActive(sale);
  const items = await executor.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
  const lots =
    items.length > 0
      ? await executor
          .select()
          .from(saleItemLots)
          .where(
            inArray(
              saleItemLots.saleItemId,
              items.map((item) => item.id),
            ),
          )
      : [];
  const lotsByItem = Map.groupBy(lots, (lot) => lot.saleItemId);

  for (const item of items) {
    // oxlint-disable-next-line no-await-in-loop
    await returnToLots(executor, {
      allocations: lotsByItem.get(item.id) ?? [],
      productId: item.productId,
      reason: `Annulation ${sale.reference} : ${params.reason}`,
      referenceId: sale.id,
      referenceType: "sale",
      userId,
    });
  }

  const now = new Date();
  const cancelledPayments = await executor
    .update(payments)
    .set({
      cancelReason: `Vente ${sale.reference} annulée : ${params.reason}`,
      cancelledAt: now,
    })
    .where(and(eq(payments.saleId, sale.id), isNull(payments.cancelledAt)))
    .returning({ amountFcfa: payments.amountFcfa });
  await executor
    .update(sales)
    .set({
      cancelReason: params.reason,
      cancelledAt: now,
      cancelledBy: userId ?? null,
      status: "cancelled",
    })
    .where(eq(sales.id, sale.id));

  return {
    cancelledPaymentsFcfa: cancelledPayments.reduce((sum, payment) => sum + payment.amountFcfa, 0),
    id: sale.id,
  };
};

/** Remise accordée après la vente : elle réduit le montant net, motif obligatoire. */
export const addSaleDiscount = async (
  executor: Executor,
  input: SaleDiscountInput,
  userId?: string | null,
) => {
  const sale = await getSaleRow(executor, input.saleId);
  assertSaleActive(sale);
  const [row] = await executor
    .select({
      total: sql<number>`coalesce(sum(${saleDiscounts.amountFcfa}), 0)`,
    })
    .from(saleDiscounts)
    .where(eq(saleDiscounts.saleId, sale.id));
  const netFcfa = sale.totalFcfa - (row?.total ?? 0);
  if (input.amountFcfa > netFcfa) {
    throw new ORPCError("BAD_REQUEST", {
      message: `La remise dépasse le montant net de la vente (${netFcfa} FCFA)`,
    });
  }
  const [discount] = await executor
    .insert(saleDiscounts)
    .values({ ...input, createdBy: userId ?? null })
    .returning();
  return discount;
};

export const createPayment = async (
  executor: Executor,
  input: PaymentInput,
  userId?: string | null,
) => {
  await getCustomerRow(executor, input.customerId);
  if (input.saleId) {
    const sale = await getSaleRow(executor, input.saleId);
    assertSaleActive(sale);
    if (sale.customerId !== input.customerId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cette vente appartient à un autre client",
      });
    }
  }
  const [payment] = await executor
    .insert(payments)
    .values({
      ...input,
      createdBy: userId ?? null,
      saleId: input.saleId ?? null,
    })
    .returning();
  return payment;
};

export const cancelPayment = async (executor: Executor, params: { id: string; reason: string }) => {
  const [payment] = await executor.select().from(payments).where(eq(payments.id, params.id));
  if (!payment) {
    throw new ORPCError("NOT_FOUND", { message: "Paiement introuvable" });
  }
  if (payment.cancelledAt) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Ce paiement est déjà annulé",
    });
  }
  const [updated] = await executor
    .update(payments)
    .set({ cancelReason: params.reason, cancelledAt: new Date() })
    .where(eq(payments.id, payment.id))
    .returning();
  return updated;
};

export const listPayments = async (executor: Executor, customerId: string) => {
  const rows = await executor
    .select({ payment: payments, saleReference: sales.reference })
    .from(payments)
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(eq(payments.customerId, customerId))
    .orderBy(desc(payments.paymentDate), desc(payments.id));
  const names = await userNames(
    executor,
    rows.map(({ payment }) => payment.createdBy),
  );
  return rows.map(({ payment, saleReference }) => ({
    ...payment,
    createdByName: payment.createdBy ? (names.get(payment.createdBy) ?? null) : null,
    saleReference,
  }));
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Chiffres du tableau de bord : CA (net de remises) du jour, de la semaine, du mois, et créances. */
export const salesSummary = async (executor: Executor, now = new Date()) => {
  const today = startOfDay(now);
  // Semaine du lundi au dimanche.
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = weekStart < monthStart ? weekStart : monthStart;

  const [rows, ledgers, thresholds, topProducts] = await Promise.all([
    executor
      .select({
        costFcfa: saleCostSql,
        discountFcfa: saleDiscountSql,
        saleDate: sales.saleDate,
        totalFcfa: sales.totalFcfa,
      })
      .from(sales)
      .where(and(eq(sales.status, "active"), gte(sales.saleDate, since))),
    loadLedgers(executor),
    getSettings(executor),
    productSalesSummary(executor, { from: monthStart }),
  ]);

  const revenue = { day: 0, month: 0, week: 0 };
  let monthMarginFcfa = 0;
  let monthSaleCount = 0;
  for (const row of rows) {
    const netFcfa = row.totalFcfa - row.discountFcfa;
    if (row.saleDate >= today) {
      revenue.day += netFcfa;
    }
    if (row.saleDate >= weekStart) {
      revenue.week += netFcfa;
    }
    if (row.saleDate >= monthStart) {
      revenue.month += netFcfa;
      monthMarginFcfa += netFcfa - row.costFcfa;
      monthSaleCount += 1;
    }
  }

  let receivablesFcfa = 0;
  let debtorCount = 0;
  let criticalDebtorCount = 0;
  for (const ledger of ledgers.values()) {
    if (ledger.totalDueFcfa <= 0) {
      continue;
    }
    receivablesFcfa += ledger.totalDueFcfa;
    debtorCount += 1;
    const days = ledger.oldestUnpaidDate ? daysBetween(ledger.oldestUnpaidDate, now) : 0;
    if (days >= thresholds.receivableCriticalDays) {
      criticalDebtorCount += 1;
    }
  }

  return {
    criticalDebtorCount,
    debtorCount,
    monthMarginFcfa,
    monthSaleCount,
    receivablesFcfa,
    revenue,
    topProducts: topProducts.slice(0, 5),
  };
};
