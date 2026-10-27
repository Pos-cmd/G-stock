import { protectedProcedure } from "../index";
import { comparisonSchema } from "../schemas/comparison";
import { getComparison } from "../services/comparison";

export const comparisonRouter = {
  get: protectedProcedure
    .input(comparisonSchema)
    .handler(({ context, input }) => getComparison(context.db, input.items)),
};
