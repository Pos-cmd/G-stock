import { z } from "zod";

import { protectedProcedure } from "../index";
import { byIdSchema, idSchema } from "../schemas/common";
import {
  paymentCancelSchema,
  paymentInputSchema,
  productSalesSummarySchema,
  saleCancelSchema,
  saleDiscountSchema,
  saleInputSchema,
  saleListSchema,
  saleQuoteSchema,
} from "../schemas/sales";
import {
  addSaleDiscount,
  cancelPayment,
  cancelSale,
  createPayment,
  createSale,
  getSale,
  listPayments,
  listSales,
  productSalesSummary,
  quoteSale,
  salesSummary,
} from "../services/sales";

export const salesRouter = {
  addDiscount: protectedProcedure
    .input(saleDiscountSchema)
    .handler(({ context, input }) => addSaleDiscount(context.db, input, context.session.user.id)),

  cancel: protectedProcedure
    .input(saleCancelSchema)
    .handler(({ context, input }) =>
      context.db.transaction((tx) => cancelSale(tx, input, context.session.user.id)),
    ),

  create: protectedProcedure
    .input(saleInputSchema)
    .handler(({ context, input }) =>
      context.db.transaction((tx) => createSale(tx, input, context.session.user.id)),
    ),

  get: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => getSale(context.db, input.id)),

  list: protectedProcedure
    .input(saleListSchema)
    .handler(({ context, input }) => listSales(context.db, input)),

  productSummary: protectedProcedure
    .input(productSalesSummarySchema)
    .handler(({ context, input }) => productSalesSummary(context.db, input)),

  quote: protectedProcedure
    .input(saleQuoteSchema)
    .handler(({ context, input }) => quoteSale(context.db, input.lines)),

  summary: protectedProcedure.handler(({ context }) => salesSummary(context.db)),
};

export const paymentsRouter = {
  cancel: protectedProcedure
    .input(paymentCancelSchema)
    .handler(({ context, input }) => cancelPayment(context.db, input)),

  create: protectedProcedure
    .input(paymentInputSchema)
    .handler(({ context, input }) => createPayment(context.db, input, context.session.user.id)),

  list: protectedProcedure
    .input(z.object({ customerId: idSchema }))
    .handler(({ context, input }) => listPayments(context.db, input.customerId)),
};
