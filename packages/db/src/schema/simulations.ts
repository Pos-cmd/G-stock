import type { SimulationInput } from "@G-stock/core/simulation";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, ref, updatedAt } from "../columns";
import { user } from "./auth";
import { purchaseOrders } from "./purchasing";

/**
 * Simulation d'import enregistrée : les données saisies (taux, frais, lignes, prix de vente)
 * sont gardées telles quelles en JSON, les résultats se recalculent à l'affichage.
 */
export const simulations = sqliteTable(
  "simulations",
  {
    id: id(),
    name: text("name").notNull(),
    notes: text("notes"),
    data: text("data", { mode: "json" }).$type<SimulationInput>().notNull(),
    // Commande fournisseur créée à partir de cette simulation.
    purchaseOrderId: ref("purchase_order_id").references(() => purchaseOrders.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("simulations_updated_idx").on(table.updatedAt)],
);
