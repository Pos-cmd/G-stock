import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import {
  computeLandedCosts,
  computeLandedCostsFromFees,
  feeToFcfa,
} from "@G-stock/core/purchasing";
import type { Executor } from "@G-stock/db";
import { products, suppliers } from "@G-stock/db/schema/catalog";
import {
  purchaseOrderFees,
  purchaseOrderItems,
  purchaseOrders,
} from "@G-stock/db/schema/purchasing";
import { stockLots } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type {
  PurchaseOrderFilters,
  PurchaseOrderInput,
  PurchaseReceiveInput,
  PurchaseReceptionInput,
} from "../schemas/purchases";
import { nextReference } from "./references";
import { createLot } from "./stock";

type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
type PurchaseItemRow = typeof purchaseOrderItems.$inferSelect;
type PurchaseFeeRow = typeof purchaseOrderFees.$inferSelect;

const REFERENCE_PREFIX = "CF";
const REFERENCE_DIGITS = 4;
const LOCKED_STATUSES: readonly PurchaseOrderStatus[] = ["received", "cancelled"];
const REMOVABLE_STATUSES: readonly PurchaseOrderStatus[] = ["draft", "cancelled"];

const ratesOf = (order: PurchaseOrderRow) => ({
  fcfaPerUsd: order.fcfaPerUsd,
  rmbPerUsd: order.rmbPerUsd,
});

/** Prix de revient estimé à partir des frais saisis sur la commande. */
const estimatedCostsOf = (order: PurchaseOrderRow, items: readonly PurchaseItemRow[]) =>
  computeLandedCosts({ ...order, items, rates: ratesOf(order) });

/** Prix de revient réel : frais saisis à la réception, coût réparti sur les quantités reçues. */
const actualCostsOf = (
  order: PurchaseOrderRow,
  items: readonly PurchaseItemRow[],
  fees: readonly PurchaseFeeRow[],
) =>
  computeLandedCostsFromFees({
    fees,
    items: items.map((item) => ({ ...item, receivedQty: item.qtyReceived })),
    rates: ratesOf(order),
  });

/** Une commande reçue affiche ses coûts réels, les autres leur estimation. */
const displayedCostsOf = (
  order: PurchaseOrderRow,
  items: readonly PurchaseItemRow[],
  fees: readonly PurchaseFeeRow[],
) =>
  order.status === "received" ? actualCostsOf(order, items, fees) : estimatedCostsOf(order, items);

const listOrderItems = (executor: Executor, orderId: string) =>
  executor
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.orderId, orderId))
    .orderBy(asc(purchaseOrderItems.id));

const listOrderFees = (executor: Executor, orderId: string) =>
  executor
    .select()
    .from(purchaseOrderFees)
    .where(eq(purchaseOrderFees.orderId, orderId))
    .orderBy(asc(purchaseOrderFees.id));

const getOrderRow = async (executor: Executor, id: string): Promise<PurchaseOrderRow> => {
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

const assertProductsActive = async (executor: Executor, productIds: readonly string[]) => {
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
const insertItems = async (executor: Executor, orderId: string, input: PurchaseOrderInput) => {
  const { lines } = computeLandedCosts({
    ...input,
    rates: { fcfaPerUsd: input.fcfaPerUsd, rmbPerUsd: input.rmbPerUsd },
  });
  await executor.insert(purchaseOrderItems).values(
    input.items.map((item, index) => ({
      orderId,
      pricingBasis: item.pricingBasis,
      productId: item.productId,
      qty: item.qty,
      transportShareFcfa: lines[index]?.transportShareFcfa ?? 0,
      trips: item.trips,
      unitCostFcfa: lines[index]?.unitCostFcfa ?? 0,
      unitPriceRmb: item.unitPriceRmb,
      weightTons: item.weightTons ?? null,
    })),
  );
};

/** À appeler dans une transaction. */
export const createPurchaseOrder = async (executor: Executor, input: PurchaseOrderInput) => {
  await assertProductsActive(
    executor,
    input.items.map((item) => item.productId),
  );
  const reference = await nextReference(
    executor,
    REFERENCE_PREFIX,
    input.orderDate,
    REFERENCE_DIGITS,
  );
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
  id: string,
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
  id: string,
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

export const removePurchaseOrder = async (executor: Executor, id: string) => {
  const order = await getOrderRow(executor, id);
  if (!REMOVABLE_STATUSES.includes(order.status)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Seules les commandes en brouillon ou annulées peuvent être supprimées",
    });
  }
  await executor.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  return { id };
};

/**
 * Enregistre la saisie de réception (arrivée, frais réels, quantités reçues) sans toucher au
 * stock : on peut noter la douane dès qu'elle est payée et valider la réception plus tard.
 * À appeler dans une transaction.
 */
export const saveReception = async (executor: Executor, input: PurchaseReceptionInput) => {
  const order = await getOrderRow(executor, input.id);
  assertEditable(order);
  const items = await listOrderItems(executor, order.id);

  const itemIds = new Set(items.map((item) => item.id));
  const inputIds = new Set(input.items.map((item) => item.id));
  const sameLines =
    itemIds.size === inputIds.size && [...inputIds].every((itemId) => itemIds.has(itemId));
  if (!sameLines) {
    throw new ORPCError("CONFLICT", {
      message: "Les lignes de la commande ont changé : rechargez la page de réception",
    });
  }
  const usesWeight = input.fees.some((fee) => fee.allocationMethod === "weight");
  if (usesWeight && items.some((item) => !item.weightTons)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Répartition au poids : indiquez le poids de chaque ligne sur la commande, ou choisissez une autre méthode",
    });
  }

  await executor
    .update(purchaseOrders)
    .set({
      arrivedAt: input.arrivedAt ?? null,
      billOfLading: input.billOfLading,
      containerNumber: input.containerNumber,
      forwarder: input.forwarder,
    })
    .where(eq(purchaseOrders.id, order.id));

  await executor.delete(purchaseOrderFees).where(eq(purchaseOrderFees.orderId, order.id));
  if (input.fees.length > 0) {
    await executor.insert(purchaseOrderFees).values(
      input.fees.map((fee) => ({
        ...fee,
        amountFcfa: feeToFcfa(fee.amount, fee.currency, ratesOf(order)),
        orderId: order.id,
      })),
    );
  }

  await Promise.all(
    input.items.map((item) =>
      executor
        .update(purchaseOrderItems)
        .set({ qtyReceived: item.qtyReceived })
        .where(eq(purchaseOrderItems.id, item.id)),
    ),
  );

  return { id: order.id };
};

export interface ReceivePurchaseParams extends PurchaseReceiveInput {
  userId?: string | null;
}

/**
 * Réceptionne la marchandise : enregistre la saisie, fige le coût de revient réel de chaque
 * ligne et crée un lot par ligne reçue. La commande passe à « reçue ».
 * À appeler dans une transaction : tout ou rien.
 */
export const receivePurchaseOrder = async (executor: Executor, params: ReceivePurchaseParams) => {
  await saveReception(executor, params);
  const order = await getOrderRow(executor, params.id);
  const [items, fees] = await Promise.all([
    listOrderItems(executor, order.id),
    listOrderFees(executor, order.id),
  ]);
  const costs = actualCostsOf(order, items, fees);

  const received = items.flatMap((item, index) => {
    const line = costs.lines[index];
    return line && item.qtyReceived && item.qtyReceived > 0 ? [{ item, line }] : [];
  });
  if (received.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Aucune quantité reçue : rien à mettre en stock",
    });
  }

  await Promise.all(
    items.map((item, index) =>
      executor
        .update(purchaseOrderItems)
        .set({
          transportShareFcfa: costs.lines[index]?.transportShareFcfa ?? 0,
          unitCostFcfa: costs.lines[index]?.unitCostFcfa ?? 0,
        })
        .where(eq(purchaseOrderItems.id, item.id)),
    ),
  );

  const lots = [];
  for (const { item, line } of received) {
    // Séquentiel : les numéros de lot suivent l'ordre des lignes de la commande.
    // oxlint-disable-next-line no-await-in-loop
    const lot = await createLot(executor, {
      notes: `Commande ${order.reference}`,
      orderItemId: item.id,
      productId: item.productId,
      qty: item.qtyReceived ?? item.qty,
      receivedAt: params.receivedAt,
      referenceId: order.id,
      referenceType: "purchase_order",
      source: "purchase",
      unitCostFcfa: line.unitCostFcfa,
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
  const fees = await executor
    .select()
    .from(purchaseOrderFees)
    .where(
      inArray(
        purchaseOrderFees.orderId,
        orders.map(({ order }) => order.id),
      ),
    );
  const itemsByOrder = Map.groupBy(items, (item) => item.orderId);
  const feesByOrder = Map.groupBy(fees, (fee) => fee.orderId);

  return orders.map(({ order, supplierName }) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    const costs = displayedCostsOf(order, orderItems, feesByOrder.get(order.id) ?? []);
    return {
      ...order,
      feesFcfa: costs.feesFcfa,
      goodsFcfa: costs.goodsFcfa,
      goodsRmb: costs.goodsRmb,
      itemCount: orderItems.length,
      supplierName,
      totalFcfa: costs.totalFcfa,
      totalWeightTons: costs.totalWeightTons,
    };
  });
};

export const getPurchaseOrder = async (executor: Executor, id: string) => {
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

  const fees = await listOrderFees(executor, id);
  const itemRows = rows.map(({ item }) => item);
  const estimate = estimatedCostsOf(row.order, itemRows);
  const actual = actualCostsOf(row.order, itemRows, fees);
  const costs = row.order.status === "received" ? actual : estimate;
  const items = rows.map(({ item, ...extra }, index) => ({
    ...item,
    ...extra,
    costPerTonFcfa: costs.lines[index]?.costPerTonFcfa ?? null,
    goodsFcfa: costs.lines[index]?.goodsFcfa ?? 0,
    goodsRmb: costs.lines[index]?.goodsRmb ?? 0,
    totalFcfa: costs.lines[index]?.totalFcfa ?? 0,
  }));

  return {
    ...row.order,
    costs: {
      feesFcfa: costs.feesFcfa,
      goodsFcfa: costs.goodsFcfa,
      goodsRmb: costs.goodsRmb,
      goodsUsd: costs.goodsUsd,
      totalFcfa: costs.totalFcfa,
      totalWeightTons: costs.totalWeightTons,
    },
    /** Estimation de la commande, pour la comparer aux frais réels. */
    estimate: {
      feesFcfa: estimate.feesFcfa,
      freightFcfa: estimate.freightFcfa,
      totalFcfa: estimate.totalFcfa,
    },
    fees,
    isLocked: LOCKED_STATUSES.includes(row.order.status),
    items,
    supplier: row.supplier,
  };
};
