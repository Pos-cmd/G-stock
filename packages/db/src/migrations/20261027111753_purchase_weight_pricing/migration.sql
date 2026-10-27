ALTER TABLE `purchase_order_items` ADD `pricing_basis` text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `weight_tons` real;