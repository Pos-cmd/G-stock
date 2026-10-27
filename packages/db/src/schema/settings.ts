import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { updatedAt } from "../columns";

/** Réglages clé/valeur (taux de change, seuils…). Valeurs par défaut insérées par migration. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
