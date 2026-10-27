import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { computeLandedCosts } from "@G-stock/core/purchasing";
import type { Executor } from "@G-stock/db";
import { products, suppliers } from "@G-stock/db/schema/catalog";
import { purchaseOrderItems, purchaseOrders } from "@G-stock/db/schema/purchasing";
import { stockLots } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type { PurchaseOrderFilters, PurchaseOrderInput } from "../schemas/purchases";
import { createLot } from "./stock";

type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
type PurchaseItemRow = typeof purchaseOrderItems.$inferSelect;

const REFERENCE_PREFIX = "CF";
const LOCKED_STATUSES: readonly PurchaseOrderStatus[] = ["received", "cancelled"];
const REMOVABLE_STATUSES: readonly PurchaseOrderStatus[] = ["draft", "cancelled"];

/** Ex. : CF-2026-0007 */
export const buildOrderReference = (year: number, sequence: number): string =>
  `${REFERENCE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;

const nextOrderReference = async (executor: Executor, orderDate: Date): Promise<string> => {
  const year = orderDate.getFullYear();
  const prefix = `${REFERENCE_PREFIX}-${year}-`;
  const [row] = await executor
    .select({
      last: sql<
        number | null
      >`max(cast(substr(${purchaseOrders.reference}, ${prefix.length + 1}) as integer))`,
    })
    .from(purchaseOrders)
    .where(like(purchaseOrders.reference, `${prefix}%`));
  return buildOrderReference(year, (row?.last ?? 0) + 1);
};

const costsOf = (order: PurchaseOrderRow, items: readonly PurchaseItemRow[]) =>
  computeLandedCosts({
    ...order,
    items,
    rates: { fcfaPerUsd: order.fcfaPerUsd, rmbPerUsd: order.rmbPerUsd },
  });

const getOrderRow = async (executor: Executor, id: number): Promise<PurchaseOrderRow> => {
  const [order] = await executor.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  if (!order) {
    throw new ORPCError("NOT_FOUND", { message: "Commande introuvable" });
  }
  return order;
};

const assertEditable = (order: PurchaseOrderRow): void => {
  if (order.status === "received") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cette commande a déjà été réceptionnée : elle ne peut plus être modifiée",
    });
  }
  if (order.status === "cancelled") {
    throw new ORPCError("BAD_REQUEST", { message: "Cette commande est annulée" });
  }
};

const assertProductsActive = async (executor: Executor, productIds: readonly number[]) => {
  const ids = [...new Set(productIds)];
  const rows = await executor
    .select({ archivedAt: products.archivedAt, id: products.id, name: products.name })
    .from(products)
    .where(inArray(products.id, ids));
  if (rows.length !== ids.length) {
    throw new ORPCError("NOT_FOUND", { message: "Un des produits est introuvable" });
  }
  const archived = rows.find((row) => row.archivedAt);
  if (archived) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Le produit « ${archived.name} » est archivé : restaurez-le avant de le commander`,
    });
  }
};

const orderValues = (input: PurchaseOrderInput) => ({
  allocationMethod: input.allocationMethod,
  fcfaPerUsd: input.fcfaPerUsd,
  freightCbm: input.freightCbm,
  freightRatePerCbmFcfa: input.freightRatePerCbmFcfa,
  localTransportFcfa: input.localTransportFcfa,
  notes: input.notes,
  orderDate: input.orderDate,
  otherFeesFcfa: input.otherFeesFcfa,
  rmbPerUsd: input.rmbPerUsd,
  supplierId: input.supplierId ?? null,
});

/** Enregistre les lignes avec leur part de frais et leur coût de revient unitaire. */
const insertItems = async (executor: Executor, orderId: number, input: PurchaseOrderInput) => {
  const { lines } = computeLandedCosts({
    ...input,
    rates: { fcfaPerUsd: input.fcfaPerUsd, rmbPerUsd: input.rmbPerUsd },
  });
  await executor.insert(purchaseOrderItems).values(
    input.items.map((item, index) => ({
      orderId,
      productId: item.productId,
      qty: item.qty,
      transportShareFcfa: lines[index]?.transportShareFcfa ?? 0,
      trips: item.trips,
      unitCostFcfa: lines[index]?.unitCostFcfa ?? 0,
      unitPriceRmb: item.unitPriceRmb,
    })),
  );
};

/** À appeler dans une transaction. */
export const createPurchaseOrder = async (executor: Executor, input: PurchaseOrderInput) => {
  await assertProductsActive(
    executor,
    input.items.map((item) => item.productId),
  );
  const reference = await nextOrderReference(executor, input.orderDate);
  const [order] = await executor
    .insert(purchaseOrders)
    .values({ ...orderValues(input), reference })
    .returning();
  if (!order) {
    throw new Error("L'insertion de la commande n'a renvoyé aucune ligne");
  }
  await insertItems(executor, order.id, input);
  return order;
};

/** Remplace l'en-tête et toutes les lignes. À appeler dans une transaction. */
export const updatePurchaseOrder = async (
  executor: Executor,
  id: number,
  input: PurchaseOrderInput,
) => {
  assertEditable(await getOrderRow(executor, id));
  await assertProductsActive(
    executor,
    input.items.map((item) => item.productId),
  );
  const [order] = await executor
    .update(purchaseOrders)
    .set(orderValues(input))
    .where(eq(purchaseOrders.id, id))
    .returning();
  await executor.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
  await insertItems(executor, id, input);
  return order;
};

export const setPurchaseStatus = async (
  executor: Executor,
  id: number,
  status: Exclude<PurchaseOrderStatus, "received">,
) => {
  assertEditable(await getOrderRow(executor, id));
  const [order] = await executor
    .update(purchaseOrders)
    .set({ status })
    .where(eq(purchaseOrders.id, id))
    .returning();
  return order;
};

export const removePurchaseOrder = async (executor: Executor, id: number) => {
  const order = await getOrderRow(executor, id);
  if (!REMOVABLE_STATUSES.includes(order.status)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Seules les commandes en brouillon ou annulées peuvent être supprimées",
    });
  }
  await executor.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  return { id };
};

export interface ReceivePurchaseParams {
  id: number;
  receivedAt: Date;
  userId?: string | null;
}

/**
 * Réceptionne la marchandise : un lot par ligne, au coût de revient calculé, et la commande
 * passe à « reçue ». À appeler dans une transaction : tout ou rien.
 */
export const receivePurchaseOrder = async (executor: Executor, params: ReceivePurchaseParams) => {
  const order = await getOrderRow(executor, params.id);
  assertEditable(order);
  const items = await executor
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.orderId, order.id))
    .orderBy(asc(purchaseOrderItems.id));
  if (items.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "La commande ne contient aucun produit" });
  }

  const lots = [];
  for (const item of items) {
    // Séquentiel : les numéros de lot suivent l'ordre des lignes de la commande.
    // oxlint-disable-next-line no-await-in-loop
    const lot = await createLot(executor, {
      notes: `Commande ${order.reference}`,
      orderItemId: item.id,
      productId: item.productId,
      qty: item.qty,
      receivedAt: params.receivedAt,
      referenceId: order.id,
      referenceType: "purchase_order",
      source: "purchase",
      unitCostFcfa: item.unitCostFcfa,
      userId: params.userId,
    });
    lots.push(lot);
  }

  await executor
    .update(purchaseOrders)
    .set({ receivedAt: params.receivedAt, status: "received" })
    .where(eq(purchaseOrders.id, order.id));

  return { id: order.id, lotCount: lots.length, reference: order.reference };
};

const containsInsensitive = (column: AnyColumn, needle: string): SQL =>
  sql`instr(lower(coalesce(${column}, '')), lower(${needle})) > 0`;

export const listPurchaseOrders = async (executor: Executor, filters: PurchaseOrderFilters) => {
  const conditions: SQL[] = [];
  if (filters.status) {
    conditions.push(eq(purchaseOrders.status, filters.status));
  }
  if (filters.supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  }
  if (filters.search) {
    conditions.push(
      or(
        containsInsensitive(purchaseOrders.reference, filters.search),
        containsInsensitive(suppliers.name, filters.search),
        containsInsensitive(purchaseOrders.notes, filters.search),
      ) as SQL,
    );
  }

  const orders = await executor
    .select({ order: purchaseOrders, supplierName: suppliers.name })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.id));
  if (orders.length === 0) {
    return [];
  }

  const items = await executor
    .select()
    .from(purchaseOrderItems)
    .where(
      inArray(
        purchaseOrderItems.orderId,
        orders.map(({ order }) => order.id),
      ),
    )
    .orderBy(asc(purchaseOrderItems.id));
  const itemsByOrder = Map.groupBy(items, (item) => item.orderId);

  return orders.map(({ order, supplierName }) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    const costs = costsOf(order, orderItems);
    return {
      ...order,
      feesFcfa: costs.feesFcfa,
      goodsFcfa: costs.goodsFcfa,
      goodsRmb: costs.goodsRmb,
      itemCount: orderItems.length,
      supplierName,
      totalFcfa: costs.totalFcfa,
    };
  });
};

export const getPurchaseOrder = async (executor: Executor, id: number) => {
  const [row] = await executor
    .select({ order: purchaseOrders, supplier: suppliers })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(eq(purchaseOrders.id, id));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Commande introuvable" });
  }

  const rows = await executor
    .select({
      item: purchaseOrderItems,
      lotCode: stockLots.lotCode,
      lotId: stockLots.id,
      productArchivedAt: products.archivedAt,
      productName: products.name,
      productUnit: products.unit,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .leftJoin(stockLots, eq(stockLots.orderItemId, purchaseOrderItems.id))
    .where(eq(purchaseOrderItems.orderId, id))
    .orderBy(asc(purchaseOrderItems.id));

  const costs = costsOf(
    row.order,
    rows.map(({ item }) => item),
  );
  const items = rows.map(({ item, ...extra }, index) => ({
    ...item,
    ...extra,
    goodsFcfa: costs.lines[index]?.goodsFcfa ?? 0,
    goodsRmb: costs.lines[index]?.goodsRmb ?? 0,
    totalFcfa: costs.lines[index]?.totalFcfa ?? 0,
  }));

  return {
    ...row.order,
    costs: {
      feesFcfa: costs.feesFcfa,
      freightFcfa: costs.freightFcfa,
      goodsFcfa: costs.goodsFcfa,
      goodsRmb: costs.goodsRmb,
      goodsUsd: costs.goodsUsd,
      totalFcfa: costs.totalFcfa,
    },
    isLocked: LOCKED_STATUSES.includes(row.order.status),
    items,
    supplier: row.supplier,
  };
};
