CREATE TABLE `saved_stops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`open_hours` text DEFAULT '—' NOT NULL,
	`close_hours` text DEFAULT '—' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_stops_driver_idx` ON `saved_stops` (`driver_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_stops_driver_address_idx` ON `saved_stops` (`driver_id`,`address`);