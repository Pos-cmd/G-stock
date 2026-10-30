CREATE TABLE `__new_stock_movements` (
	`id` text PRIMARY KEY,
	`product_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`type` text NOT NULL,
	`qty` real NOT NULL,
	`unit_cost_fcfa` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`reason` text,
	`reference_type` text DEFAULT 'manual' NOT NULL,
	`reference_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_stock_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_lot_id_stock_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_stock_movements_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_stock_movements` (`id`, `product_id`, `lot_id`, `type`, `qty`, `unit_cost_fcfa`, `occurred_at`, `reason`, `reference_type`, `reference_id`, `created_by`, `created_at`) SELECT `id`, `product_id`, `lot_id`, `type`, `qty`, `unit_cost_fcfa`, `created_at`, `reason`, `reference_type`, `reference_id`, `created_by`, `created_at` FROM `stock_movements`;--> statement-breakpoint
DROP TABLE `stock_movements`;--> statement-breakpoint
ALTER TABLE `__new_stock_movements` RENAME TO `stock_movements`;--> statement-breakpoint
CREATE INDEX `stock_movements_product_date_idx` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_occurred_idx` ON `stock_movements` (`product_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_occurred_idx` ON `stock_movements` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_lot_idx` ON `stock_movements` (`lot_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_date_idx` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_reference_idx` ON `stock_movements` (`reference_type`,`reference_id`);
