import { protectedProcedure } from "../index";
import { byIdSchema } from "../schemas/common";
import { supplierInputSchema, supplierUpdateSchema } from "../schemas/suppliers";
import {
  createSupplier,
  listSuppliers,
  removeSupplier,
  updateSupplier,
} from "../services/suppliers";

export const suppliersRouter = {
  create: protectedProcedure
    .input(supplierInputSchema)
    .handler(({ context, input }) => createSupplier(context.db, input)),

  list: protectedProcedure.handler(({ context }) => listSuppliers(context.db)),

  remove: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => removeSupplier(context.db, input.id)),

  update: protectedProcedure
    .input(supplierUpdateSchema)
    .handler(({ context, input: { id, ...data } }) => updateSupplier(context.db, id, data)),
};
