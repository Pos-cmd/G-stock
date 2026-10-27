import { allocatePayments, daysBetween, receivableLevel } from "@G-stock/core/sales";
import type { PaymentAllocation } from "@G-stock/core/sales";
import type { Executor } from "@G-stock/db";
import { customers, payments, saleDiscounts, sales } from "@G-stock/db/schema/sales";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CustomerFilters, customerInputSchema } from "../schemas/customers";
import { getSettings } from "./settings";

type CustomerInput = z.output<typeof customerInputSchema>;

/** Somme des remises d'une vente (sous-requête corrélée). */
export const saleDiscountSql = sql<number>`coalesce((select sum(${saleDiscounts.amountFcfa}) from ${saleDiscounts} where ${saleDiscounts.saleId} = ${sales.id}), 0)`;

export interface CustomerLedger extends PaymentAllocation {
  /** Total net des ventes validées (remises déduites). */
  purchasedFcfa: number;
  saleCount: number;
  lastSaleDate: Date | null;
}

/**
 * Compte de chaque client : ventes validées (nettes de remises) et paiements non annulés,
 * affectés vente par vente. Limité à un client si `customerId` est donné.
 */
export const loadLedgers = async (
  executor: Executor,
  customerId?: number | null,
): Promise<Map<number, CustomerLedger>> => {
  const saleConditions: SQL[] = [eq(sales.status, "active")];
  const paymentConditions: SQL[] = [isNull(payments.cancelledAt)];
  if (customerId) {
    saleConditions.push(eq(sales.customerId, customerId));
    paymentConditions.push(eq(payments.customerId, customerId));
  }
  const [saleRows, paymentRows] = await Promise.all([
    executor
      .select({
        customerId: sales.customerId,
        discountFcfa: saleDiscountSql,
        id: sales.id,
        saleDate: sales.saleDate,
        totalFcfa: sales.totalFcfa,
      })
      .from(sales)
      .where(and(...saleConditions)),
    executor
      .select({
        amountFcfa: payments.amountFcfa,
        customerId: payments.customerId,
        saleId: payments.saleId,
      })
      .from(payments)
      .where(and(...paymentConditions))
      .orderBy(asc(payments.paymentDate), asc(payments.id)),
  ]);

  const salesByCustomer = Map.groupBy(saleRows, (row) => row.customerId);
  const paymentsByCustomer = Map.groupBy(paymentRows, (row) => row.customerId);
  const customerIds = new Set([...salesByCustomer.keys(), ...paymentsByCustomer.keys()]);

  const ledgers = new Map<number, CustomerLedger>();
  for (const id of customerIds) {
    const customerSales = (salesByCustomer.get(id) ?? []).map((sale) => ({
      date: sale.saleDate,
      id: sale.id,
      netFcfa: sale.totalFcfa - sale.discountFcfa,
    }));
    const allocation = allocatePayments(customerSales, paymentsByCustomer.get(id) ?? []);
    let lastSaleDate: Date | null = null;
    let purchasedFcfa = 0;
    for (const sale of customerSales) {
      purchasedFcfa += sale.netFcfa;
      if (!lastSaleDate || sale.date > lastSaleDate) {
        lastSaleDate = sale.date;
      }
    }
    ledgers.set(id, {
      ...allocation,
      lastSaleDate,
      purchasedFcfa,
      saleCount: customerSales.length,
    });
  }
  return ledgers;
};

type Thresholds = Awaited<ReturnType<typeof getSettings>>;

const accountOf = (ledger: CustomerLedger | undefined, thresholds: Thresholds, now: Date) => {
  const daysOverdue = ledger?.oldestUnpaidDate ? daysBetween(ledger.oldestUnpaidDate, now) : null;
  return {
    creditFcfa: ledger?.creditFcfa ?? 0,
    daysOverdue,
    dueFcfa: ledger?.totalDueFcfa ?? 0,
    lastSaleDate: ledger?.lastSaleDate ?? null,
    oldestUnpaidDate: ledger?.oldestUnpaidDate ?? null,
    purchasedFcfa: ledger?.purchasedFcfa ?? 0,
    receivableLevel: daysOverdue === null ? null : receivableLevel(daysOverdue, thresholds),
    saleCount: ledger?.saleCount ?? 0,
  };
};

const containsInsensitive = (column: AnyColumn, needle: string): SQL =>
  sql`instr(lower(coalesce(${column}, '')), lower(${needle})) > 0`;

export const listCustomers = async (executor: Executor, filters: CustomerFilters) => {
  const where = filters.search
    ? (or(
        containsInsensitive(customers.name, filters.search),
        containsInsensitive(customers.phone, filters.search),
        containsInsensitive(customers.address, filters.search),
      ) as SQL)
    : undefined;
  const [rows, ledgers, thresholds] = await Promise.all([
    executor.select().from(customers).where(where).orderBy(asc(customers.name)),
    loadLedgers(executor),
    getSettings(executor),
  ]);
  const now = new Date();
  const items = rows.map((customer) => ({
    ...customer,
    ...accountOf(ledgers.get(customer.id), thresholds, now),
  }));
  if (!filters.withDebtOnly) {
    return items;
  }
  // Débiteurs : les plus grosses dettes d'abord.
  return items.filter((customer) => customer.dueFcfa > 0).toSorted((a, b) => b.dueFcfa - a.dueFcfa);
};

export const getCustomer = async (executor: Executor, id: number) => {
  const [customer] = await executor.select().from(customers).where(eq(customers.id, id));
  if (!customer) {
    throw new ORPCError("NOT_FOUND", { message: "Client introuvable" });
  }
  const [ledgers, thresholds] = await Promise.all([
    loadLedgers(executor, id),
    getSettings(executor),
  ]);
  return { ...customer, ...accountOf(ledgers.get(id), thresholds, new Date()) };
};

const assertNameAvailable = async (executor: Executor, name: string, exceptId?: number) => {
  const conditions: SQL[] = [sql`lower(${customers.name}) = lower(${name})`];
  if (exceptId) {
    conditions.push(ne(customers.id, exceptId));
  }
  const [existing] = await executor
    .select({ id: customers.id })
    .from(customers)
    .where(and(...conditions));
  if (existing) {
    throw new ORPCError("CONFLICT", {
      message: `Un client nommé « ${name} » existe déjà : ajoutez un détail (quartier, prénom…)`,
    });
  }
};

export const createCustomer = async (executor: Executor, input: CustomerInput) => {
  await assertNameAvailable(executor, input.name);
  const [created] = await executor.insert(customers).values(input).returning();
  if (!created) {
    throw new Error("L'insertion du client n'a renvoyé aucune ligne");
  }
  return created;
};

export const updateCustomer = async (executor: Executor, id: number, input: CustomerInput) => {
  await assertNameAvailable(executor, input.name, id);
  const [updated] = await executor
    .update(customers)
    .set(input)
    .where(eq(customers.id, id))
    .returning();
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "Client introuvable" });
  }
  return updated;
};

/** Suppression réservée aux clients sans vente ni paiement. */
export const removeCustomer = async (executor: Executor, id: number) => {
  const [[saleUsage], [paymentUsage]] = await Promise.all([
    executor.select({ n: count() }).from(sales).where(eq(sales.customerId, id)),
    executor.select({ n: count() }).from(payments).where(eq(payments.customerId, id)),
  ]);
  if ((saleUsage?.n ?? 0) > 0 || (paymentUsage?.n ?? 0) > 0) {
    throw new ORPCError("CONFLICT", {
      message: "Ce client a un historique de ventes : il ne peut pas être supprimé",
    });
  }
  const [deleted] = await executor.delete(customers).where(eq(customers.id, id)).returning();
  if (!deleted) {
    throw new ORPCError("NOT_FOUND", { message: "Client introuvable" });
  }
  return { id };
};
