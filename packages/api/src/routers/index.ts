import type { RouterClient } from "@orpc/server";

import { customersRouter } from "./customers";
import { productsRouter } from "./products";
import { purchasesRouter } from "./purchases";
import { paymentsRouter, salesRouter } from "./sales";
import { settingsRouter } from "./settings";
import { simulationsRouter } from "./simulations";
import { stockRouter } from "./stock";
import { suppliersRouter } from "./suppliers";

export const appRouter = {
  customers: customersRouter,
  payments: paymentsRouter,
  products: productsRouter,
  purchases: purchasesRouter,
  sales: salesRouter,
  settings: settingsRouter,
  simulations: simulationsRouter,
  stock: stockRouter,
  suppliers: suppliersRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
