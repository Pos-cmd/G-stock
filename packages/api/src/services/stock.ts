import type { LotSource, MovementReferenceType } from "@G-stock/core/enums";
import { QTY_EPSILON, roundQty } from "@G-stock/core/stock";
import type { Executor } from "@G-stock/db";
import { user } from "@G-stock/db/schema/auth";
import { products } from "@G-stock/db/schema/catalog";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, gt, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { MovementFilters } from "../schemas/stock";

export interface CreateLotParams {
  productId: number;
  qty: number;
  unitCostFcfa: number;
  source: LotSource;
  receivedAt: Date;
  orderItemId?: number | null;
  notes?: string | null;
  userId?: string | null;
  referenceType?: MovementReferenceType;
  referenceId?: number | null;
}

export interface AdjustLotParams {
  lotId: number;
  newQty: number;
  reason: string;
  userId?: string | null;
}

export interface ConsumeFifoParams {
  productId: number;
  qty: number;
  referenceType: MovementReferenceType;
  referenceId?: number | null;
  reason?: string | null;
  userId?: string | null;
}

export interface LotAllocation {
  lotId: number;
  qty: number;
  unitCostFcfa: number;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

/** Ex. : LOT-20261026-0042 */
export const buildLotCode = (receivedAt: Date, lotId: number): string => {
  const day = `${receivedAt.getFullYear()}${pad(receivedAt.getMonth() + 1)}${pad(receivedAt.getDate())}`;
  return `LOT-${day}-${pad(lotId, 4)}`;
};

const getActiveProduct = async (executor: Executor, productId: number) => {
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

  const [inserted] = await executor
    .insert(stockLots)
    .values({
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

  const lotCode = buildLotCode(params.receivedAt, inserted.id);
  await executor.update(stockLots).set({ lotCode }).where(eq(stockLots.id, inserted.id));

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

  return { ...inserted, lotCode };
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

  const lots = await executor
    .select()
    .from(stockLots)
    .where(and(eq(stockLots.productId, params.productId), gt(stockLots.qtyRemaining, QTY_EPSILON)))
    .orderBy(asc(stockLots.receivedAt), asc(stockLots.id));

  const allocations: (LotAllocation & { qtyLeft: number })[] = [];
  let missing = requested;
  for (const lot of lots) {
    if (missing <= QTY_EPSILON) {
      break;
    }
    const taken = roundQty(Math.min(lot.qtyRemaining, missing));
    allocations.push({
      lotId: lot.id,
      qty: taken,
      qtyLeft: roundQty(lot.qtyRemaining - taken),
      unitCostFcfa: lot.unitCostFcfa,
    });
    missing = roundQty(missing - taken);
  }

  if (missing > QTY_EPSILON) {
    const available = roundQty(requested - missing);
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

export const listLots = (executor: Executor, productId: number, includeEmpty: boolean) => {
  const conditions: SQL[] = [eq(stockLots.productId, productId)];
  if (!includeEmpty) {
    conditions.push(gt(stockLots.qtyRemaining, QTY_EPSILON));
  }
  return executor
    .select()
    .from(stockLots)
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
