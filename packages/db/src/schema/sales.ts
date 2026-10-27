import { PAYMENT_METHODS, PAYMENT_TYPES } from "@G-stock/core/enums";
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, timestamp, updatedAt } from "../columns";
import { user } from "./auth";
import { products } from "./catalog";
import { stockLots } from "./stock";

// Le solde dû d'un client se calcule (ventes à crédit − paiements) : pas de colonne stockée.
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
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    saleDate: timestamp("sale_date").notNull(),
    totalFcfa: integer("total_fcfa").notNull(),
    paymentType: text("payment_type", { enum: PAYMENT_TYPES }).notNull(),
    amountPaidFcfa: integer("amount_paid_fcfa").notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sales_customer_idx").on(table.customerId),
    index("sales_date_idx").on(table.saleDate),
    check("sales_total_non_negative", sql`${table.totalFcfa} >= 0`),
  ],
);

// Une ligne de vente prélevée sur plusieurs lots (FIFO) produit une ligne par lot.
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
    lotId: integer("lot_id")
      .notNull()
      .references(() => stockLots.id, { onDelete: "restrict" }),
    qty: real("qty").notNull(),
    unitPriceFcfa: integer("unit_price_fcfa").notNull(),
    // Coût du lot figé au moment de la vente, pour le calcul de marge.
    unitCostFcfa: integer("unit_cost_fcfa").notNull(),
  },
  (table) => [
    index("sale_items_sale_idx").on(table.saleId),
    index("sale_items_product_idx").on(table.productId),
    index("sale_items_lot_idx").on(table.lotId),
    check("sale_items_qty_positive", sql`${table.qty} > 0`),
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
