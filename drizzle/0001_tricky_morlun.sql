ALTER TABLE `orders` ADD `service_type` text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `table_number` integer;