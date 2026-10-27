import type { RouterClient } from "@orpc/server";

import { productsRouter } from "./products";
import { settingsRouter } from "./settings";
import { stockRouter } from "./stock";

export const appRouter = {
  products: productsRouter,
  settings: settingsRouter,
  stock: stockRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
