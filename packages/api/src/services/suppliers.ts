import type { Executor } from "@G-stock/db";
import { suppliers } from "@G-stock/db/schema/catalog";
import { purchaseOrders } from "@G-stock/db/schema/purchasing";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, max, ne, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { z } from "zod";

import type { supplierInputSchema } from "../schemas/suppliers";

type SupplierInput = z.output<typeof supplierInputSchema>;

export const listSuppliers = (executor: Executor) =>
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
