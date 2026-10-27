import type { RouterClient } from "@orpc/server";

import { productsRouter } from "./products";
import { purchasesRouter } from "./purchases";
import { settingsRouter } from "./settings";
import { stockRouter } from "./stock";
import { suppliersRouter } from "./suppliers";

export const appRouter = {
  products: productsRouter,
  purchases: purchasesRouter,
  settings: settingsRouter,
  stock: stockRouter,
  suppliers: suppliersRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
