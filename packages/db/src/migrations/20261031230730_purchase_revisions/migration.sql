CREATE TABLE `purchase_revisions` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`revision_date` integer NOT NULL,
	`reason` text NOT NULL,
	`summary` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_purchase_revisions_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_purchase_revisions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_revisions_order_idx` ON `purchase_revisions` (`order_id`);