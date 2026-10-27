CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`payment_date` integer NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`fcfa_per_rmb` real,
	`notes` text,
	`cancelled_at` integer,
	`cancel_reason` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_supplier_payments_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_supplier_payments_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "supplier_payments_amount_positive" CHECK("amount_fcfa" > 0),
	CONSTRAINT "supplier_payments_rate_positive" CHECK("fcfa_per_rmb" is null or "fcfa_per_rmb" > 0)
);
--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `received_goods_fcfa` integer;--> statement-breakpoint
CREATE INDEX `supplier_payments_order_idx` ON `supplier_payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `supplier_payments_date_idx` ON `supplier_payments` (`payment_date`);