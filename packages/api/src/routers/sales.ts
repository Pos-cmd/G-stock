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
  salesActivity,
  salesByHour,
  salesSummary,
} from "../services/sales";

const MAX_ACTIVITY_DAYS = 371;

export const salesRouter = {
  activity: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(MAX_ACTIVITY_DAYS) }))
    .handler(({ context, input }) => salesActivity(context.db, input.days)),

  addDiscount: protectedProcedure
    .input(saleDiscountSchema)
    .handler(({ context, input }) => addSaleDiscount(context.db, input, context.session.user.id)),

  byHour: protectedProcedure.handler(({ context }) => salesByHour(context.db)),

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
