import { protectedProcedure } from "../index";
import {
  lotAdjustSchema,
  lotEntrySchema,
  lotListSchema,
  movementListSchema,
} from "../schemas/stock";
import { getStockSummary } from "../services/products";
import { adjustLot, createLot, listLots, listMovements } from "../services/stock";

export const stockRouter = {
  lots: {
    adjust: protectedProcedure
      .input(lotAdjustSchema)
      .handler(({ context, input }) =>
        context.db.transaction((tx) =>
          adjustLot(tx, { ...input, userId: context.session.user.id }),
        ),
      ),

    create: protectedProcedure.input(lotEntrySchema).handler(({ context, input }) =>
      context.db.transaction((tx) =>
        createLot(tx, {
          ...input,
          source: "initial",
          userId: context.session.user.id,
        }),
      ),
    ),

    list: protectedProcedure
      .input(lotListSchema)
      .handler(({ context, input }) => listLots(context.db, input.productId, input.includeEmpty)),
  },

  movements: {
    list: protectedProcedure
      .input(movementListSchema)
      .handler(({ context, input }) => listMovements(context.db, input)),
  },

  summary: protectedProcedure.handler(({ context }) => getStockSummary(context.db)),
};
