import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { updatedAt } from "../columns";

/** Réglages clé/valeur (taux de change, seuils…). Valeurs par défaut insérées par migration. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

/**
 * Dernier numéro attribué par série (ex. « CF-2026 », « V-2026 »). Le compteur ne recule
 * jamais : un numéro de commande ou de vente supprimée n'est pas réutilisé.
 */
export const referenceSequences = sqliteTable("reference_sequences", {
  series: text("series").primaryKey(),
  lastNumber: integer("last_number").notNull(),
  updatedAt: updatedAt(),
});
