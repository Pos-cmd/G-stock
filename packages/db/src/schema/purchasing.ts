import { ALLOCATION_METHODS, PURCHASE_ORDER_STATUSES } from "@G-stock/core/enums";
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, timestamp, updatedAt } from "../columns";
import { products, suppliers } from "./catalog";

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: id(),
    reference: text("reference").notNull().unique(),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    orderDate: timestamp("order_date").notNull(),
    status: text("status", { enum: PURCHASE_ORDER_STATUSES }).notNull().default("draft"),
    // Taux figés à la commande : les modifier dans les réglages ne réécrit pas l'historique.
    rmbPerUsd: real("rmb_per_usd").notNull(),
    fcfaPerUsd: real("fcfa_per_usd").notNull(),
    freightCbm: real("freight_cbm").notNull().default(0),
    freightRatePerCbmFcfa: integer("freight_rate_per_cbm_fcfa").notNull().default(0),
    localTransportFcfa: integer("local_transport_fcfa").notNull().default(0),
    otherFeesFcfa: integer("other_fees_fcfa").notNull().default(0),
    allocationMethod: text("allocation_method", { enum: ALLOCATION_METHODS })
      .notNull()
      .default("proportional"),
    documentsFolder: text("documents_folder"),
    receivedAt: timestamp("received_at"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("purchase_orders_supplier_idx").on(table.supplierId),
    index("purchase_orders_date_idx").on(table.orderDate),
    index("purchase_orders_status_idx").on(table.status),
  ],
);

export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: id(),
    orderId: integer("order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    qty: real("qty").notNull(),
    unitPriceRmb: real("unit_price_rmb").notNull(),
    // Base de la répartition proportionnelle des frais de transport.
    trips: real("trips").notNull().default(1),
    transportShareFcfa: integer("transport_share_fcfa").notNull().default(0),
    unitCostFcfa: integer("unit_cost_fcfa").notNull().default(0),
  },
  (table) => [
    index("purchase_order_items_order_idx").on(table.orderId),
    index("purchase_order_items_product_idx").on(table.productId),
    check("purchase_order_items_qty_positive", sql`${table.qty} > 0`),
  ],
);
