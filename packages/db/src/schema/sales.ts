import { PAYMENT_METHODS, PAYMENT_TYPES, SALE_STATUSES } from "@G-stock/core/enums";
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, timestamp, updatedAt } from "../columns";
import { user } from "./auth";
import { products } from "./catalog";
import { stockLots } from "./stock";

// Le solde dû d'un client se calcule (ventes − remises − paiements) : pas de colonne stockée.
export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("customers_name_idx").on(table.name)],
);

export const sales = sqliteTable(
  "sales",
  {
    id: id(),
    reference: text("reference").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleDate: timestamp("sale_date").notNull(),
    // Total brut des lignes ; les remises accordées ensuite sont dans sale_discounts.
    totalFcfa: integer("total_fcfa").notNull(),
    paymentType: text("payment_type", { enum: PAYMENT_TYPES }).notNull(),
    status: text("status", { enum: SALE_STATUSES }).notNull().default("active"),
    notes: text("notes"),
    // Annulation tracée : la vente reste dans l'historique, son stock revient dans ses lots.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sales_customer_idx").on(table.customerId),
    index("sales_date_idx").on(table.saleDate),
    index("sales_status_idx").on(table.status),
    check("sales_total_non_negative", sql`${table.totalFcfa} >= 0`),
  ],
);

/** Une ligne par produit vendu ; son coût vient des lots prélevés (sale_item_lots). */
export const saleItems = sqliteTable(
  "sale_items",
  {
    id: id(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    qty: real("qty").notNull(),
    unitPriceFcfa: integer("unit_price_fcfa").notNull(),
    // Coût de revient total de la ligne (somme des lots prélevés), figé à la vente.
    costFcfa: integer("cost_fcfa").notNull().default(0),
  },
  (table) => [
    index("sale_items_sale_idx").on(table.saleId),
    index("sale_items_product_idx").on(table.productId),
    check("sale_items_qty_positive", sql`${table.qty} > 0`),
  ],
);

/** Lots prélevés (FIFO) pour une ligne de vente : sert à la marge et à l'annulation. */
export const saleItemLots = sqliteTable(
  "sale_item_lots",
  {
    id: id(),
    saleItemId: integer("sale_item_id")
      .notNull()
      .references(() => saleItems.id, { onDelete: "cascade" }),
    lotId: integer("lot_id")
      .notNull()
      .references(() => stockLots.id, { onDelete: "restrict" }),
    qty: real("qty").notNull(),
    unitCostFcfa: integer("unit_cost_fcfa").notNull(),
  },
  (table) => [
    index("sale_item_lots_item_idx").on(table.saleItemId),
    index("sale_item_lots_lot_idx").on(table.lotId),
    check("sale_item_lots_qty_positive", sql`${table.qty} > 0`),
  ],
);

/** Remise accordée après la vente, toujours accompagnée d'un motif. */
export const saleDiscounts = sqliteTable(
  "sale_discounts",
  {
    id: id(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    discountDate: timestamp("discount_date").notNull(),
    amountFcfa: integer("amount_fcfa").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sale_discounts_sale_idx").on(table.saleId),
    check("sale_discounts_amount_positive", sql`${table.amountFcfa} > 0`),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "set null" }),
    paymentDate: timestamp("payment_date").notNull(),
    amountFcfa: integer("amount_fcfa").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("cash"),
    notes: text("notes"),
    // Paiement annulé (erreur de saisie, vente annulée) : il ne compte plus dans le solde.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("payments_customer_idx").on(table.customerId),
    index("payments_sale_idx").on(table.saleId),
    index("payments_date_idx").on(table.paymentDate),
    check("payments_amount_positive", sql`${table.amountFcfa} > 0`),
  ],
);
