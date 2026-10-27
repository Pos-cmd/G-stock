-- Identifiants : entiers auto-incrémentés -> UUID v7 (texte), sans perte de données.
-- Chaque ancien identifiant reçoit un UUID qui garde l'ordre d'origine ; tous les liens
-- (clés étrangères, références libres, produits des simulations) sont traduits.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `__uuid_products` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_products` (`old`, `new`) SELECT `id`, '019b76da-a800-7001-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `products`;
--> statement-breakpoint
CREATE TABLE `__uuid_suppliers` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_suppliers` (`old`, `new`) SELECT `id`, '019b76da-a800-7002-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `suppliers`;
--> statement-breakpoint
CREATE TABLE `__uuid_customers` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_customers` (`old`, `new`) SELECT `id`, '019b76da-a800-7003-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `customers`;
--> statement-breakpoint
CREATE TABLE `__uuid_purchase_orders` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_purchase_orders` (`old`, `new`) SELECT `id`, '019b76da-a800-7004-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `purchase_orders`;
--> statement-breakpoint
CREATE TABLE `__uuid_purchase_order_items` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_purchase_order_items` (`old`, `new`) SELECT `id`, '019b76da-a800-7005-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `purchase_order_items`;
--> statement-breakpoint
CREATE TABLE `__uuid_purchase_order_fees` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_purchase_order_fees` (`old`, `new`) SELECT `id`, '019b76da-a800-7006-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `purchase_order_fees`;
--> statement-breakpoint
CREATE TABLE `__uuid_stock_lots` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_stock_lots` (`old`, `new`) SELECT `id`, '019b76da-a800-7007-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `stock_lots`;
--> statement-breakpoint
CREATE TABLE `__uuid_stock_movements` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_stock_movements` (`old`, `new`) SELECT `id`, '019b76da-a800-7008-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `stock_movements`;
--> statement-breakpoint
CREATE TABLE `__uuid_sales` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_sales` (`old`, `new`) SELECT `id`, '019b76da-a800-7009-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `sales`;
--> statement-breakpoint
CREATE TABLE `__uuid_sale_items` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_sale_items` (`old`, `new`) SELECT `id`, '019b76da-a800-700a-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `sale_items`;
--> statement-breakpoint
CREATE TABLE `__uuid_sale_item_lots` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_sale_item_lots` (`old`, `new`) SELECT `id`, '019b76da-a800-700b-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `sale_item_lots`;
--> statement-breakpoint
CREATE TABLE `__uuid_sale_discounts` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_sale_discounts` (`old`, `new`) SELECT `id`, '019b76da-a800-700c-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `sale_discounts`;
--> statement-breakpoint
CREATE TABLE `__uuid_payments` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_payments` (`old`, `new`) SELECT `id`, '019b76da-a800-700d-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `payments`;
--> statement-breakpoint
CREATE TABLE `__uuid_simulations` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_simulations` (`old`, `new`) SELECT `id`, '019b76da-a800-700e-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `simulations`;
--> statement-breakpoint
CREATE TABLE `__uuid_documents` (`old` integer PRIMARY KEY, `new` text NOT NULL UNIQUE);
--> statement-breakpoint
INSERT INTO `__uuid_documents` (`old`, `new`) SELECT `id`, '019b76da-a800-700f-8' || substr(printf('%015x', `id`), 1, 3) || '-' || substr(printf('%015x', `id`), 4, 12) FROM `documents`;
--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`reference` text,
	`category` text,
	`unit` text DEFAULT 'unité' NOT NULL,
	`alert_threshold` real DEFAULT 0 NOT NULL,
	`reference_price_rmb` real,
	`suggested_sale_price_fcfa` integer,
	`notes` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);;
--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`contact` text,
	`phone` text,
	`country` text DEFAULT 'Chine' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);;
--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);;
--> statement-breakpoint
CREATE TABLE `__new_purchase_orders` (
	`id` text PRIMARY KEY,
	`reference` text NOT NULL UNIQUE,
	`supplier_id` text,
	`order_date` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rmb_per_usd` real NOT NULL,
	`fcfa_per_usd` real NOT NULL,
	`freight_cbm` real DEFAULT 0 NOT NULL,
	`freight_rate_per_cbm_fcfa` integer DEFAULT 0 NOT NULL,
	`local_transport_fcfa` integer DEFAULT 0 NOT NULL,
	`other_fees_fcfa` integer DEFAULT 0 NOT NULL,
	`allocation_method` text DEFAULT 'proportional' NOT NULL,
	`documents_folder` text,
	`arrived_at` integer,
	`container_number` text,
	`bill_of_lading` text,
	`forwarder` text,
	`received_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_purchase_orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT
);;
--> statement-breakpoint
CREATE TABLE `__new_purchase_order_items` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price_rmb` real NOT NULL,
	`pricing_basis` text DEFAULT 'unit' NOT NULL,
	`weight_tons` real,
	`qty_received` real,
	`trips` real DEFAULT 1 NOT NULL,
	`transport_share_fcfa` integer DEFAULT 0 NOT NULL,
	`unit_cost_fcfa` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_purchase_order_items_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_purchase_order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "purchase_order_items_qty_positive" CHECK("qty" > 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_purchase_order_fees` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'fcfa' NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`allocation_method` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_purchase_order_fees_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT "purchase_order_fees_amount_non_negative" CHECK("amount" >= 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_stock_lots` (
	`id` text PRIMARY KEY,
	`product_id` text NOT NULL,
	`order_item_id` text,
	`lot_code` text UNIQUE,
	`source` text NOT NULL,
	`qty_initial` real NOT NULL,
	`qty_remaining` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	`received_at` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_stock_lots_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_lots_order_item_id_purchase_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE SET NULL,
	CONSTRAINT "stock_lots_qty_initial_positive" CHECK("qty_initial" > 0),
	CONSTRAINT "stock_lots_qty_remaining_non_negative" CHECK("qty_remaining" >= 0),
	CONSTRAINT "stock_lots_unit_cost_non_negative" CHECK("unit_cost_fcfa" >= 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_stock_movements` (
	`id` text PRIMARY KEY,
	`product_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`type` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	`reason` text,
	`reference_type` text DEFAULT 'manual' NOT NULL,
	`reference_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_stock_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);;
--> statement-breakpoint
CREATE TABLE `__new_sales` (
	`id` text PRIMARY KEY,
	`reference` text NOT NULL UNIQUE,
	`customer_id` text NOT NULL,
	`sale_date` integer NOT NULL,
	`total_fcfa` integer NOT NULL,
	`payment_type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`cancelled_at` integer,
	`cancel_reason` text,
	`cancelled_by` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_sales_cancelled_by_user_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_sales_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sales_total_non_negative" CHECK("total_fcfa" >= 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_sale_items` (
	`id` text PRIMARY KEY,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price_fcfa` integer NOT NULL,
	`cost_fcfa` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_sale_items_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_items_qty_positive" CHECK("qty" > 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_sale_item_lots` (
	`id` text PRIMARY KEY,
	`sale_item_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	CONSTRAINT `fk_sale_item_lots_sale_item_id_sale_items_id_fk` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_item_lots_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_item_lots_qty_positive" CHECK("qty" > 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_sale_discounts` (
	`id` text PRIMARY KEY,
	`sale_id` text NOT NULL,
	`discount_date` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sale_discounts_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_discounts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sale_discounts_amount_positive" CHECK("amount_fcfa" > 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY,
	`customer_id` text NOT NULL,
	`sale_id` text,
	`payment_date` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`notes` text,
	`cancelled_at` integer,
	`cancel_reason` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_payments_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_payments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "payments_amount_positive" CHECK("amount_fcfa" > 0)
);;
--> statement-breakpoint
CREATE TABLE `__new_simulations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`notes` text,
	`data` text NOT NULL,
	`purchase_order_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_simulations_purchase_order_id_purchase_orders_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_simulations_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);;
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`reference_type` text,
	`reference_id` text,
	`file_path` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);;
--> statement-breakpoint
INSERT INTO `__new_products` (`id`, `name`, `reference`, `category`, `unit`, `alert_threshold`, `reference_price_rmb`, `suggested_sale_price_fcfa`, `notes`, `archived_at`, `created_at`, `updated_at`) SELECT (SELECT `new` FROM `__uuid_products` WHERE `old` = `products`.`id`), `products`.`name`, `products`.`reference`, `products`.`category`, `products`.`unit`, `products`.`alert_threshold`, `products`.`reference_price_rmb`, `products`.`suggested_sale_price_fcfa`, `products`.`notes`, `products`.`archived_at`, `products`.`created_at`, `products`.`updated_at` FROM `products`;
--> statement-breakpoint
INSERT INTO `__new_suppliers` (`id`, `name`, `contact`, `phone`, `country`, `notes`, `created_at`, `updated_at`) SELECT (SELECT `new` FROM `__uuid_suppliers` WHERE `old` = `suppliers`.`id`), `suppliers`.`name`, `suppliers`.`contact`, `suppliers`.`phone`, `suppliers`.`country`, `suppliers`.`notes`, `suppliers`.`created_at`, `suppliers`.`updated_at` FROM `suppliers`;
--> statement-breakpoint
INSERT INTO `__new_customers` (`id`, `name`, `phone`, `address`, `notes`, `created_at`, `updated_at`) SELECT (SELECT `new` FROM `__uuid_customers` WHERE `old` = `customers`.`id`), `customers`.`name`, `customers`.`phone`, `customers`.`address`, `customers`.`notes`, `customers`.`created_at`, `customers`.`updated_at` FROM `customers`;
--> statement-breakpoint
INSERT INTO `__new_purchase_orders` (`id`, `reference`, `supplier_id`, `order_date`, `status`, `rmb_per_usd`, `fcfa_per_usd`, `freight_cbm`, `freight_rate_per_cbm_fcfa`, `local_transport_fcfa`, `other_fees_fcfa`, `allocation_method`, `documents_folder`, `arrived_at`, `container_number`, `bill_of_lading`, `forwarder`, `received_at`, `notes`, `created_at`, `updated_at`) SELECT (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `purchase_orders`.`id`), `purchase_orders`.`reference`, (SELECT `new` FROM `__uuid_suppliers` WHERE `old` = `purchase_orders`.`supplier_id`), `purchase_orders`.`order_date`, `purchase_orders`.`status`, `purchase_orders`.`rmb_per_usd`, `purchase_orders`.`fcfa_per_usd`, `purchase_orders`.`freight_cbm`, `purchase_orders`.`freight_rate_per_cbm_fcfa`, `purchase_orders`.`local_transport_fcfa`, `purchase_orders`.`other_fees_fcfa`, `purchase_orders`.`allocation_method`, `purchase_orders`.`documents_folder`, `purchase_orders`.`arrived_at`, `purchase_orders`.`container_number`, `purchase_orders`.`bill_of_lading`, `purchase_orders`.`forwarder`, `purchase_orders`.`received_at`, `purchase_orders`.`notes`, `purchase_orders`.`created_at`, `purchase_orders`.`updated_at` FROM `purchase_orders`;
--> statement-breakpoint
INSERT INTO `__new_purchase_order_items` (`id`, `order_id`, `product_id`, `qty`, `unit_price_rmb`, `pricing_basis`, `weight_tons`, `qty_received`, `trips`, `transport_share_fcfa`, `unit_cost_fcfa`) SELECT (SELECT `new` FROM `__uuid_purchase_order_items` WHERE `old` = `purchase_order_items`.`id`), (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `purchase_order_items`.`order_id`), (SELECT `new` FROM `__uuid_products` WHERE `old` = `purchase_order_items`.`product_id`), `purchase_order_items`.`qty`, `purchase_order_items`.`unit_price_rmb`, `purchase_order_items`.`pricing_basis`, `purchase_order_items`.`weight_tons`, `purchase_order_items`.`qty_received`, `purchase_order_items`.`trips`, `purchase_order_items`.`transport_share_fcfa`, `purchase_order_items`.`unit_cost_fcfa` FROM `purchase_order_items`;
--> statement-breakpoint
INSERT INTO `__new_purchase_order_fees` (`id`, `order_id`, `label`, `amount`, `currency`, `amount_fcfa`, `allocation_method`, `created_at`) SELECT (SELECT `new` FROM `__uuid_purchase_order_fees` WHERE `old` = `purchase_order_fees`.`id`), (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `purchase_order_fees`.`order_id`), `purchase_order_fees`.`label`, `purchase_order_fees`.`amount`, `purchase_order_fees`.`currency`, `purchase_order_fees`.`amount_fcfa`, `purchase_order_fees`.`allocation_method`, `purchase_order_fees`.`created_at` FROM `purchase_order_fees`;
--> statement-breakpoint
INSERT INTO `__new_stock_lots` (`id`, `product_id`, `order_item_id`, `lot_code`, `source`, `qty_initial`, `qty_remaining`, `unit_cost_fcfa`, `received_at`, `notes`, `created_at`) SELECT (SELECT `new` FROM `__uuid_stock_lots` WHERE `old` = `stock_lots`.`id`), (SELECT `new` FROM `__uuid_products` WHERE `old` = `stock_lots`.`product_id`), (SELECT `new` FROM `__uuid_purchase_order_items` WHERE `old` = `stock_lots`.`order_item_id`), `stock_lots`.`lot_code`, `stock_lots`.`source`, `stock_lots`.`qty_initial`, `stock_lots`.`qty_remaining`, `stock_lots`.`unit_cost_fcfa`, `stock_lots`.`received_at`, `stock_lots`.`notes`, `stock_lots`.`created_at` FROM `stock_lots`;
--> statement-breakpoint
INSERT INTO `__new_stock_movements` (`id`, `product_id`, `lot_id`, `type`, `qty`, `unit_cost_fcfa`, `reason`, `reference_type`, `reference_id`, `created_by`, `created_at`) SELECT (SELECT `new` FROM `__uuid_stock_movements` WHERE `old` = `stock_movements`.`id`), (SELECT `new` FROM `__uuid_products` WHERE `old` = `stock_movements`.`product_id`), (SELECT `new` FROM `__uuid_stock_lots` WHERE `old` = `stock_movements`.`lot_id`), `stock_movements`.`type`, `stock_movements`.`qty`, `stock_movements`.`unit_cost_fcfa`, `stock_movements`.`reason`, `stock_movements`.`reference_type`, CASE `stock_movements`.`reference_type` WHEN 'purchase_order' THEN (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `stock_movements`.`reference_id`) WHEN 'sale' THEN (SELECT `new` FROM `__uuid_sales` WHERE `old` = `stock_movements`.`reference_id`) ELSE NULL END, `stock_movements`.`created_by`, `stock_movements`.`created_at` FROM `stock_movements`;
--> statement-breakpoint
INSERT INTO `__new_sales` (`id`, `reference`, `customer_id`, `sale_date`, `total_fcfa`, `payment_type`, `status`, `notes`, `cancelled_at`, `cancel_reason`, `cancelled_by`, `created_by`, `created_at`) SELECT (SELECT `new` FROM `__uuid_sales` WHERE `old` = `sales`.`id`), `sales`.`reference`, (SELECT `new` FROM `__uuid_customers` WHERE `old` = `sales`.`customer_id`), `sales`.`sale_date`, `sales`.`total_fcfa`, `sales`.`payment_type`, `sales`.`status`, `sales`.`notes`, `sales`.`cancelled_at`, `sales`.`cancel_reason`, `sales`.`cancelled_by`, `sales`.`created_by`, `sales`.`created_at` FROM `sales`;
--> statement-breakpoint
INSERT INTO `__new_sale_items` (`id`, `sale_id`, `product_id`, `qty`, `unit_price_fcfa`, `cost_fcfa`) SELECT (SELECT `new` FROM `__uuid_sale_items` WHERE `old` = `sale_items`.`id`), (SELECT `new` FROM `__uuid_sales` WHERE `old` = `sale_items`.`sale_id`), (SELECT `new` FROM `__uuid_products` WHERE `old` = `sale_items`.`product_id`), `sale_items`.`qty`, `sale_items`.`unit_price_fcfa`, `sale_items`.`cost_fcfa` FROM `sale_items`;
--> statement-breakpoint
INSERT INTO `__new_sale_item_lots` (`id`, `sale_item_id`, `lot_id`, `qty`, `unit_cost_fcfa`) SELECT (SELECT `new` FROM `__uuid_sale_item_lots` WHERE `old` = `sale_item_lots`.`id`), (SELECT `new` FROM `__uuid_sale_items` WHERE `old` = `sale_item_lots`.`sale_item_id`), (SELECT `new` FROM `__uuid_stock_lots` WHERE `old` = `sale_item_lots`.`lot_id`), `sale_item_lots`.`qty`, `sale_item_lots`.`unit_cost_fcfa` FROM `sale_item_lots`;
--> statement-breakpoint
INSERT INTO `__new_sale_discounts` (`id`, `sale_id`, `discount_date`, `amount_fcfa`, `reason`, `created_by`, `created_at`) SELECT (SELECT `new` FROM `__uuid_sale_discounts` WHERE `old` = `sale_discounts`.`id`), (SELECT `new` FROM `__uuid_sales` WHERE `old` = `sale_discounts`.`sale_id`), `sale_discounts`.`discount_date`, `sale_discounts`.`amount_fcfa`, `sale_discounts`.`reason`, `sale_discounts`.`created_by`, `sale_discounts`.`created_at` FROM `sale_discounts`;
--> statement-breakpoint
INSERT INTO `__new_payments` (`id`, `customer_id`, `sale_id`, `payment_date`, `amount_fcfa`, `method`, `notes`, `cancelled_at`, `cancel_reason`, `created_by`, `created_at`) SELECT (SELECT `new` FROM `__uuid_payments` WHERE `old` = `payments`.`id`), (SELECT `new` FROM `__uuid_customers` WHERE `old` = `payments`.`customer_id`), (SELECT `new` FROM `__uuid_sales` WHERE `old` = `payments`.`sale_id`), `payments`.`payment_date`, `payments`.`amount_fcfa`, `payments`.`method`, `payments`.`notes`, `payments`.`cancelled_at`, `payments`.`cancel_reason`, `payments`.`created_by`, `payments`.`created_at` FROM `payments`;
--> statement-breakpoint
INSERT INTO `__new_simulations` (`id`, `name`, `notes`, `data`, `purchase_order_id`, `created_by`, `created_at`, `updated_at`) SELECT (SELECT `new` FROM `__uuid_simulations` WHERE `old` = `simulations`.`id`), `simulations`.`name`, `simulations`.`notes`, `simulations`.`data`, (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `simulations`.`purchase_order_id`), `simulations`.`created_by`, `simulations`.`created_at`, `simulations`.`updated_at` FROM `simulations`;
--> statement-breakpoint
INSERT INTO `__new_documents` (`id`, `type`, `title`, `reference_type`, `reference_id`, `file_path`, `created_at`) SELECT (SELECT `new` FROM `__uuid_documents` WHERE `old` = `documents`.`id`), `documents`.`type`, `documents`.`title`, `documents`.`reference_type`, CASE `documents`.`reference_type` WHEN 'purchase_order' THEN (SELECT `new` FROM `__uuid_purchase_orders` WHERE `old` = `documents`.`reference_id`) WHEN 'sale' THEN (SELECT `new` FROM `__uuid_sales` WHERE `old` = `documents`.`reference_id`) WHEN 'simulation' THEN (SELECT `new` FROM `__uuid_simulations` WHERE `old` = `documents`.`reference_id`) ELSE NULL END, `documents`.`file_path`, `documents`.`created_at` FROM `documents`;
--> statement-breakpoint
UPDATE `__new_simulations` SET `data` = json_set(`data`, '$.lines', (SELECT json_group_array(CASE WHEN json_type(`line`.`value`, '$.productId') = 'integer' THEN json_set(`line`.`value`, '$.productId', (SELECT `new` FROM `__uuid_products` WHERE `old` = json_extract(`line`.`value`, '$.productId'))) ELSE json(`line`.`value`) END ORDER BY `line`.`key`) FROM json_each(`__new_simulations`.`data`, '$.lines') AS `line`));
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
DROP TABLE `simulations`;
--> statement-breakpoint
DROP TABLE `payments`;
--> statement-breakpoint
DROP TABLE `sale_discounts`;
--> statement-breakpoint
DROP TABLE `sale_item_lots`;
--> statement-breakpoint
DROP TABLE `sale_items`;
--> statement-breakpoint
DROP TABLE `sales`;
--> statement-breakpoint
DROP TABLE `stock_movements`;
--> statement-breakpoint
DROP TABLE `stock_lots`;
--> statement-breakpoint
DROP TABLE `purchase_order_fees`;
--> statement-breakpoint
DROP TABLE `purchase_order_items`;
--> statement-breakpoint
DROP TABLE `purchase_orders`;
--> statement-breakpoint
DROP TABLE `customers`;
--> statement-breakpoint
DROP TABLE `suppliers`;
--> statement-breakpoint
DROP TABLE `products`;
--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;
--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;
--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;
--> statement-breakpoint
ALTER TABLE `__new_purchase_orders` RENAME TO `purchase_orders`;
--> statement-breakpoint
ALTER TABLE `__new_purchase_order_items` RENAME TO `purchase_order_items`;
--> statement-breakpoint
ALTER TABLE `__new_purchase_order_fees` RENAME TO `purchase_order_fees`;
--> statement-breakpoint
ALTER TABLE `__new_stock_lots` RENAME TO `stock_lots`;
--> statement-breakpoint
ALTER TABLE `__new_stock_movements` RENAME TO `stock_movements`;
--> statement-breakpoint
ALTER TABLE `__new_sales` RENAME TO `sales`;
--> statement-breakpoint
ALTER TABLE `__new_sale_items` RENAME TO `sale_items`;
--> statement-breakpoint
ALTER TABLE `__new_sale_item_lots` RENAME TO `sale_item_lots`;
--> statement-breakpoint
ALTER TABLE `__new_sale_discounts` RENAME TO `sale_discounts`;
--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;
--> statement-breakpoint
ALTER TABLE `__new_simulations` RENAME TO `simulations`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
DROP TABLE `__uuid_products`;
--> statement-breakpoint
DROP TABLE `__uuid_suppliers`;
--> statement-breakpoint
DROP TABLE `__uuid_customers`;
--> statement-breakpoint
DROP TABLE `__uuid_purchase_orders`;
--> statement-breakpoint
DROP TABLE `__uuid_purchase_order_items`;
--> statement-breakpoint
DROP TABLE `__uuid_purchase_order_fees`;
--> statement-breakpoint
DROP TABLE `__uuid_stock_lots`;
--> statement-breakpoint
DROP TABLE `__uuid_stock_movements`;
--> statement-breakpoint
DROP TABLE `__uuid_sales`;
--> statement-breakpoint
DROP TABLE `__uuid_sale_items`;
--> statement-breakpoint
DROP TABLE `__uuid_sale_item_lots`;
--> statement-breakpoint
DROP TABLE `__uuid_sale_discounts`;
--> statement-breakpoint
DROP TABLE `__uuid_payments`;
--> statement-breakpoint
DROP TABLE `__uuid_simulations`;
--> statement-breakpoint
DROP TABLE `__uuid_documents`;
--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);;
--> statement-breakpoint
CREATE INDEX `documents_reference_idx` ON `documents` (`reference_type`,`reference_id`);;
--> statement-breakpoint
CREATE INDEX `documents_type_idx` ON `documents` (`type`);;
--> statement-breakpoint
CREATE INDEX `purchase_order_fees_order_idx` ON `purchase_order_fees` (`order_id`);;
--> statement-breakpoint
CREATE INDEX `purchase_order_items_order_idx` ON `purchase_order_items` (`order_id`);;
--> statement-breakpoint
CREATE INDEX `purchase_order_items_product_idx` ON `purchase_order_items` (`product_id`);;
--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchase_orders` (`supplier_id`);;
--> statement-breakpoint
CREATE INDEX `purchase_orders_date_idx` ON `purchase_orders` (`order_date`);;
--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);;
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);;
--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`customer_id`);;
--> statement-breakpoint
CREATE INDEX `payments_sale_idx` ON `payments` (`sale_id`);;
--> statement-breakpoint
CREATE INDEX `payments_date_idx` ON `payments` (`payment_date`);;
--> statement-breakpoint
CREATE INDEX `sale_discounts_sale_idx` ON `sale_discounts` (`sale_id`);;
--> statement-breakpoint
CREATE INDEX `sale_item_lots_item_idx` ON `sale_item_lots` (`sale_item_id`);;
--> statement-breakpoint
CREATE INDEX `sale_item_lots_lot_idx` ON `sale_item_lots` (`lot_id`);;
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);;
--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);;
--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);;
--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`sale_date`);;
--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);;
--> statement-breakpoint
CREATE INDEX `simulations_updated_idx` ON `simulations` (`updated_at`);;
--> statement-breakpoint
CREATE INDEX `stock_lots_product_received_idx` ON `stock_lots` (`product_id`,`received_at`);;
--> statement-breakpoint
CREATE INDEX `stock_lots_order_item_idx` ON `stock_lots` (`order_item_id`);;
--> statement-breakpoint
CREATE INDEX `stock_movements_product_date_idx` ON `stock_movements` (`product_id`,`created_at`);;
--> statement-breakpoint
CREATE INDEX `stock_movements_lot_idx` ON `stock_movements` (`lot_id`);;
--> statement-breakpoint
CREATE INDEX `stock_movements_date_idx` ON `stock_movements` (`created_at`);;
--> statement-breakpoint
CREATE INDEX `stock_movements_reference_idx` ON `stock_movements` (`reference_type`,`reference_id`);;
--> statement-breakpoint
CREATE TABLE `reference_sequences` (
	`series` text PRIMARY KEY,
	`last_number` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);;
--> statement-breakpoint
INSERT INTO `reference_sequences` (`series`, `last_number`) SELECT substr(`reference`, 1, 7), max(cast(substr(`reference`, 9) as integer)) FROM `purchase_orders` WHERE `reference` LIKE 'CF-____-%' GROUP BY substr(`reference`, 1, 7);
--> statement-breakpoint
INSERT INTO `reference_sequences` (`series`, `last_number`) SELECT substr(`reference`, 1, 6), max(cast(substr(`reference`, 8) as integer)) FROM `sales` WHERE `reference` LIKE 'V-____-%' GROUP BY substr(`reference`, 1, 6);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
