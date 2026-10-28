import type { Executor } from "@G-stock/db";
import { products, suppliers } from "@G-stock/db/schema/catalog";
import { purchaseOrderItems, purchaseOrders } from "@G-stock/db/schema/purchasing";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, max, ne, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { z } from "zod";

import type { supplierInputSchema } from "../schemas/suppliers";
import { listPurchaseOrders } from "./purchases";

type SupplierInput = z.output<typeof supplierInputSchema>;

const supplierRows = (executor: Executor) =>
  executor
    .select({
      contact: suppliers.contact,
      country: suppliers.country,
      createdAt: suppliers.createdAt,
      id: suppliers.id,
      lastOrderDate: max(purchaseOrders.orderDate),
      name: suppliers.name,
      notes: suppliers.notes,
      orderCount: count(purchaseOrders.id),
      phone: suppliers.phone,
    })
    .from(suppliers)
    .leftJoin(purchaseOrders, eq(purchaseOrders.supplierId, suppliers.id))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));

/** Commandes engagées : passées au fournisseur, ou brouillons sur lesquels un versement est fait. */
const isCommitted = (order: Awaited<ReturnType<typeof listPurchaseOrders>>[number]) =>
  order.status !== "cancelled" && (order.status !== "draft" || order.payment.paymentCount > 0);

/** Fournisseurs avec ce qu'il reste à leur payer sur les commandes engagées. */
export const listSuppliers = async (executor: Executor) => {
  const [rows, orders] = await Promise.all([
    supplierRows(executor),
    listPurchaseOrders(executor, {}),
  ]);
  const committed = Map.groupBy(orders.filter(isCommitted), (order) => order.supplierId);
  return rows.map((row) => {
    const supplierOrders = committed.get(row.id) ?? [];
    return {
      ...row,
      paidFcfa: supplierOrders.reduce((sum, order) => sum + order.payment.paidFcfa, 0),
      // En FCFA au taux de chaque commande : les commandes peuvent être en RMB ou en USD.
      remainingFcfa: supplierOrders.reduce((sum, order) => sum + order.payment.remainingFcfa, 0),
      unpaidOrderCount: supplierOrders.filter((order) => !order.payment.isPaid).length,
    };
  });
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_OF_HISTORY = 12;

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Produits achetés chez le fournisseur, du plus récent au plus ancien (commandes annulées exclues). */
const supplierProducts = async (executor: Executor, supplierId: string) => {
  const rows = await executor
    .select({
      orderDate: purchaseOrders.orderDate,
      orderId: purchaseOrders.id,
      productId: products.id,
      productName: products.name,
      qty: purchaseOrderItems.qty,
      qtyReceived: purchaseOrderItems.qtyReceived,
      unit: products.unit,
      unitCostFcfa: purchaseOrderItems.unitCostFcfa,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.orderId))
    .innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(and(eq(purchaseOrders.supplierId, supplierId), ne(purchaseOrders.status, "cancelled")))
    .orderBy(desc(purchaseOrders.orderDate));

  const byProduct = new Map<
    string,
    {
      costFcfa: number;
      lastOrderDate: Date;
      lastUnitCostFcfa: number;
      orderIds: Set<string>;
      productId: string;
      productName: string;
      qty: number;
      unit: string;
    }
  >();
  for (const row of rows) {
    // Lignes triées de la plus récente à la plus ancienne : la première donne le dernier coût.
    const entry = byProduct.get(row.productId) ?? {
      costFcfa: 0,
      lastOrderDate: row.orderDate,
      lastUnitCostFcfa: row.unitCostFcfa,
      orderIds: new Set<string>(),
      productId: row.productId,
      productName: row.productName,
      qty: 0,
      unit: row.unit,
    };
    const qty = row.qtyReceived ?? row.qty;
    entry.qty += qty;
    entry.costFcfa += qty * row.unitCostFcfa;
    entry.orderIds.add(row.orderId);
    byProduct.set(row.productId, entry);
  }
  return [...byProduct.values()]
    .map(({ costFcfa, orderIds, ...entry }) => ({
      ...entry,
      averageUnitCostFcfa: entry.qty > 0 ? Math.round(costFcfa / entry.qty) : 0,
      orderCount: orderIds.size,
      totalCostFcfa: Math.round(costFcfa),
    }))
    .toSorted((a, b) => b.totalCostFcfa - a.totalCostFcfa);
};

/** Fiche fournisseur : coordonnées, commandes, produits achetés et statistiques. */
export const getSupplier = async (executor: Executor, id: string, now = new Date()) => {
  const [supplier] = await executor.select().from(suppliers).where(eq(suppliers.id, id));
  if (!supplier) {
    throw new ORPCError("NOT_FOUND", { message: "Fournisseur introuvable" });
  }
  const [orders, productRows] = await Promise.all([
    listPurchaseOrders(executor, { supplierId: id }),
    supplierProducts(executor, id),
  ]);
  const committed = orders.filter(isCommitted);

  // Délai de livraison : de la commande à la réception, sur les commandes reçues.
  const leadTimes = committed.flatMap((order) =>
    order.receivedAt
      ? [Math.round((order.receivedAt.getTime() - order.orderDate.getTime()) / MS_PER_DAY)]
      : [],
  );

  // Achats des 12 derniers mois, mois par mois (mois vides compris).
  const monthly = new Map<string, { month: string; totalFcfa: number; orderCount: number }>();
  for (let offset = MONTHS_OF_HISTORY - 1; offset >= 0; offset -= 1) {
    const month = monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    monthly.set(month, { month, orderCount: 0, totalFcfa: 0 });
  }
  for (const order of committed) {
    const entry = monthly.get(monthKey(order.orderDate));
    if (entry) {
      entry.totalFcfa += order.totalFcfa;
      entry.orderCount += 1;
    }
  }

  return {
    ...supplier,
    monthly: [...monthly.values()],
    orders,
    products: productRows,
    stats: {
      averageLeadDays:
        leadTimes.length > 0
          ? Math.round(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length)
          : null,
      committedCount: committed.length,
      firstOrderDate: committed.at(-1)?.orderDate ?? null,
      lastOrderDate: committed[0]?.orderDate ?? null,
      paidFcfa: committed.reduce((sum, order) => sum + order.payment.paidFcfa, 0),
      remainingFcfa: committed.reduce((sum, order) => sum + order.payment.remainingFcfa, 0),
      totalFcfa: committed.reduce((sum, order) => sum + order.totalFcfa, 0),
      unpaidOrderCount: committed.filter((order) => !order.payment.isPaid).length,
    },
  };
};

const assertNameAvailable = async (executor: Executor, name: string, exceptId?: string) => {
  const conditions: SQL[] = [sql`lower(${suppliers.name}) = lower(${name})`];
  if (exceptId) {
    conditions.push(ne(suppliers.id, exceptId));
  }
  const [existing] = await executor
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(...conditions));
  if (existing) {
    throw new ORPCError("CONFLICT", {
      message: `Un fournisseur nommé « ${name} » existe déjà`,
    });
  }
};

export const createSupplier = async (executor: Executor, input: SupplierInput) => {
  await assertNameAvailable(executor, input.name);
  const [created] = await executor.insert(suppliers).values(input).returning();
  if (!created) {
    throw new Error("L'insertion du fournisseur n'a renvoyé aucune ligne");
  }
  return created;
};

export const updateSupplier = async (executor: Executor, id: string, input: SupplierInput) => {
  await assertNameAvailable(executor, input.name, id);
  const [updated] = await executor
    .update(suppliers)
    .set(input)
    .where(eq(suppliers.id, id))
    .returning();
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "Fournisseur introuvable" });
  }
  return updated;
};

/** Suppression réservée aux fournisseurs sans commande. */
export const removeSupplier = async (executor: Executor, id: string) => {
  const [usage] = await executor
    .select({ orders: count() })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, id));
  if (usage && usage.orders > 0) {
    throw new ORPCError("CONFLICT", {
      message: "Ce fournisseur a des commandes : il ne peut pas être supprimé",
    });
  }
  const [deleted] = await executor.delete(suppliers).where(eq(suppliers.id, id)).returning();
  if (!deleted) {
    throw new ORPCError("NOT_FOUND", { message: "Fournisseur introuvable" });
  }
  return { id };
};
