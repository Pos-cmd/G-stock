import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { createdAt, id, ref, timestamp, updatedAt } from "../columns";

export const products = sqliteTable(
  "products",
  {
    id: id(),
    name: text("name").notNull().unique(),
    reference: text("reference"),
    category: text("category"),
    unit: text("unit").notNull().default("unité"),
    alertThreshold: real("alert_threshold").notNull().default(0),
    referencePriceRmb: real("reference_price_rmb"),
    suggestedSalePriceFcfa: integer("suggested_sale_price_fcfa"),
    notes: text("notes"),
    // Vente au détail : nombre de pièces dans une unité de stock (5 fils par carton…), et le
    // produit « pièce » qui reçoit les pièces quand on ouvre un carton.
    piecesPerUnit: integer("pieces_per_unit"),
    pieceProductId: ref("piece_product_id").references((): AnySQLiteColumn => products.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("products_category_idx").on(table.category)],
);

export const suppliers = sqliteTable("suppliers", {
  id: id(),
  name: text("name").notNull().unique(),
  contact: text("contact"),
  phone: text("phone"),
  country: text("country").notNull().default("Chine"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
