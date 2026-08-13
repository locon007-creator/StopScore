PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__backup_v2_stops` AS SELECT * FROM `v2_stops`;--> statement-breakpoint
CREATE TABLE `__backup_v2_stop_events` AS SELECT * FROM `v2_stop_events`;--> statement-breakpoint
CREATE TABLE `__backup_v2_experiences` AS SELECT * FROM `v2_experiences`;--> statement-breakpoint
CREATE TABLE `__backup_v2_idempotency` AS SELECT * FROM `v2_idempotency`;--> statement-breakpoint
CREATE TABLE `__new_v2_workdays` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`active_key` text,
	`day_date` text NOT NULL,
	`state` text NOT NULL,
	`equipment_type` text NOT NULL,
	`truck_number` text NOT NULL,
	`trailer_number` text,
	`trailer_type` text,
	`odometer` text NOT NULL,
	`active_stop_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	CONSTRAINT "v2_workdays_state_check" CHECK("__new_v2_workdays"."state" in ('setup', 'active', 'completed')),
	CONSTRAINT "v2_workdays_equipment_check" CHECK("__new_v2_workdays"."equipment_type" in ('tractor', 'bobtail', 'straight_truck', 'box_truck', 'small_box_truck', 'cargo_van')),
	CONSTRAINT "v2_workdays_trailer_check" CHECK(("__new_v2_workdays"."equipment_type" = 'tractor' and "__new_v2_workdays"."trailer_type" in ('dry_van', 'reefer', 'flatbed', 'step_deck')) or ("__new_v2_workdays"."equipment_type" <> 'tractor' and "__new_v2_workdays"."trailer_type" is null and "__new_v2_workdays"."trailer_number" is null)),
	CONSTRAINT "v2_workdays_active_stop_check" CHECK("__new_v2_workdays"."active_stop_index" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_v2_workdays`("id", "driver_id", "active_key", "day_date", "state", "equipment_type", "truck_number", "trailer_number", "trailer_type", "odometer", "active_stop_index", "created_at", "updated_at", "completed_at") SELECT "id", "driver_id", "active_key", "day_date", "state", "equipment_type", "truck_number", "trailer_number", "trailer_type", "odometer", "active_stop_index", "created_at", "updated_at", "completed_at" FROM `v2_workdays`;--> statement-breakpoint
DROP TABLE `v2_workdays`;--> statement-breakpoint
ALTER TABLE `__new_v2_workdays` RENAME TO `v2_workdays`;--> statement-breakpoint
CREATE UNIQUE INDEX `v2_workdays_id_driver_idx` ON `v2_workdays` (`id`,`driver_id`);--> statement-breakpoint
INSERT INTO `v2_stops` (`id`, `workday_id`, `driver_id`, `provider_id`, `display_name`, `address`, `stop_type`, `stop_order`, `state`, `created_at`, `updated_at`) SELECT `id`, `workday_id`, `driver_id`, `provider_id`, `display_name`, `address`, `stop_type`, `stop_order`, `state`, `created_at`, `updated_at` FROM `__backup_v2_stops`;--> statement-breakpoint
INSERT INTO `v2_stop_events` (`id`, `workday_id`, `stop_id`, `driver_id`, `action`, `created_at`) SELECT `id`, `workday_id`, `stop_id`, `driver_id`, `action`, `created_at` FROM `__backup_v2_stop_events`;--> statement-breakpoint
INSERT INTO `v2_experiences` (`id`, `workday_id`, `stop_id`, `driver_id`, `yard`, `staging`, `staff`, `waiting_time`, `bathroom_access`, `bathroom_available`, `bathroom_condition`, `waiting_category`, `created_at`) SELECT `id`, `workday_id`, `stop_id`, `driver_id`, `yard`, `staging`, `staff`, `waiting_time`, `bathroom_access`, `bathroom_available`, `bathroom_condition`, `waiting_category`, `created_at` FROM `__backup_v2_experiences`;--> statement-breakpoint
INSERT INTO `v2_idempotency` (`driver_id`, `idempotency_key`, `operation`, `workday_id`, `aggregate`, `created_at`) SELECT `driver_id`, `idempotency_key`, `operation`, `workday_id`, `aggregate`, `created_at` FROM `__backup_v2_idempotency`;--> statement-breakpoint
DROP TABLE `__backup_v2_stops`;--> statement-breakpoint
DROP TABLE `__backup_v2_stop_events`;--> statement-breakpoint
DROP TABLE `__backup_v2_experiences`;--> statement-breakpoint
DROP TABLE `__backup_v2_idempotency`;--> statement-breakpoint
CREATE UNIQUE INDEX `v2_workdays_active_key_idx` ON `v2_workdays` (`active_key`);--> statement-breakpoint
CREATE INDEX `v2_workdays_driver_updated_idx` ON `v2_workdays` (`driver_id`,`updated_at`);
