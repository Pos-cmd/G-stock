import { LOT_SOURCES, MOVEMENT_REFERENCE_TYPES, MOVEMENT_TYPES } from "@G-stock/core/enums";
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, ref, timestamp } from "../columns";
import { user } from "./auth";
import { products } from "./catalog";
import { purchaseOrderItems } from "./purchasing";

export const stockLots = sqliteTable(
  "stock_lots",
  {
    id: id(),
    productId: ref("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    orderItemId: ref("order_item_id").references(() => purchaseOrderItems.id, {
      onDelete: "set null",
    }),
    lotCode: text("lot_code").unique(),
    source: text("source", { enum: LOT_SOURCES }).notNull(),
    qtyInitial: real("qty_initial").notNull(),
    qtyRemaining: real("qty_remaining").notNull(),
    unitCostFcfa: integer("unit_cost_fcfa").notNull(),
    receivedAt: timestamp("received_at").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => [
    // Ordre FIFO : lots d'un produit triés par date de réception.
    index("stock_lots_product_received_idx").on(table.productId, table.receivedAt),
    index("stock_lots_order_item_idx").on(table.orderItemId),
    check("stock_lots_qty_initial_positive", sql`${table.qtyInitial} > 0`),
    check("stock_lots_qty_remaining_non_negative", sql`${table.qtyRemaining} >= 0`),
    check("stock_lots_unit_cost_non_negative", sql`${table.unitCostFcfa} >= 0`),
  ],
);

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    productId: ref("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    lotId: ref("lot_id")
      .notNull()
      .references(() => stockLots.id, { onDelete: "restrict" }),
    type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
    // Signé : positif pour une entrée, négatif pour une sortie.
    qty: real("qty").notNull(),
    unitCostFcfa: integer("unit_cost_fcfa").notNull(),
    reason: text("reason"),
    referenceType: text("reference_type", { enum: MOVEMENT_REFERENCE_TYPES })
      .notNull()
      .default("manual"),
    referenceId: ref("reference_id"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("stock_movements_product_date_idx").on(table.productId, table.createdAt),
    index("stock_movements_lot_idx").on(table.lotId),
    index("stock_movements_date_idx").on(table.createdAt),
    index("stock_movements_reference_idx").on(table.referenceType, table.referenceId),
  ],
);
