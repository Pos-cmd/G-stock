import type { LotSource, MovementReferenceType } from "@G-stock/core/enums";
import { uuidv7 } from "@G-stock/core/ids";
import { QTY_EPSILON, planFifo, roundQty } from "@G-stock/core/stock";
import type { Executor } from "@G-stock/db";
import { user } from "@G-stock/db/schema/auth";
import { products } from "@G-stock/db/schema/catalog";
import { purchaseOrderItems, purchaseOrders } from "@G-stock/db/schema/purchasing";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, getColumns, gt, gte, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { MovementFilters } from "../schemas/stock";

export interface CreateLotParams {
  productId: string;
  qty: number;
  unitCostFcfa: number;
  source: LotSource;
  receivedAt: Date;
  orderItemId?: string | null;
  notes?: string | null;
  userId?: string | null;
  referenceType?: MovementReferenceType;
  referenceId?: string | null;
}

export interface AdjustLotParams {
  lotId: string;
  newQty: number;
  reason: string;
  userId?: string | null;
}

export interface ConsumeFifoParams {
  productId: string;
  qty: number;
  referenceType: MovementReferenceType;
  referenceId?: string | null;
  reason?: string | null;
  userId?: string | null;
}

export interface LotAllocation {
  lotId: string;
  qty: number;
  unitCostFcfa: number;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

const LOT_SUFFIX_LENGTH = 6;

/**
 * Ex. : LOT-20261026-3F9A2C. Le suffixe vient de la partie aléatoire de l'identifiant du lot :
 * aucun compteur, donc aucun risque de doublon.
 */
export const buildLotCode = (receivedAt: Date, lotId: string): string => {
  const day = `${receivedAt.getFullYear()}${pad(receivedAt.getMonth() + 1)}${pad(receivedAt.getDate())}`;
  return `LOT-${day}-${lotId.slice(-LOT_SUFFIX_LENGTH).toUpperCase()}`;
};

const getActiveProduct = async (executor: Executor, productId: string) => {
  const [product] = await executor.select().from(products).where(eq(products.id, productId));
  if (!product) {
    throw new ORPCError("NOT_FOUND", { message: "Produit introuvable" });
  }
  if (product.archivedAt) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Ce produit est archivé : restaurez-le avant de mouvementer son stock",
    });
  }
  return product;
};

/** Crée un lot et son mouvement d'entrée. À appeler dans une transaction. */
export const createLot = async (executor: Executor, params: CreateLotParams) => {
  const qty = roundQty(params.qty);
  if (qty <= QTY_EPSILON) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La quantité doit être supérieure à zéro",
    });
  }
  await getActiveProduct(executor, params.productId);

  const lotId = uuidv7();
  const [inserted] = await executor
    .insert(stockLots)
    .values({
      id: lotId,
      lotCode: buildLotCode(params.receivedAt, lotId),
      notes: params.notes ?? null,
      orderItemId: params.orderItemId ?? null,
      productId: params.productId,
      qtyInitial: qty,
      qtyRemaining: qty,
      receivedAt: params.receivedAt,
      source: params.source,
      unitCostFcfa: params.unitCostFcfa,
    })
    .returning();
  if (!inserted) {
    throw new Error("L'insertion du lot n'a renvoyé aucune ligne");
  }

  await executor.insert(stockMovements).values({
    createdBy: params.userId ?? null,
    lotId: inserted.id,
    productId: params.productId,
    qty,
    reason: params.notes ?? null,
    referenceId: params.referenceId ?? null,
    referenceType: params.referenceType ?? "manual",
    type: "in",
    unitCostFcfa: params.unitCostFcfa,
  });

  return inserted;
};

/** Corrige la quantité restante d'un lot (inventaire, casse…) et trace l'écart. */
export const adjustLot = async (executor: Executor, params: AdjustLotParams) => {
  const reason = params.reason.trim();
  if (!reason) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Le motif de l'ajustement est obligatoire",
    });
  }
  const newQty = roundQty(params.newQty);
  if (newQty < 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La quantité ne peut pas être négative",
    });
  }

  const [lot] = await executor.select().from(stockLots).where(eq(stockLots.id, params.lotId));
  if (!lot) {
    throw new ORPCError("NOT_FOUND", { message: "Lot introuvable" });
  }
  await getActiveProduct(executor, lot.productId);

  const delta = roundQty(newQty - lot.qtyRemaining);
  if (Math.abs(delta) <= QTY_EPSILON) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La nouvelle quantité est identique",
    });
  }

  await executor.update(stockLots).set({ qtyRemaining: newQty }).where(eq(stockLots.id, lot.id));
  await executor.insert(stockMovements).values({
    createdBy: params.userId ?? null,
    lotId: lot.id,
    productId: lot.productId,
    qty: delta,
    reason,
    referenceType: "manual",
    type: "adjustment",
    unitCostFcfa: lot.unitCostFcfa,
  });

  return { delta, lotId: lot.id, qtyRemaining: newQty };
};

/** Lots d'un produit qui ont encore du stock, du plus ancien au plus récent (ordre FIFO). */
export const listAvailableLots = (executor: Executor, productId: string) =>
  executor
    .select()
    .from(stockLots)
    .where(and(eq(stockLots.productId, productId), gt(stockLots.qtyRemaining, QTY_EPSILON)))
    .orderBy(asc(stockLots.receivedAt), asc(stockLots.id));

export interface ReturnToLotsParams {
  productId: string;
  allocations: readonly { lotId: string; qty: number; unitCostFcfa: number }[];
  referenceType: MovementReferenceType;
  referenceId?: string | null;
  reason: string;
  userId?: string | null;
}

/** Remet des quantités dans les lots d'où elles étaient sorties (annulation d'une vente). */
export const returnToLots = async (executor: Executor, params: ReturnToLotsParams) => {
  if (params.allocations.length === 0) {
    return;
  }
  await Promise.all(
    params.allocations.map((allocation) =>
      executor
        .update(stockLots)
        .set({ qtyRemaining: sql`round(${stockLots.qtyRemaining} + ${allocation.qty}, 3)` })
        .where(eq(stockLots.id, allocation.lotId)),
    ),
  );
  await executor.insert(stockMovements).values(
    params.allocations.map((allocation) => ({
      createdBy: params.userId ?? null,
      lotId: allocation.lotId,
      productId: params.productId,
      qty: allocation.qty,
      reason: params.reason,
      referenceId: params.referenceId ?? null,
      referenceType: params.referenceType,
      type: "in" as const,
      unitCostFcfa: allocation.unitCostFcfa,
    })),
  );
};

/**
 * Prélève une quantité sur les lots les plus anciens (FIFO) et trace chaque sortie.
 * Rien n'est écrit si le stock est insuffisant.
 */
export const consumeFifo = async (
  executor: Executor,
  params: ConsumeFifoParams,
): Promise<LotAllocation[]> => {
  const requested = roundQty(params.qty);
  if (requested <= QTY_EPSILON) {
    throw new ORPCError("BAD_REQUEST", {
      message: "La quantité doit être supérieure à zéro",
    });
  }

  const lots = await listAvailableLots(executor, params.productId);
  const { allocations, missingQty } = planFifo(lots, requested);

  if (missingQty > QTY_EPSILON) {
    const available = roundQty(requested - missingQty);
    throw new ORPCError("BAD_REQUEST", {
      message: `Stock insuffisant : ${available} disponible(s) pour ${requested} demandé(s)`,
    });
  }

  await Promise.all(
    allocations.map((allocation) =>
      executor
        .update(stockLots)
        .set({ qtyRemaining: allocation.qtyLeft })
        .where(eq(stockLots.id, allocation.lotId)),
    ),
  );
  await executor.insert(stockMovements).values(
    allocations.map((allocation) => ({
      createdBy: params.userId ?? null,
      lotId: allocation.lotId,
      productId: params.productId,
      qty: -allocation.qty,
      reason: params.reason ?? null,
      referenceId: params.referenceId ?? null,
      referenceType: params.referenceType,
      type: "out" as const,
      unitCostFcfa: allocation.unitCostFcfa,
    })),
  );

  return allocations.map(({ lotId, qty, unitCostFcfa }) => ({
    lotId,
    qty,
    unitCostFcfa,
  }));
};

export const listLots = (executor: Executor, productId: string, includeEmpty: boolean) => {
  const conditions: SQL[] = [eq(stockLots.productId, productId)];
  if (!includeEmpty) {
    conditions.push(gt(stockLots.qtyRemaining, QTY_EPSILON));
  }
  return executor
    .select({
      ...getColumns(stockLots),
      orderId: purchaseOrders.id,
      orderReference: purchaseOrders.reference,
    })
    .from(stockLots)
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.id, stockLots.orderItemId))
    .leftJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.orderId))
    .where(and(...conditions))
    .orderBy(desc(stockLots.receivedAt), desc(stockLots.id));
};

export const listMovements = async (executor: Executor, filters: MovementFilters) => {
  const conditions: SQL[] = [];
  if (filters.productId) {
    conditions.push(eq(stockMovements.productId, filters.productId));
  }
  if (filters.type) {
    conditions.push(eq(stockMovements.type, filters.type));
  }
  if (filters.from) {
    conditions.push(gte(stockMovements.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(stockMovements.createdAt, filters.to));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [totals]] = await Promise.all([
    executor
      .select({
        authorName: user.name,
        createdAt: stockMovements.createdAt,
        id: stockMovements.id,
        lotCode: stockLots.lotCode,
        lotId: stockMovements.lotId,
        productId: stockMovements.productId,
        productName: products.name,
        productUnit: products.unit,
        qty: stockMovements.qty,
        reason: stockMovements.reason,
        referenceId: stockMovements.referenceId,
        referenceType: stockMovements.referenceType,
        type: stockMovements.type,
        unitCostFcfa: stockMovements.unitCostFcfa,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .innerJoin(stockLots, eq(stockLots.id, stockMovements.lotId))
      .leftJoin(user, eq(user.id, stockMovements.createdBy))
      .where(where)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    executor.select({ total: count() }).from(stockMovements).where(where),
  ]);

  return { items, total: totals?.total ?? 0 };
};
