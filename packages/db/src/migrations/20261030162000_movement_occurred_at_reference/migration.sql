UPDATE `stock_movements`
SET `occurred_at` = (SELECT `sale_date` FROM `sales` WHERE `sales`.`id` = `stock_movements`.`reference_id`)
WHERE `reference_type` = 'sale' AND `type` = 'out'
	AND EXISTS (SELECT 1 FROM `sales` WHERE `sales`.`id` = `stock_movements`.`reference_id`);--> statement-breakpoint
UPDATE `stock_movements`
SET `occurred_at` = (SELECT `cancelled_at` FROM `sales` WHERE `sales`.`id` = `stock_movements`.`reference_id`)
WHERE `reference_type` = 'sale' AND `type` = 'in'
	AND EXISTS (SELECT 1 FROM `sales` WHERE `sales`.`id` = `stock_movements`.`reference_id` AND `cancelled_at` IS NOT NULL);--> statement-breakpoint
UPDATE `stock_movements`
SET `occurred_at` = (SELECT `received_at` FROM `purchase_orders` WHERE `purchase_orders`.`id` = `stock_movements`.`reference_id`)
WHERE `reference_type` = 'purchase_order'
	AND EXISTS (SELECT 1 FROM `purchase_orders` WHERE `purchase_orders`.`id` = `stock_movements`.`reference_id` AND `received_at` IS NOT NULL);
