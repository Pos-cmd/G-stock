import { protectedProcedure } from "../index";
import { byIdSchema } from "../schemas/common";
import { productInputSchema, productListSchema, productUpdateSchema } from "../schemas/products";
import {
  createProduct,
  getProduct,
  listCategories,
  listProducts,
  removeProduct,
  setProductArchived,
  updateProduct,
} from "../services/products";

export const productsRouter = {
  archive: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => setProductArchived(context.db, input.id, true)),

  categories: protectedProcedure.handler(({ context }) => listCategories(context.db)),

  create: protectedProcedure
    .input(productInputSchema)
    .handler(({ context, input }) => createProduct(context.db, input)),

  get: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => getProduct(context.db, input.id)),

  list: protectedProcedure
    .input(productListSchema)
    .handler(({ context, input }) => listProducts(context.db, input)),

  remove: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => removeProduct(context.db, input.id)),

  restore: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => setProductArchived(context.db, input.id, false)),

  update: protectedProcedure
    .input(productUpdateSchema)
    .handler(({ context, input: { id, ...data } }) => updateProduct(context.db, id, data)),
};
