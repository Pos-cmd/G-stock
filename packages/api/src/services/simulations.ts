import { computeSimulation } from "@G-stock/core/simulation";
import type { Executor } from "@G-stock/db";
import { products } from "@G-stock/db/schema/catalog";
import { purchaseOrders } from "@G-stock/db/schema/purchasing";
import { simulations } from "@G-stock/db/schema/simulations";
import { ORPCError } from "@orpc/server";
import { desc, eq, inArray, sql } from "drizzle-orm";

import type { SimulationSaveInput } from "../schemas/simulations";
import { createProduct } from "./products";
import { createPurchaseOrder } from "./purchases";

type SimulationRow = typeof simulations.$inferSelect;

const getRow = async (executor: Executor, id: string): Promise<SimulationRow> => {
  const [row] = await executor.select().from(simulations).where(eq(simulations.id, id));
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Simulation introuvable" });
  }
  return row;
};

const orderReferences = async (executor: Executor, rows: readonly SimulationRow[]) => {
  const ids = rows.flatMap((row) => (row.purchaseOrderId ? [row.purchaseOrderId] : []));
  if (ids.length === 0) {
    return new Map<string, string>();
  }
  const orders = await executor
    .select({ id: purchaseOrders.id, reference: purchaseOrders.reference })
    .from(purchaseOrders)
    .where(inArray(purchaseOrders.id, ids));
  return new Map(orders.map((order) => [order.id, order.reference]));
};

export const listSimulations = async (executor: Executor) => {
  const rows = await executor
    .select()
    .from(simulations)
    .orderBy(desc(simulations.updatedAt), desc(simulations.id));
  const references = await orderReferences(executor, rows);
  return rows.map(({ data, ...row }) => {
    const result = computeSimulation(data);
    return {
      ...row,
      lineCount: data.lines.length,
      marginFcfa: result.marginFcfa,
      marginRate: result.marginRate,
      orderReference: row.purchaseOrderId ? (references.get(row.purchaseOrderId) ?? null) : null,
      revenueFcfa: result.revenueFcfa,
      totalCostFcfa: result.totalCostFcfa,
    };
  });
};

export const getSimulation = async (executor: Executor, id: string) => {
  const row = await getRow(executor, id);
  const references = await orderReferences(executor, [row]);
  return {
    ...row,
    orderReference: row.purchaseOrderId ? (references.get(row.purchaseOrderId) ?? null) : null,
    result: computeSimulation(row.data),
  };
};

export const createSimulation = async (
  executor: Executor,
  input: SimulationSaveInput,
  userId?: string | null,
) => {
  const [created] = await executor
    .insert(simulations)
    .values({ ...input, createdBy: userId ?? null })
    .returning();
  if (!created) {
    throw new Error("L'insertion de la simulation n'a renvoyé aucune ligne");
  }
  return created;
};

export const updateSimulation = async (
  executor: Executor,
  id: string,
  input: SimulationSaveInput,
) => {
  await getRow(executor, id);
  const [updated] = await executor
    .update(simulations)
    .set(input)
    .where(eq(simulations.id, id))
    .returning();
  return updated;
};

export const duplicateSimulation = async (
  executor: Executor,
  id: string,
  userId?: string | null,
) => {
  const source = await getRow(executor, id);
  const [copy] = await executor
    .insert(simulations)
    .values({
      createdBy: userId ?? null,
      data: source.data,
      name: `${source.name} (copie)`,
      notes: source.notes,
    })
    .returning();
  if (!copy) {
    throw new Error("La copie de la simulation n'a renvoyé aucune ligne");
  }
  return copy;
};

export const removeSimulation = async (executor: Executor, id: string) => {
  await getRow(executor, id);
  await executor.delete(simulations).where(eq(simulations.id, id));
  return { id };
};

const resolveProduct = async (
  executor: Executor,
  line: SimulationRow["data"]["lines"][number],
  salePriceFcfa: number | undefined,
): Promise<{ id: string; created: boolean }> => {
  if (line.productId) {
    const [product] = await executor
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, line.productId));
    if (!product) {
      throw new ORPCError("NOT_FOUND", {
        message: `Produit introuvable pour « ${line.label} »`,
      });
    }
    return { created: false, id: product.id };
  }
  const [existing] = await executor
    .select({ id: products.id })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${line.label})`);
  if (existing) {
    return { created: false, id: existing.id };
  }
  const created = await createProduct(executor, {
    alertThreshold: 0,
    category: null,
    name: line.label,
    notes: null,
    reference: null,
    referencePriceRmb: line.pricingBasis === "weight" ? null : line.unitPriceRmb,
    suggestedSalePriceFcfa: salePriceFcfa ?? null,
    unit: line.unit,
  });
  return { created: true, id: created.id };
};

/**
 * Transforme une simulation en commande fournisseur (brouillon). Une ligne sans produit est
 * rattachée au produit de même nom, ou crée ce produit avec le prix de vente simulé comme prix
 * conseillé. Les frais libres deviennent des « autres frais » de l'estimation.
 * À appeler dans une transaction.
 */
export const convertSimulationToOrder = async (executor: Executor, id: string) => {
  const simulation = await getRow(executor, id);
  if (simulation.purchaseOrderId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cette simulation a déjà été transformée en commande",
    });
  }
  const { data } = simulation;
  const result = computeSimulation(data);

  const createdProducts: string[] = [];
  const productIds: string[] = [];
  for (const [index, line] of data.lines.entries()) {
    // Séquentiel : deux lignes du même libellé doivent retrouver le même produit.
    // oxlint-disable-next-line no-await-in-loop
    const productId = await resolveProduct(executor, line, result.lines[index]?.salePriceFcfa);
    if (productId.created) {
      createdProducts.push(line.label);
    }
    productIds.push(productId.id);
  }

  const order = await createPurchaseOrder(executor, {
    allocationMethod: data.freightAllocation,
    fcfaPerUsd: data.rates.fcfaPerUsd,
    freightCbm: data.freightCbm,
    freightRatePerCbmFcfa: data.freightRatePerCbmFcfa,
    items: data.lines.map((line, index) => ({
      pricingBasis: line.pricingBasis ?? "unit",
      productId: productIds[index] ?? "",
      qty: line.qty,
      trips: line.trips,
      unitPriceRmb: line.unitPriceRmb,
      weightTons: line.weightTons ?? null,
    })),
    localTransportFcfa: 0,
    notes: `Créée depuis la simulation « ${simulation.name} »`,
    orderDate: new Date(),
    otherFeesFcfa: result.fees.reduce((sum, fee) => sum + fee.amountFcfa, 0),
    rmbPerUsd: data.rates.rmbPerUsd,
    supplierId: null,
  });
  await executor
    .update(simulations)
    .set({ purchaseOrderId: order.id })
    .where(eq(simulations.id, simulation.id));

  return { createdProducts, orderId: order.id, reference: order.reference };
};
