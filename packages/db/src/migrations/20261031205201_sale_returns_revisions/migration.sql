CREATE TABLE `sale_return_items` (
	`id` text PRIMARY KEY,
	`return_id` text NOT NULL,
	`sale_item_id` text,
	`product_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price_fcfa` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`restocked` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_sale_return_items_return_id_sale_returns_id_fk` FOREIGN KEY (`return_id`) REFERENCES `sale_returns`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_return_items_sale_item_id_sale_items_id_fk` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_sale_return_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "sale_return_items_qty_positive" CHECK("qty" > 0)
);
--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` text PRIMARY KEY,
	`sale_id` text NOT NULL,
	`return_date` integer NOT NULL,
	`refund_method` text DEFAULT 'credit' NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sale_returns_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_returns_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "sale_returns_amount_positive" CHECK("amount_fcfa" > 0)
);
--> statement-breakpoint
CREATE TABLE `sale_revisions` (
	`id` text PRIMARY KEY,
	`sale_id` text NOT NULL,
	`revision_date` integer NOT NULL,
	`reason` text NOT NULL,
	`summary` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_sale_revisions_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sale_revisions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `sale_return_items_return_idx` ON `sale_return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `sale_return_items_item_idx` ON `sale_return_items` (`sale_item_id`);--> statement-breakpoint
CREATE INDEX `sale_returns_sale_idx` ON `sale_returns` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_returns_date_idx` ON `sale_returns` (`return_date`);--> statement-breakpoint
CREATE INDEX `sale_revisions_sale_idx` ON `sale_revisions` (`sale_id`);