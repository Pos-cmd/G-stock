import type { RouterClient } from "@orpc/server";

import { comparisonRouter } from "./comparison";
import { customersRouter } from "./customers";
import { documentsRouter } from "./documents";
import { productsRouter } from "./products";
import { purchasesRouter } from "./purchases";
import { paymentsRouter, salesRouter } from "./sales";
import { settingsRouter } from "./settings";
import { simulationsRouter } from "./simulations";
import { stockRouter } from "./stock";
import { suppliersRouter } from "./suppliers";

export const appRouter = {
  comparison: comparisonRouter,
  customers: customersRouter,
  documents: documentsRouter,
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
