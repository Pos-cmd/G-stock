-- Module Ventes : les tables de ventes, jamais utilisées jusqu'ici, sont restructurées.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_price_fcfa` integer NOT NULL,
	CONSTRAINT `fk_sale_items_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_items_qty_positive" CHECK("qty" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_sale_items`(`id`, `sale_id`, `product_id`, `qty`, `unit_price_fcfa`) SELECT `id`, `sale_id`, `product_id`, `qty`, `unit_price_fcfa` FROM `sale_items`;--> statement-breakpoint
DROP TABLE `sale_items`;--> statement-breakpoint
ALTER TABLE `__new_sale_items` RENAME TO `sale_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`reference` text NOT NULL UNIQUE,
	`customer_id` integer NOT NULL,
	`sale_date` integer NOT NULL,
	`total_fcfa` integer NOT NULL,
	`payment_type` text NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sales_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_sales_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sales_total_non_negative" CHECK("total_fcfa" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_sales`(`id`, `reference`, `customer_id`, `sale_date`, `total_fcfa`, `payment_type`, `notes`, `created_by`, `created_at`) SELECT `id`, `reference`, `customer_id`, `sale_date`, `total_fcfa`, `payment_type`, `notes`, `created_by`, `created_at` FROM `sales`;--> statement-breakpoint
DROP TABLE `sales`;--> statement-breakpoint
ALTER TABLE `__new_sales` RENAME TO `sales`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `sale_items_lot_idx`;--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`sale_date`);--> statement-breakpoint
CREATE TABLE `sale_discounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sale_id` integer NOT NULL,
	`discount_date` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sale_discounts_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_discounts_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sale_discounts_amount_positive" CHECK("amount_fcfa" > 0)
);
--> statement-breakpoint
CREATE TABLE `sale_item_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`sale_item_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	CONSTRAINT `fk_sale_item_lots_sale_item_id_sale_items_id_fk` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_item_lots_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_item_lots_qty_positive" CHECK("qty" > 0)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `payments` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `cost_fcfa` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `sales` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `cancelled_by` text REFERENCES user(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `sale_discounts_sale_idx` ON `sale_discounts` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_item_lots_item_idx` ON `sale_item_lots` (`sale_item_id`);--> statement-breakpoint
CREATE INDEX `sale_item_lots_lot_idx` ON `sale_item_lots` (`lot_id`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);