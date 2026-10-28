ALTER TABLE `purchase_orders` ADD `currency` text DEFAULT 'rmb' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` RENAME COLUMN `unit_price_rmb` TO `unit_price`;--> statement-breakpoint
ALTER TABLE `supplier_payments` RENAME COLUMN `fcfa_per_rmb` TO `fcfa_rate`;