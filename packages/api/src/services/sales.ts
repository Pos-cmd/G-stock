import type { PaymentMethod } from "@G-stock/core/enums";
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import {
  allocatePaymentCoverage,
  daysBetween,
  lineAmountFcfa,
} from "@G-stock/core/sales";
import type { PaymentCoverage } from "@G-stock/core/sales";
import { planFifo, QTY_EPSILON, roundQty } from "@G-stock/core/stock";
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
  saleReturns,
  saleReturnItems,
  saleRevisions,
  sales,
} from "@G-stock/db/schema/sales";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type {
  PaymentInput,
  PaymentUpdateInput,
  ProductSalesFilters,
  SaleDiscountInput,
  SaleFilters,
  SaleInput,
  SaleReturnInput,
  SaleUpdateInput,
} from "../schemas/sales";
import { invalidateLedgers, loadLedgers, saleDiscountSql } from "./customers";
import { nextReference } from "./references";
import { getSettings } from "./settings";
import { consumeFifo, listAvailableLots, returnToLots } from "./stock";

const REFERENCE_PREFIX = "V";
const REFERENCE_DIGITS = 5;

const saleCostSql = sql<number>`coalesce((select sum(${saleItems.costFcfa}) from ${saleItems} where ${saleItems.saleId} = ${sales.id}), 0)`;

const getCustomerRow = async (executor: Executor, id: string) => {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(eq(customers.id, id));
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

const loadProducts = async (
  executor: Executor,
  productIds: readonly string[]
) => {
  const ids = [...new Set(productIds)];
  const rows =
    ids.length > 0
      ? await executor.select().from(products).where(inArray(products.id, ids))
      : [];
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
  lines: readonly { productId: string; qty: number }[]
) => {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const lotsByProduct = new Map<string, FifoLot[]>(
    await Promise.all(
      productIds.map(
        async (productId) =>
          [productId, await listAvailableLots(executor, productId)] as const
      )
    )
  );
  return lines.map((line) => {
    const lots = lotsByProduct.get(line.productId) ?? [];
    const availableQty = roundQty(
      lots.reduce((sum, lot) => sum + lot.qtyRemaining, 0)
    );
    const plan = planFifo(lots, line.qty);
    const left = new Map(
      plan.allocations.map((allocation) => [
        allocation.lotId,
        allocation.qtyLeft,
      ])
    );
    lotsByProduct.set(
      line.productId,
      lots.map((lot) => ({
        ...lot,
        qtyRemaining: left.get(lot.id) ?? lot.qtyRemaining,
      }))
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
export const createSale = async (
  executor: Executor,
  input: SaleInput,
  userId?: string | null
) => {
  await getCustomerRow(executor, input.customerId);
  const productsById = await loadProducts(
    executor,
    input.lines.map((line) => line.productId)
  );
  const archived = [...productsById.values()].find(
    (product) => product.archivedAt
  );
  if (archived) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Le produit « ${archived.name} » est archivé`,
    });
  }

  const totalFcfa = input.lines.reduce(
    (sum, line) => sum + lineAmountFcfa(line.qty, line.unitPriceFcfa),
    0
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
    REFERENCE_DIGITS
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
        // Date de la vente, pas celle de la saisie : l'historique du stock suit le jour réel.
        occurredAt: input.saleDate,
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
      allocations.reduce(
        (sum, allocation) => sum + allocation.qty * allocation.unitCostFcfa,
        0
      )
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
      throw new Error(
        "L'insertion de la ligne de vente n'a renvoyé aucune ligne"
      );
    }
    // oxlint-disable-next-line no-await-in-loop
    await executor.insert(saleItemLots).values(
      allocations.map((allocation) => ({
        lotId: allocation.lotId,
        qty: allocation.qty,
        saleItemId: item.id,
        unitCostFcfa: allocation.unitCostFcfa,
      }))
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

const allocationsOf = (executor: Executor, saleItemId: string) =>
  executor
    .select()
    .from(saleItemLots)
    .where(eq(saleItemLots.saleItemId, saleItemId))
    .orderBy(asc(saleItemLots.id));

/** Coût de revient d'une ligne : somme des lots encore prélevés pour elle. */
const refreshItemCost = async (executor: Executor, saleItemId: string) => {
  const allocations = await allocationsOf(executor, saleItemId);
  const costFcfa = Math.round(
    allocations.reduce(
      (sum, allocation) => sum + allocation.qty * allocation.unitCostFcfa,
      0
    )
  );
  await executor
    .update(saleItems)
    .set({ costFcfa })
    .where(eq(saleItems.id, saleItemId));
  return costFcfa;
};

interface ShrinkParams {
  occurredAt: Date;
  productId: string;
  qty: number;
  reason: string;
  referenceId: string;
  /** Faux quand la marchandise ne retourne pas en stock (casse) : elle est seulement retirée. */
  restock: boolean;
  userId?: string | null;
}

/**
 * Retire une quantité d'une ligne de vente. La marchandise revient dans les lots d'où elle était
 * sortie, en commençant par les derniers prélevés : le stock des lots anciens reste tel qu'il était.
 */
const shrinkSaleItem = async (
  executor: Executor,
  saleItemId: string,
  params: ShrinkParams
) => {
  const allocations = await allocationsOf(executor, saleItemId);
  if (allocations.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cette ligne de vente n'a aucun lot prélevé",
    });
  }
  const returned: { lotId: string; qty: number; unitCostFcfa: number }[] = [];
  const updated: { id: string; qty: number }[] = [];
  let remaining = roundQty(params.qty);
  for (
    let index = allocations.length - 1;
    index >= 0 && remaining > QTY_EPSILON;
    index -= 1
  ) {
    const allocation = allocations[index];
    if (!allocation) {
      continue;
    }
    const taken = Math.min(allocation.qty, remaining);
    remaining = roundQty(remaining - taken);
    returned.push({
      lotId: allocation.lotId,
      qty: taken,
      unitCostFcfa: allocation.unitCostFcfa,
    });
    updated.push({ id: allocation.id, qty: roundQty(allocation.qty - taken) });
  }
  if (remaining > QTY_EPSILON) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Le détail des lots ne couvre pas la quantité retirée : la vente est incohérente",
    });
  }
  if (params.restock) {
    await returnToLots(executor, {
      allocations: returned,
      occurredAt: params.occurredAt,
      productId: params.productId,
      reason: params.reason,
      referenceId: params.referenceId,
      referenceType: "sale",
      userId: params.userId,
    });
  }
  for (const row of updated) {
    // oxlint-disable-next-line no-await-in-loop
    await (row.qty > QTY_EPSILON
      ? executor
          .update(saleItemLots)
          .set({ qty: row.qty })
          .where(eq(saleItemLots.id, row.id))
      : executor.delete(saleItemLots).where(eq(saleItemLots.id, row.id)));
  }
  return refreshItemCost(executor, saleItemId);
};

/** Ajoute une quantité sur une ligne existante : les lots les plus anciens (FIFO) sont repris. */
const growSaleItem = async (
  executor: Executor,
  saleItemId: string,
  params: {
    occurredAt: Date;
    productId: string;
    qty: number;
    reference: string;
    saleId: string;
    userId?: string | null;
  }
) => {
  const allocations = await consumeFifo(executor, {
    occurredAt: params.occurredAt,
    productId: params.productId,
    qty: params.qty,
    reason: `Modification vente ${params.reference}`,
    referenceId: params.saleId,
    referenceType: "sale",
    userId: params.userId,
  });
  await executor.insert(saleItemLots).values(
    allocations.map((allocation) => ({
      lotId: allocation.lotId,
      qty: allocation.qty,
      saleItemId,
      unitCostFcfa: allocation.unitCostFcfa,
    }))
  );
  return refreshItemCost(executor, saleItemId);
};

/** Crée une ligne de vente et prélève son stock (FIFO). */
const insertSaleItem = async (
  executor: Executor,
  params: {
    occurredAt: Date;
    line: { productId: string; qty: number; unitPriceFcfa: number };
    reason: string;
    saleId: string;
    userId?: string | null;
  }
) => {
  const allocations = await consumeFifo(executor, {
    occurredAt: params.occurredAt,
    productId: params.line.productId,
    qty: params.line.qty,
    reason: params.reason,
    referenceId: params.saleId,
    referenceType: "sale",
    userId: params.userId,
  });
  const [item] = await executor
    .insert(saleItems)
    .values({
      costFcfa: Math.round(
        allocations.reduce(
          (sum, allocation) => sum + allocation.qty * allocation.unitCostFcfa,
          0
        )
      ),
      productId: params.line.productId,
      qty: params.line.qty,
      saleId: params.saleId,
      unitPriceFcfa: params.line.unitPriceFcfa,
    })
    .returning();
  if (!item) {
    throw new Error(
      "L'insertion de la ligne de vente n'a renvoyé aucune ligne"
    );
  }
  await executor.insert(saleItemLots).values(
    allocations.map((allocation) => ({
      lotId: allocation.lotId,
      qty: allocation.qty,
      saleItemId: item.id,
      unitCostFcfa: allocation.unitCostFcfa,
    }))
  );
  return item;
};

const saleItemsOf = (executor: Executor, saleId: string) =>
  executor
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, saleId))
    .orderBy(asc(saleItems.id));

/** Somme des quantités vendues d'une vente : le total de la vente en découle. */
const saleTotalOf = async (executor: Executor, saleId: string) => {
  const rows = await saleItemsOf(executor, saleId);
  return rows.reduce(
    (sum, row) => sum + lineAmountFcfa(row.qty, row.unitPriceFcfa),
    0
  );
};

const discountTotalOf = async (executor: Executor, saleId: string) => {
  const [row] = await executor
    .select({
      total: sql<number>`coalesce(sum(${saleDiscounts.amountFcfa}), 0)`,
    })
    .from(saleDiscounts)
    .where(eq(saleDiscounts.saleId, saleId));
  return row?.total ?? 0;
};

const writeRevision = async (
  executor: Executor,
  params: {
    reason: string;
    revisionDate: Date;
    saleId: string;
    summary: string;
    userId?: string | null;
  }
) => {
  await executor.insert(saleRevisions).values({
    createdBy: params.userId ?? null,
    reason: params.reason,
    revisionDate: params.revisionDate,
    saleId: params.saleId,
    summary: params.summary,
  });
};

const assertConsistent = async (
  executor: Executor,
  sale: typeof sales.$inferSelect,
  totalFcfa: number
) => {
  if (totalFcfa < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Le total de la vente ne peut pas être négatif",
    });
  }
  const discountFcfa = await discountTotalOf(executor, sale.id);
  if (discountFcfa > totalFcfa) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Les remises accordées (${formatFcfa(discountFcfa)}) dépassent le nouveau total (${formatFcfa(totalFcfa)}) : retirez d'abord une remise`,
    });
  }
};

/**
 * Modifie une vente déjà enregistrée : lignes ajoutées, quantités corrigées, lignes retirées.
 * Le stock suit par différence (le manquant est prélevé, le surplus revient dans ses lots) et la
 * modification laisse une trace datée avec son motif.
 */
export const updateSale = async (
  executor: Executor,
  input: SaleUpdateInput,
  userId?: string | null
) => {
  const sale = await getSaleRow(executor, input.id);
  assertSaleActive(sale);
  const existing = await saleItemsOf(executor, sale.id);
  const itemsById = new Map(existing.map((item) => [item.id, item]));
  const keptIds = new Set<string>();
  for (const line of input.items) {
    if (!line.id) {
      continue;
    }
    if (!itemsById.has(line.id)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Une ligne modifiée n'appartient pas à cette vente",
      });
    }
    if (keptIds.has(line.id)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "La même ligne apparaît deux fois",
      });
    }
    keptIds.add(line.id);
  }

  const productsById = await loadProducts(executor, [
    ...input.items.map((line) => line.productId),
    ...existing.map((item) => item.productId),
  ]);
  const archived = [...productsById.values()].find(
    (product) => product.archivedAt
  );
  if (archived) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Le produit « ${archived.name} » est archivé`,
    });
  }
  const nameOfItem = (productId: string) =>
    productsById.get(productId)?.name ?? "Produit";
  const reason = `Modification vente ${sale.reference} : ${input.reason}`;

  const changes: string[] = [];
  // Les retraits passent en premier : ils libèrent le stock avant les ajouts.
  for (const item of existing) {
    if (keptIds.has(item.id)) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop
    await shrinkSaleItem(executor, item.id, {
      occurredAt: input.saleDate,
      productId: item.productId,
      qty: item.qty,
      reason,
      referenceId: sale.id,
      restock: true,
      userId,
    });
    // oxlint-disable-next-line no-await-in-loop
    await executor.delete(saleItems).where(eq(saleItems.id, item.id));
    changes.push(
      `− ${formatQty(item.qty)} ${nameOfItem(item.productId)} (ligne retirée)`
    );
  }

  for (const line of input.items) {
    const current = line.id ? itemsById.get(line.id) : undefined;
    if (current && current.productId === line.productId) {
      const delta = roundQty(line.qty - current.qty);
      if (delta > QTY_EPSILON) {
        // oxlint-disable-next-line no-await-in-loop
        await growSaleItem(executor, current.id, {
          occurredAt: input.saleDate,
          productId: current.productId,
          qty: delta,
          reference: sale.reference,
          saleId: sale.id,
          userId,
        });
        changes.push(`+ ${formatQty(delta)} ${nameOfItem(line.productId)}`);
      } else if (delta < -QTY_EPSILON) {
        // oxlint-disable-next-line no-await-in-loop
        await shrinkSaleItem(executor, current.id, {
          occurredAt: input.saleDate,
          productId: current.productId,
          qty: -delta,
          reason,
          referenceId: sale.id,
          restock: true,
          userId,
        });
        changes.push(`− ${formatQty(-delta)} ${nameOfItem(line.productId)}`);
      }
      if (line.unitPriceFcfa !== current.unitPriceFcfa) {
        changes.push(
          `prix ${nameOfItem(line.productId)} ${formatFcfa(current.unitPriceFcfa)} → ${formatFcfa(line.unitPriceFcfa)}`
        );
      }
      // oxlint-disable-next-line no-await-in-loop
      await executor
        .update(saleItems)
        .set({ qty: line.qty, unitPriceFcfa: line.unitPriceFcfa })
        .where(eq(saleItems.id, current.id));
      continue;
    }
    if (current) {
      // Produit changé sur la même ligne : l'ancienne est rendue, la nouvelle est prélevée.
      // oxlint-disable-next-line no-await-in-loop
      await shrinkSaleItem(executor, current.id, {
        occurredAt: input.saleDate,
        productId: current.productId,
        qty: current.qty,
        reason,
        referenceId: sale.id,
        restock: true,
        userId,
      });
      // oxlint-disable-next-line no-await-in-loop
      await executor.delete(saleItems).where(eq(saleItems.id, current.id));
      changes.push(
        `− ${formatQty(current.qty)} ${nameOfItem(current.productId)} (ligne remplacée)`
      );
    }
    // oxlint-disable-next-line no-await-in-loop
    await insertSaleItem(executor, {
      line: { ...line },
      occurredAt: input.saleDate,
      reason: current ? reason : `Modification vente ${sale.reference}`,
      saleId: sale.id,
      userId,
    });
    changes.push(`+ ${formatQty(line.qty)} ${nameOfItem(line.productId)}`);
  }

  const totalFcfa = await saleTotalOf(executor, sale.id);
  await assertConsistent(executor, sale, totalFcfa);
  await executor
    .update(sales)
    .set({ notes: input.notes ?? null, saleDate: input.saleDate, totalFcfa })
    .where(eq(sales.id, sale.id));
  if (sale.saleDate.getTime() !== input.saleDate.getTime()) {
    // Les sorties de stock suivent la date de la vente, pas celle de la saisie.
    await executor
      .update(stockMovements)
      .set({ occurredAt: input.saleDate })
      .where(
        and(
          eq(stockMovements.referenceType, "sale"),
          eq(stockMovements.referenceId, sale.id)
        )
      );
    changes.push(
      `date ${formatDate(sale.saleDate)} → ${formatDate(input.saleDate)}`
    );
  }

  await writeRevision(executor, {
    reason: input.reason,
    revisionDate: new Date(),
    saleId: sale.id,
    summary: [
      ...changes,
      `total ${formatFcfa(sale.totalFcfa)} → ${formatFcfa(totalFcfa)}`,
    ].join(" · "),
    userId,
  });
  return { id: sale.id, totalFcfa };
};

/**
 * Reprise d'articles : la vente est corrigée (quantités rendues) et la reprise garde sa trace.
 * La marchandise ressortante revient dans ses lots d'origine ; la casse est seulement sortie de la
 * vente. Si l'argent est rendu, il est déduit des encaissements du client.
 */
export const createSaleReturn = async (
  executor: Executor,
  input: SaleReturnInput,
  userId?: string | null
) => {
  const sale = await getSaleRow(executor, input.saleId);
  assertSaleActive(sale);
  const items = await saleItemsOf(executor, sale.id);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let amountFcfa = 0;
  const lines = input.items.map((line) => {
    const item = itemsById.get(line.saleItemId);
    if (!item) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Un article repris n'appartient pas à cette vente",
      });
    }
    if (seen.has(line.saleItemId)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Le même article apparaît deux fois dans la reprise",
      });
    }
    seen.add(line.saleItemId);
    if (line.qty - item.qty > QTY_EPSILON) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Quantité reprise supérieure à la quantité vendue (${formatQty(item.qty)}) sur une ligne`,
      });
    }
    const lineAmount = lineAmountFcfa(line.qty, item.unitPriceFcfa);
    amountFcfa += lineAmount;
    return { item, line, lineAmount };
  });

  const [saleReturn] = await executor
    .insert(saleReturns)
    .values({
      amountFcfa,
      createdBy: userId ?? null,
      reason: input.reason,
      refundMethod: input.refundMethod,
      returnDate: input.returnDate,
      saleId: sale.id,
    })
    .returning();
  if (!saleReturn) {
    throw new Error("L'insertion de la reprise n'a renvoyé aucune ligne");
  }

  const reason = `Reprise ${sale.reference} : ${input.reason}`;
  await executor.insert(saleReturnItems).values(
    lines.map(({ item, line, lineAmount }) => ({
      amountFcfa: lineAmount,
      productId: item.productId,
      qty: line.qty,
      restocked: line.restocked !== false,
      returnId: saleReturn.id,
      saleItemId: item.id,
      unitPriceFcfa: item.unitPriceFcfa,
    }))
  );

  for (const { item, line } of lines) {
    // oxlint-disable-next-line no-await-in-loop
    await shrinkSaleItem(executor, item.id, {
      occurredAt: input.returnDate,
      productId: item.productId,
      qty: line.qty,
      reason,
      referenceId: sale.id,
      restock: line.restocked !== false,
      userId,
    });
    const left = roundQty(item.qty - line.qty);
    // oxlint-disable-next-line no-await-in-loop
    await (left <= QTY_EPSILON
      ? executor.delete(saleItems).where(eq(saleItems.id, item.id))
      : executor
          .update(saleItems)
          .set({ qty: left })
          .where(eq(saleItems.id, item.id)));
  }

  const totalFcfa = await saleTotalOf(executor, sale.id);
  await assertConsistent(executor, sale, totalFcfa);
  await executor.update(sales).set({ totalFcfa }).where(eq(sales.id, sale.id));
  await writeRevision(executor, {
    reason: input.reason,
    revisionDate: input.returnDate,
    saleId: sale.id,
    summary: `Reprise de ${formatFcfa(amountFcfa)} · total ${formatFcfa(sale.totalFcfa)} → ${formatFcfa(totalFcfa)}`,
    userId,
  });
  return {
    amountFcfa,
    items: lines.map(({ item, line }) => ({
      productId: item.productId,
      qty: line.qty,
    })),
    refundMethod: input.refundMethod,
    returnId: saleReturn.id,
    totalFcfa,
  };
};

const userNames = async (
  executor: Executor,
  ids: readonly (string | null)[]
) => {
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
  const [customer, items, discounts, salePayments, ledgers] = await Promise.all(
    [
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
    ]
  );

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
              items.map((item) => item.id)
            )
          )
          .orderBy(asc(saleItemLots.id))
      : [];
  const lotsByItem = Map.groupBy(lots, (lot) => lot.saleItemId);
  const [returnRows, revisionRows] = await Promise.all([
    executor
      .select()
      .from(saleReturns)
      .where(eq(saleReturns.saleId, id))
      .orderBy(desc(saleReturns.returnDate), desc(saleReturns.id)),
    executor
      .select()
      .from(saleRevisions)
      .where(eq(saleRevisions.saleId, id))
      .orderBy(desc(saleRevisions.revisionDate), desc(saleRevisions.id)),
  ]);
  const returnItems =
    returnRows.length > 0
      ? await executor
          .select({
            amountFcfa: saleReturnItems.amountFcfa,
            id: saleReturnItems.id,
            productId: saleReturnItems.productId,
            productName: products.name,
            qty: saleReturnItems.qty,
            restocked: saleReturnItems.restocked,
            returnId: saleReturnItems.returnId,
            saleItemId: saleReturnItems.saleItemId,
            unitPriceFcfa: saleReturnItems.unitPriceFcfa,
          })
          .from(saleReturnItems)
          .innerJoin(products, eq(products.id, saleReturnItems.productId))
          .where(
            inArray(
              saleReturnItems.returnId,
              returnRows.map((row) => row.id)
            )
          )
          .orderBy(asc(saleReturnItems.id))
      : [];
  const returnItemsByReturn = Map.groupBy(returnItems, (item) => item.returnId);
  const names = await userNames(executor, [
    sale.createdBy,
    sale.cancelledBy,
    ...discounts.map((discount) => discount.createdBy),
    ...salePayments.map((payment) => payment.createdBy),
    ...returnRows.map((row) => row.createdBy),
    ...revisionRows.map((row) => row.createdBy),
  ]);
  const nameOf = (userId: string | null) =>
    userId ? (names.get(userId) ?? null) : null;

  const discountFcfa = discounts.reduce(
    (sum, discount) => sum + discount.amountFcfa,
    0
  );
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
    returns: returnRows.map((row) => ({
      ...row,
      createdByName: nameOf(row.createdBy),
      items: returnItemsByReturn.get(row.id) ?? [],
    })),
    revisions: revisionRows.map((row) => ({
      ...row,
      createdByName: nameOf(row.createdBy),
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

const saleNetSql = sql<number>`(${sales.totalFcfa} - ${saleDiscountSql})`;

const SALE_SORT_SQL = {
  customerName: customers.name,
  netFcfa: saleNetSql,
  reference: sales.reference,
  saleDate: sales.saleDate,
} as const;

/**
 * Historique filtrable des ventes, avec les totaux de la sélection (hors ventes annulées).
 * La page, le décompte et les totaux sont calculés par SQL ; seul le reste dû vient des comptes
 * clients (gardés en mémoire, voir `loadLedgers`). Le filtre « payées ou non » dépend du reste
 * dû : il charge alors toute la sélection.
 */
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
          .where(
            and(
              eq(saleItems.saleId, sales.id),
              eq(saleItems.productId, filters.productId)
            )
          )
      )
    );
  }
  if (filters.search) {
    conditions.push(
      or(
        containsInsensitive(sales.reference, filters.search),
        containsInsensitive(customers.name, filters.search)
      ) as SQL
    );
  }
  const where = and(...conditions);
  const sortColumn = SALE_SORT_SQL[filters.sort?.id ?? "saleDate"];
  const descending = filters.sort ? filters.sort.desc : true;
  const order = [
    descending ? desc(sortColumn) : asc(sortColumn),
    desc(sales.id),
  ];

  const rowQuery = () =>
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
      .where(where)
      .orderBy(...order)
      .$dynamic();

  const ledgers = await loadLedgers(executor, filters.customerId);
  type SaleRowData = Awaited<ReturnType<typeof rowQuery>>[number];
  const enrich = (row: SaleRowData) => {
    const active = row.status === "active";
    const netFcfa = row.totalFcfa - row.discountFcfa;
    const settlement = active
      ? ledgers.get(row.customerId)?.sales.get(row.id)
      : undefined;
    return {
      ...row,
      dueFcfa: settlement?.dueFcfa ?? 0,
      marginFcfa: active ? netFcfa - row.costFcfa : 0,
      netFcfa,
      paidFcfa: settlement?.paidFcfa ?? 0,
    };
  };
  const dueOf = (customerId: string, saleId: string) =>
    ledgers.get(customerId)?.sales.get(saleId)?.dueFcfa ?? 0;

  const onlyByCustomer =
    !filters.from &&
    !filters.to &&
    !filters.productId &&
    !filters.search &&
    !filters.status;
  let page: ReturnType<typeof enrich>[];
  let total: number;
  const totals = {
    costFcfa: 0,
    count: 0,
    dueFcfa: 0,
    marginFcfa: 0,
    netFcfa: 0,
  };

  if (filters.paymentState) {
    // Le reste dû vient des comptes : toute la sélection est chargée puis filtrée.
    const filtered = (await rowQuery())
      .map(enrich)
      .filter((sale) =>
        filters.paymentState === "due"
          ? sale.dueFcfa > 0
          : sale.status === "active" && sale.dueFcfa === 0
      );
    for (const sale of filtered) {
      if (sale.status === "active") {
        totals.netFcfa += sale.netFcfa;
        totals.costFcfa += sale.costFcfa;
        totals.marginFcfa += sale.marginFcfa;
        totals.dueFcfa += sale.dueFcfa;
      }
    }
    total = filtered.length;
    const start = (filters.page - 1) * filters.pageSize;
    page = filtered.slice(start, start + filters.pageSize);
  } else {
    const [rows, [aggregate], activeIds] = await Promise.all([
      rowQuery()
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      Promise.all([
        executor
          .select({ count: count() })
          .from(sales)
          .innerJoin(customers, eq(customers.id, sales.customerId))
          .where(where),
        executor
          .select({ value: sql<number>`coalesce(sum(${sales.totalFcfa}), 0)` })
          .from(sales)
          .innerJoin(customers, eq(customers.id, sales.customerId))
          .where(and(where, eq(sales.status, "active"))),
        executor
          .select({
            value: sql<number>`coalesce(sum(${saleDiscounts.amountFcfa}), 0)`,
          })
          .from(saleDiscounts)
          .innerJoin(sales, eq(sales.id, saleDiscounts.saleId))
          .innerJoin(customers, eq(customers.id, sales.customerId))
          .where(and(where, eq(sales.status, "active"))),
        executor
          .select({
            value: sql<number>`coalesce(sum(${saleItems.costFcfa}), 0)`,
          })
          .from(saleItems)
          .innerJoin(sales, eq(sales.id, saleItems.saleId))
          .innerJoin(customers, eq(customers.id, sales.customerId))
          .where(and(where, eq(sales.status, "active"))),
      ]).then(([[counted], [gross], [discounts], [cost]]) => [
        {
          costFcfa: cost?.value ?? 0,
          count: counted?.count ?? 0,
          netFcfa: (gross?.value ?? 0) - (discounts?.value ?? 0),
        },
      ]),
      // Reste dû de la sélection : sans autre filtre que le client, c'est celui des comptes ;
      // sinon les identifiants suffisent, les montants sont dans les comptes.
      onlyByCustomer
        ? Promise.resolve(null)
        : executor
            .select({ customerId: sales.customerId, id: sales.id })
            .from(sales)
            .innerJoin(customers, eq(customers.id, sales.customerId))
            .where(and(where, eq(sales.status, "active"))),
    ]);
    page = rows.map(enrich);
    total = aggregate?.count ?? 0;
    totals.netFcfa = aggregate?.netFcfa ?? 0;
    totals.costFcfa = aggregate?.costFcfa ?? 0;
    totals.marginFcfa = totals.netFcfa - totals.costFcfa;
    totals.dueFcfa = activeIds
      ? activeIds.reduce(
          (sum, sale) => sum + dueOf(sale.customerId, sale.id),
          0
        )
      : [...ledgers.values()].reduce(
          (sum, ledger) => sum + ledger.totalDueFcfa,
          0
        );
  }
  totals.count = total;

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
              page.map((sale) => sale.id)
            )
          )
          .orderBy(asc(saleItems.id))
      : [];
  const linesBySale = Map.groupBy(lines, (line) => line.saleId);

  return {
    items: page.map((sale) => ({
      ...sale,
      lines: linesBySale.get(sale.id) ?? [],
    })),
    total,
    totals,
  };
};

/** Ce qui a été vendu, produit par produit (ventes validées, montants avant remises). */
export const productSalesSummary = async (
  executor: Executor,
  filters: ProductSalesFilters
) => {
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
    .orderBy(
      desc(sql`sum(round(${saleItems.qty} * ${saleItems.unitPriceFcfa}))`)
    );

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
  userId?: string | null
) => {
  const sale = await getSaleRow(executor, params.id);
  assertSaleActive(sale);
  const items = await executor
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, sale.id));
  const lots =
    items.length > 0
      ? await executor
          .select()
          .from(saleItemLots)
          .where(
            inArray(
              saleItemLots.saleItemId,
              items.map((item) => item.id)
            )
          )
      : [];
  const lotsByItem = Map.groupBy(lots, (lot) => lot.saleItemId);

  const now = new Date();
  for (const item of items) {
    // oxlint-disable-next-line no-await-in-loop
    await returnToLots(executor, {
      allocations: lotsByItem.get(item.id) ?? [],
      // La marchandise revient le jour de l'annulation, pas celui de la vente.
      occurredAt: now,
      productId: item.productId,
      reason: `Annulation ${sale.reference} : ${params.reason}`,
      referenceId: sale.id,
      referenceType: "sale",
      userId,
    });
  }

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

  invalidateLedgers();
  return {
    cancelledPaymentsFcfa: cancelledPayments.reduce(
      (sum, payment) => sum + payment.amountFcfa,
      0
    ),
    id: sale.id,
  };
};

/** Remise accordée après la vente : elle réduit le montant net, motif obligatoire. */
export const addSaleDiscount = async (
  executor: Executor,
  input: SaleDiscountInput,
  userId?: string | null
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
  userId?: string | null
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
  invalidateLedgers();
  return payment;
};

/** Corrige un paiement déjà enregistré (montant, date, mode, vente) sans l'annuler. */
export const updatePayment = async (
  executor: Executor,
  input: PaymentUpdateInput
) => {
  const [payment] = await executor
    .select()
    .from(payments)
    .where(eq(payments.id, input.id));
  if (!payment) {
    throw new ORPCError("NOT_FOUND", { message: "Paiement introuvable" });
  }
  if (payment.cancelledAt) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Ce paiement est annulé : il ne peut plus être modifié",
    });
  }
  if (input.saleId) {
    const sale = await getSaleRow(executor, input.saleId);
    assertSaleActive(sale);
    if (sale.customerId !== payment.customerId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cette vente appartient à un autre client",
      });
    }
  }
  const [updated] = await executor
    .update(payments)
    .set({
      amountFcfa: input.amountFcfa,
      method: input.method,
      notes: input.notes ?? null,
      paymentDate: input.paymentDate,
      saleId: input.saleId ?? null,
    })
    .where(eq(payments.id, input.id))
    .returning();
  invalidateLedgers();
  return updated;
};

export const cancelPayment = async (
  executor: Executor,
  params: { id: string; reason: string }
) => {
  const [payment] = await executor
    .select()
    .from(payments)
    .where(eq(payments.id, params.id));
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
  invalidateLedgers();
  return updated;
};

export const listPayments = async (executor: Executor, customerId: string) => {
  const [rows, saleRows] = await Promise.all([
    executor
      .select({ payment: payments, saleReference: sales.reference })
      .from(payments)
      .leftJoin(sales, eq(sales.id, payments.saleId))
      .where(eq(payments.customerId, customerId))
      .orderBy(desc(payments.paymentDate), desc(payments.id)),
    // Ventes du client, nettes de remises : elles disent ce que chaque paiement a réglé.
    executor
      .select({
        date: sales.saleDate,
        id: sales.id,
        netFcfa: sql<number>`${sales.totalFcfa} - ${saleDiscountSql}`,
        reference: sales.reference,
      })
      .from(sales)
      .where(and(eq(sales.customerId, customerId), eq(sales.status, "active")))
      .orderBy(asc(sales.saleDate), asc(sales.id)),
  ]);
  const names = await userNames(
    executor,
    rows.map(({ payment }) => payment.createdBy)
  );
  const references = new Map(saleRows.map((sale) => [sale.id, sale.reference]));

  // Le calcul d'affectation veut les paiements dans l'ordre chronologique, l'affichage l'inverse.
  const chronological = rows
    .filter(({ payment }) => !payment.cancelledAt)
    .toSorted(
      (a, b) =>
        a.payment.paymentDate.getTime() - b.payment.paymentDate.getTime() ||
        a.payment.id.localeCompare(b.payment.id)
    );
  const coverage = allocatePaymentCoverage(
    saleRows,
    chronological.map(({ payment }) => ({
      amountFcfa: payment.amountFcfa,
      id: payment.id,
      saleId: payment.saleId,
    }))
  );

  return rows.map(({ payment, saleReference }) => ({
    ...payment,
    /** Ventes que ce paiement règle, dans l'ordre où elles ont été soldées. */
    coveredSales: (coverage.get(payment.id) ?? []).map((part) => ({
      amountFcfa: part.amountFcfa,
      reference: references.get(part.saleId) ?? null,
      saleId: part.saleId,
    })),
    createdByName: payment.createdBy
      ? (names.get(payment.createdBy) ?? null)
      : null,
    saleReference,
  }));
};

const MS_PER_DAY = 86_400_000;

/** Jour local au format AAAA-MM-JJ (le même que celui des activités). */
const paymentDayKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Paiement tel qu'affiché dans le relevé : de quoi le corriger, l'annuler et le retrouver. */
export interface LedgerPayment {
  id: string;
  amountFcfa: number;
  method: PaymentMethod;
  notes: string | null;
  cancelledAt: Date | null;
  createdByName: string | null;
  paymentDate: Date;
  saleId: string | null;
  saleReference: string | null;
}

/** Un jour du relevé : ce qui a été encaissé, et les ventes que cela a soldées. */
export interface LedgerDay {
  date: string;
  paidFcfa: number;
  cancelledFcfa: number;
  methods: string[];
  sales: { saleId: string; reference: string | null; amountFcfa: number }[];
  payments: LedgerPayment[];
}

const emptyLedgerDay = (date: string): LedgerDay => ({
  cancelledFcfa: 0,
  date,
  methods: [],
  paidFcfa: 0,
  payments: [],
  sales: [],
});

/** Range un paiement dans son jour, avec les ventes qu'il règle. */
const addPaymentToDay = (
  day: LedgerDay,
  payment: LedgerPayment,
  covered: readonly PaymentCoverage[],
  references: Map<string, string>
): void => {
  day.payments.push(payment);
  if (payment.cancelledAt) {
    day.cancelledFcfa += payment.amountFcfa;
    return;
  }
  day.paidFcfa += payment.amountFcfa;
  if (!day.methods.includes(payment.method)) {
    day.methods.push(payment.method);
  }
  for (const part of covered) {
    const existing = day.sales.find((sale) => sale.saleId === part.saleId);
    if (existing) {
      existing.amountFcfa += part.amountFcfa;
    } else {
      day.sales.push({
        amountFcfa: part.amountFcfa,
        reference: references.get(part.saleId) ?? null,
        saleId: part.saleId,
      });
    }
  }
};

/** Série continue du calendrier : un point par jour, jours sans paiement compris. */
const buildPaymentHeatmap = (
  days: readonly LedgerDay[],
  now: Date,
  months: number
): { date: string; value: number; count: number }[] => {
  const paid = new Map<string, { value: number; count: number }>();
  for (const day of days) {
    if (day.paidFcfa > 0) {
      paid.set(day.date, {
        count: day.payments.filter((payment) => !payment.cancelledAt).length,
        value: day.paidFcfa,
      });
    }
  }
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const length =
    Math.round((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return Array.from({ length }, (_, index) => {
    const date = paymentDayKey(new Date(start.getTime() + index * MS_PER_DAY));
    const entry = paid.get(date);
    return { count: entry?.count ?? 0, date, value: entry?.value ?? 0 };
  });
};

export interface PaymentLedgerParams {
  customerId: string;
  /** Profondeur de l'historique, en mois (le calendrier en couvre 12). */
  months?: number;
}

/**
 * Relevé des paiements d'un client, agrégé **par jour** côté serveur : montant encaissé, moyens,
 * et ventes que chaque paiement a réglées. Un client de passage peut avoir des milliers de
 * paiements : la fenêtre évite de tout renvoyer au navigateur.
 */
export const paymentsLedger = async (
  executor: Executor,
  params: PaymentLedgerParams
) => {
  const months = params.months ?? 12;
  const now = new Date();
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - (months - 1),
    1
  );

  const [detailed, allocationRows, saleRows] = await Promise.all([
    executor
      .select({ payment: payments, saleReference: sales.reference })
      .from(payments)
      .leftJoin(sales, eq(sales.id, payments.saleId))
      .where(
        and(
          eq(payments.customerId, params.customerId),
          gte(payments.paymentDate, windowStart)
        )
      )
      .orderBy(asc(payments.paymentDate), asc(payments.id)),
    // Tout l'historique sert à savoir ce que chaque paiement a réglé, même avant la fenêtre.
    executor
      .select({
        amountFcfa: payments.amountFcfa,
        id: payments.id,
        paymentDate: payments.paymentDate,
        saleId: payments.saleId,
      })
      .from(payments)
      .where(
        and(
          eq(payments.customerId, params.customerId),
          isNull(payments.cancelledAt)
        )
      )
      .orderBy(asc(payments.paymentDate), asc(payments.id)),
    executor
      .select({
        date: sales.saleDate,
        id: sales.id,
        netFcfa: sql<number>`${sales.totalFcfa} - ${saleDiscountSql}`,
        reference: sales.reference,
      })
      .from(sales)
      .where(
        and(eq(sales.customerId, params.customerId), eq(sales.status, "active"))
      )
      .orderBy(asc(sales.saleDate), asc(sales.id)),
  ]);

  const names = await userNames(
    executor,
    detailed.map(({ payment }) => payment.createdBy)
  );
  const references = new Map(saleRows.map((sale) => [sale.id, sale.reference]));
  const coverage = allocatePaymentCoverage(saleRows, allocationRows);

  const days = new Map<string, LedgerDay>();
  for (const { payment, saleReference } of detailed) {
    const date = paymentDayKey(payment.paymentDate);
    const day = days.get(date) ?? emptyLedgerDay(date);
    addPaymentToDay(
      day,
      {
        amountFcfa: payment.amountFcfa,
        cancelledAt: payment.cancelledAt,
        createdByName: payment.createdBy
          ? (names.get(payment.createdBy) ?? null)
          : null,
        id: payment.id,
        method: payment.method,
        notes: payment.notes,
        paymentDate: payment.paymentDate,
        saleId: payment.saleId,
        saleReference,
      },
      coverage.get(payment.id) ?? [],
      references
    );
    days.set(date, day);
  }

  const allDays = [...days.values()].toSorted((a, b) =>
    b.date.localeCompare(a.date)
  );
  const todayKey = paymentDayKey(now);
  const monthPrefix = todayKey.slice(0, 7);
  const lastPayment = allocationRows.at(-1);

  return {
    days: allDays,
    heatmap: buildPaymentHeatmap(allDays, now, months),
    summary: {
      lastPaymentDate: lastPayment?.paymentDate ?? null,
      lastPaymentFcfa: lastPayment?.amountFcfa ?? null,
      monthFcfa: allDays
        .filter((day) => day.date.startsWith(monthPrefix))
        .reduce((total, day) => total + day.paidFcfa, 0),
      todayCount:
        days.get(todayKey)?.payments.filter((payment) => !payment.cancelledAt)
          .length ?? 0,
      todayFcfa: days.get(todayKey)?.paidFcfa ?? 0,
    },
    totals: {
      cancelledFcfa: allDays.reduce(
        (total, day) => total + day.cancelledFcfa,
        0
      ),
      count: allDays.reduce(
        (total, day) =>
          total + day.payments.filter((payment) => !payment.cancelledAt).length,
        0
      ),
      days: allDays.filter((day) => day.paidFcfa > 0).length,
      paidFcfa: allDays.reduce((total, day) => total + day.paidFcfa, 0),
    },
  };
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

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
    const days = ledger.oldestUnpaidDate
      ? daysBetween(ledger.oldestUnpaidDate, now)
      : 0;
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

const pad = (value: number) => String(value).padStart(2, "0");
/** Jour local au format AAAA-MM-JJ. */
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const activeSalesSince = (executor: Executor, since: Date, column: AnyColumn) =>
  executor
    .select({
      costFcfa: saleCostSql,
      createdAt: sales.createdAt,
      discountFcfa: saleDiscountSql,
      saleDate: sales.saleDate,
      totalFcfa: sales.totalFcfa,
    })
    .from(sales)
    .where(and(eq(sales.status, "active"), gte(column, since)));

export interface ActivityFilters {
  customerId?: string | null;
  productId?: string | null;
}

/**
 * Ventes actives depuis `since` : la vente entière (remises déduites), ou seulement les lignes
 * d'un produit (avant remises, comme le résumé par produit).
 */
const activityRows = async (
  executor: Executor,
  since: Date,
  filters: ActivityFilters
) => {
  const conditions: SQL[] = [
    eq(sales.status, "active"),
    gte(sales.saleDate, since),
  ];
  if (filters.customerId) {
    conditions.push(eq(sales.customerId, filters.customerId));
  }
  if (filters.productId) {
    const lines = await executor
      .select({
        costFcfa: saleItems.costFcfa,
        qty: saleItems.qty,
        saleDate: sales.saleDate,
        saleId: sales.id,
        unitPriceFcfa: saleItems.unitPriceFcfa,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(...conditions, eq(saleItems.productId, filters.productId)));
    return lines.map((line) => ({
      costFcfa: line.costFcfa,
      netFcfa: lineAmountFcfa(line.qty, line.unitPriceFcfa),
      qty: line.qty,
      saleDate: line.saleDate,
    }));
  }
  const rows = await executor
    .select({
      costFcfa: saleCostSql,
      discountFcfa: saleDiscountSql,
      saleDate: sales.saleDate,
      totalFcfa: sales.totalFcfa,
    })
    .from(sales)
    .where(and(...conditions));
  return rows.map((row) => ({
    costFcfa: row.costFcfa,
    netFcfa: row.totalFcfa - row.discountFcfa,
    qty: 0,
    saleDate: row.saleDate,
  }));
};

/**
 * Ventes actives jour par jour sur les `days` derniers jours, aujourd'hui compris, pour toute la
 * boutique, un client ou un produit (`qty` : quantité vendue de ce produit). Les jours sans vente
 * sont présents, à zéro : courbes des cartes et calendrier d'activité.
 */
export const salesActivity = async (
  executor: Executor,
  days: number,
  filters: ActivityFilters = {},
  now = new Date()
) => {
  const today = startOfDay(now);
  const since = new Date(today);
  since.setDate(today.getDate() - (days - 1));

  const series = new Map<
    string,
    {
      date: string;
      marginFcfa: number;
      qty: number;
      revenueFcfa: number;
      saleCount: number;
    }
  >();
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(since);
    day.setDate(since.getDate() + offset);
    const date = dayKey(day);
    series.set(date, {
      date,
      marginFcfa: 0,
      qty: 0,
      revenueFcfa: 0,
      saleCount: 0,
    });
  }

  for (const row of await activityRows(executor, since, filters)) {
    const entry = series.get(dayKey(row.saleDate));
    if (!entry) {
      continue;
    }
    entry.revenueFcfa += row.netFcfa;
    entry.marginFcfa += row.netFcfa - row.costFcfa;
    entry.qty = roundQty(entry.qty + row.qty);
    entry.saleCount += 1;
  }
  return [...series.values()];
};

const HOURS_PER_DAY = 24;

/**
 * Chiffre d'affaires heure par heure, aujourd'hui et hier : le jour est celui de la vente, l'heure
 * celle de son enregistrement (la date de vente n'a pas d'heure). Suivi de la journée en cours.
 */
export const salesByHour = async (executor: Executor, now = new Date()) => {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayHours = Array.from({ length: HOURS_PER_DAY }, () => 0);
  const yesterdayHours = Array.from({ length: HOURS_PER_DAY }, () => 0);
  let todayCount = 0;
  for (const row of await activeSalesSince(
    executor,
    yesterday,
    sales.saleDate
  )) {
    // Une vente datée d'un jour à venir n'est ni d'aujourd'hui, ni d'hier.
    if (row.saleDate >= tomorrow) {
      continue;
    }
    const netFcfa = row.totalFcfa - row.discountFcfa;
    const hour = row.createdAt.getHours();
    if (row.saleDate >= today) {
      todayHours[hour] = (todayHours[hour] ?? 0) + netFcfa;
      todayCount += 1;
    } else {
      yesterdayHours[hour] = (yesterdayHours[hour] ?? 0) + netFcfa;
    }
  }
  return {
    currentHour: now.getHours(),
    today: todayHours,
    todayCount,
    yesterday: yesterdayHours,
  };
};

const DAYS_PER_WEEK = 7;

export type TrendGrouping = "customer" | "product";

/**
 * Ventes semaine par semaine, par produit ou par client : les `weeks` dernières semaines (la
 * dernière finit aujourd'hui) et autant juste avant, pour comparer. Montants nets de remises par
 * client, avant remises par produit (comme le résumé par produit).
 */
export const salesTrends = async (
  executor: Executor,
  by: TrendGrouping,
  weeks: number,
  now = new Date()
) => {
  const today = startOfDay(now);
  const since = new Date(today);
  since.setDate(today.getDate() - (2 * weeks * DAYS_PER_WEEK - 1));
  const conditions = [eq(sales.status, "active"), gte(sales.saleDate, since)];

  const rows =
    by === "product"
      ? (
          await executor
            .select({
              id: saleItems.productId,
              qty: saleItems.qty,
              saleDate: sales.saleDate,
              unitPriceFcfa: saleItems.unitPriceFcfa,
            })
            .from(saleItems)
            .innerJoin(sales, eq(sales.id, saleItems.saleId))
            .where(and(...conditions))
        ).map((row) => ({
          amountFcfa: lineAmountFcfa(row.qty, row.unitPriceFcfa),
          id: row.id,
          qty: row.qty,
          saleDate: row.saleDate,
        }))
      : (
          await executor
            .select({
              discountFcfa: saleDiscountSql,
              id: sales.customerId,
              saleDate: sales.saleDate,
              totalFcfa: sales.totalFcfa,
            })
            .from(sales)
            .where(and(...conditions))
        ).map((row) => ({
          amountFcfa: row.totalFcfa - row.discountFcfa,
          id: row.id,
          qty: 1,
          saleDate: row.saleDate,
        }));

  const series = new Map<
    string,
    {
      current: number[];
      currentQty: number;
      id: string;
      previous: number[];
      previousQty: number;
    }
  >();
  for (const row of rows) {
    const daysAgo = Math.round(
      (today.getTime() - startOfDay(row.saleDate).getTime()) / 86_400_000
    );
    const weekAgo = Math.floor(daysAgo / DAYS_PER_WEEK);
    if (weekAgo < 0 || weekAgo >= 2 * weeks) {
      continue;
    }
    const entry = series.get(row.id) ?? {
      current: Array.from({ length: weeks }, () => 0),
      currentQty: 0,
      id: row.id,
      previous: Array.from({ length: weeks }, () => 0),
      previousQty: 0,
    };
    // Index 0 : la semaine la plus ancienne de la période.
    if (weekAgo < weeks) {
      const index = weeks - 1 - weekAgo;
      entry.current[index] = (entry.current[index] ?? 0) + row.amountFcfa;
      entry.currentQty = roundQty(entry.currentQty + row.qty);
    } else {
      const index = 2 * weeks - 1 - weekAgo;
      entry.previous[index] = (entry.previous[index] ?? 0) + row.amountFcfa;
      entry.previousQty = roundQty(entry.previousQty + row.qty);
    }
    series.set(row.id, entry);
  }
  return [...series.values()];
};
