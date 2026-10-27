CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
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
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`contact` text,
	`phone` text,
	`country` text DEFAULT 'Chine' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`reference_type` text,
	`reference_id` integer,
	`file_path` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_price_rmb` real NOT NULL,
	`trips` real DEFAULT 1 NOT NULL,
	`transport_share_fcfa` integer DEFAULT 0 NOT NULL,
	`unit_cost_fcfa` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_purchase_order_items_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_purchase_order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "purchase_order_items_qty_positive" CHECK("qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`supplier_id` integer,
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
	`received_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_purchase_orders_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`customer_id` integer NOT NULL,
	`sale_id` integer,
	`payment_date` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_payments_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_payments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "payments_amount_positive" CHECK("amount_fcfa" > 0)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_price_fcfa` integer NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	CONSTRAINT `fk_sale_items_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_sale_items_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_items_qty_positive" CHECK("qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`customer_id` integer,
	`sale_date` integer NOT NULL,
	`total_fcfa` integer NOT NULL,
	`payment_type` text NOT NULL,
	`amount_paid_fcfa` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_sales_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sales_total_non_negative" CHECK("total_fcfa" >= 0)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`product_id` integer NOT NULL,
	`order_item_id` integer,
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
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`product_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`type` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	`reason` text,
	`reference_type` text DEFAULT 'manual' NOT NULL,
	`reference_id` integer,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_stock_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `documents_reference_idx` ON `documents` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `documents_type_idx` ON `documents` (`type`);--> statement-breakpoint
CREATE INDEX `purchase_order_items_order_idx` ON `purchase_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_items_product_idx` ON `purchase_order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_date_idx` ON `purchase_orders` (`order_date`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_sale_idx` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `payments_date_idx` ON `payments` (`payment_date`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `sale_items_lot_idx` ON `sale_items` (`lot_id`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`sale_date`);--> statement-breakpoint
CREATE INDEX `stock_lots_product_received_idx` ON `stock_lots` (`product_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `stock_lots_order_item_idx` ON `stock_lots` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_date_idx` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_lot_idx` ON `stock_movements` (`lot_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_date_idx` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_reference_idx` ON `stock_movements` (`reference_type`,`reference_id`);