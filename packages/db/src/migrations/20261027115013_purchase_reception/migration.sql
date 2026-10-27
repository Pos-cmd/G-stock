CREATE TABLE `purchase_order_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`order_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'fcfa' NOT NULL,
	`amount_fcfa` integer NOT NULL,
	`allocation_method` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_purchase_order_fees_order_id_purchase_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
	CONSTRAINT "purchase_order_fees_amount_non_negative" CHECK("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `qty_received` real;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `arrived_at` integer;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `container_number` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `bill_of_lading` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `forwarder` text;--> statement-breakpoint
CREATE INDEX `purchase_order_fees_order_idx` ON `purchase_order_fees` (`order_id`);--> statement-breakpoint
-- Commandes déjà réceptionnées : leurs frais réels sont l'estimation avec laquelle elles ont été reçues.
INSERT INTO `purchase_order_fees` (`order_id`, `label`, `amount`, `currency`, `amount_fcfa`, `allocation_method`)
SELECT `id`, 'Fret maritime', round(`freight_cbm` * `freight_rate_per_cbm_fcfa`), 'fcfa', round(`freight_cbm` * `freight_rate_per_cbm_fcfa`), `allocation_method`
FROM `purchase_orders` WHERE `status` = 'received' AND `freight_cbm` * `freight_rate_per_cbm_fcfa` > 0;--> statement-breakpoint
INSERT INTO `purchase_order_fees` (`order_id`, `label`, `amount`, `currency`, `amount_fcfa`, `allocation_method`)
SELECT `id`, 'Transport local', `local_transport_fcfa`, 'fcfa', `local_transport_fcfa`, `allocation_method`
FROM `purchase_orders` WHERE `status` = 'received' AND `local_transport_fcfa` > 0;--> statement-breakpoint
INSERT INTO `purchase_order_fees` (`order_id`, `label`, `amount`, `currency`, `amount_fcfa`, `allocation_method`)
SELECT `id`, 'Autres frais', `other_fees_fcfa`, 'fcfa', `other_fees_fcfa`, `allocation_method`
FROM `purchase_orders` WHERE `status` = 'received' AND `other_fees_fcfa` > 0;--> statement-breakpoint
UPDATE `purchase_order_items` SET `qty_received` = `qty`
WHERE `order_id` IN (SELECT `id` FROM `purchase_orders` WHERE `status` = 'received');
