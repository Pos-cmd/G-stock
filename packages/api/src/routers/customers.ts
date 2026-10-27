import { protectedProcedure } from "../index";
import { byIdSchema } from "../schemas/common";
import {
  customerInputSchema,
  customerListSchema,
  customerUpdateSchema,
} from "../schemas/customers";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
  updateCustomer,
} from "../services/customers";

export const customersRouter = {
  create: protectedProcedure
    .input(customerInputSchema)
    .handler(({ context, input }) => createCustomer(context.db, input)),

  get: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => getCustomer(context.db, input.id)),

  list: protectedProcedure
    .input(customerListSchema)
    .handler(({ context, input }) => listCustomers(context.db, input)),

  remove: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => removeCustomer(context.db, input.id)),

  update: protectedProcedure
    .input(customerUpdateSchema)
    .handler(({ context, input: { id, ...data } }) => updateCustomer(context.db, id, data)),
};
