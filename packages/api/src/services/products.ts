import { getStockStatus, roundQty } from "@G-stock/core/stock";
import type { Executor } from "@G-stock/db";
import { products } from "@G-stock/db/schema/catalog";
import { stockLots } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { z } from "zod";

import type { productInputSchema, productListSchema } from "../schemas/products";

type ProductInput = z.output<typeof productInputSchema>;
type ProductFilters = z.output<typeof productListSchema>;

const stockQtySql = sql<number>`coalesce(sum(${stockLots.qtyRemaining}), 0)`;
const stockValueSql = sql<number>`coalesce(sum(${stockLots.qtyRemaining} * ${stockLots.unitCostFcfa}), 0)`;

const withStockStats = <T extends { alertThreshold: number }>(
  row: T & { stockQty: number; stockValueFcfa: number },
) => {
  const stockQty = roundQty(row.stockQty);
  const stockValueFcfa = Math.round(row.stockValueFcfa);
  return {
    ...row,
    averageCostFcfa: stockQty > 0 ? Math.round(stockValueFcfa / stockQty) : 0,
    status: getStockStatus(stockQty, row.alertThreshold),
    stockQty,
    stockValueFcfa,
  };
};

const containsInsensitive = (column: AnyColumn, needle: string): SQL =>
  sql`instr(lower(coalesce(${column}, '')), lower(${needle})) > 0`;

const selectProductsWithStock = (executor: Executor, where: SQL | undefined) =>
  executor
    .select({
      alertThreshold: products.alertThreshold,
      archivedAt: products.archivedAt,
      category: products.category,
      createdAt: products.createdAt,
      id: products.id,
      lotCount: count(stockLots.id),
      name: products.name,
      notes: products.notes,
      reference: products.reference,
      referencePriceRmb: products.referencePriceRmb,
      stockQty: stockQtySql,
      stockValueFcfa: stockValueSql,
      suggestedSalePriceFcfa: products.suggestedSalePriceFcfa,
      unit: products.unit,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(stockLots, eq(stockLots.productId, products.id))
    .where(where)
    .groupBy(products.id)
    .orderBy(asc(products.name));

export const listProducts = async (executor: Executor, filters: ProductFilters) => {
  const conditions: SQL[] = [];
  if (!filters.includeArchived) {
    conditions.push(isNull(products.archivedAt));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }
  if (filters.search) {
    conditions.push(
      or(
        containsInsensitive(products.name, filters.search),
        containsInsensitive(products.reference, filters.search),
        containsInsensitive(products.category, filters.search),
      ) as SQL,
    );
  }

  const rows = await selectProductsWithStock(executor, and(...conditions));
  const items = rows.map(withStockStats);
  return filters.status ? items.filter((item) => item.status === filters.status) : items;
};

export const getProduct = async (executor: Executor, id: number) => {
  const [row] = await selectProductsWithStock(executor, eq(products.id, id));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Produit introuvable" });
  }
  return withStockStats(row);
};

const assertNameAvailable = async (executor: Executor, name: string, exceptId?: number) => {
  const conditions: SQL[] = [sql`lower(${products.name}) = lower(${name})`];
  if (exceptId) {
    conditions.push(ne(products.id, exceptId));
  }
  const [existing] = await executor
    .select({ id: products.id })
    .from(products)
    .where(and(...conditions));
  if (existing) {
    throw new ORPCError("CONFLICT", {
      message: `Un produit nommé « ${name} » existe déjà`,
    });
  }
};

export const createProduct = async (executor: Executor, input: ProductInput) => {
  await assertNameAvailable(executor, input.name);
  const [created] = await executor.insert(products).values(input).returning();
  if (!created) {
    throw new Error("L'insertion du produit n'a renvoyé aucune ligne");
  }
  return created;
};

export const updateProduct = async (executor: Executor, id: number, input: ProductInput) => {
  await assertNameAvailable(executor, input.name, id);
  const [updated] = await executor
    .update(products)
    .set(input)
    .where(eq(products.id, id))
    .returning();
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "Produit introuvable" });
  }
  return updated;
};

export const setProductArchived = async (executor: Executor, id: number, archived: boolean) => {
  const [updated] = await executor
    .update(products)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(products.id, id))
    .returning();
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "Produit introuvable" });
  }
  return updated;
};

/** Suppression définitive, réservée aux produits sans aucun historique de stock. */
export const removeProduct = async (executor: Executor, id: number) => {
  const [usage] = await executor
    .select({ lots: count() })
    .from(stockLots)
    .where(eq(stockLots.productId, id));
  if (usage && usage.lots > 0) {
    throw new ORPCError("CONFLICT", {
      message: "Ce produit a un historique de stock : archivez-le plutôt que de le supprimer",
    });
  }
  const [deleted] = await executor.delete(products).where(eq(products.id, id)).returning();
  if (!deleted) {
    throw new ORPCError("NOT_FOUND", { message: "Produit introuvable" });
  }
  return { id };
};

export const listCategories = async (executor: Executor): Promise<string[]> => {
  const rows = await executor
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(isNotNull(products.category), ne(products.category, "")))
    .orderBy(asc(products.category));
  return rows.flatMap((row) => (row.category ? [row.category] : []));
};

export const getStockSummary = async (executor: Executor) => {
  const items = await listProducts(executor, { includeArchived: false });
  let stockValueFcfa = 0;
  let lowCount = 0;
  let outCount = 0;
  for (const item of items) {
    stockValueFcfa += item.stockValueFcfa;
    if (item.status === "low") {
      lowCount += 1;
    } else if (item.status === "out") {
      outCount += 1;
    }
  }
  return { lowCount, outCount, productCount: items.length, stockValueFcfa };
};
