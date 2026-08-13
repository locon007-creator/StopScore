CREATE TABLE `workdays` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`active_key` text,
	`day_date` text NOT NULL,
	`phase` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `workdays_driver_status_idx` ON `workdays` (`driver_id`,`status`);--> statement-breakpoint
CREATE INDEX `workdays_driver_completed_idx` ON `workdays` (`driver_id`,`completed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `workdays_active_key_idx` ON `workdays` (`active_key`);