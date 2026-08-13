CREATE TABLE `saved_routes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` text NOT NULL,
	`name` text NOT NULL,
	`stops` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_routes_driver_idx` ON `saved_routes` (`driver_id`);