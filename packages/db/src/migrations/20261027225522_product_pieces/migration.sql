ALTER TABLE `products` ADD `pieces_per_unit` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `piece_product_id` text REFERENCES products(id) ON DELETE SET NULL;