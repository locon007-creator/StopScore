CREATE TABLE `v2_experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`workday_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`yard` integer NOT NULL,
	`staging` integer NOT NULL,
	`staff` integer NOT NULL,
	`waiting_time` integer NOT NULL,
	`bathroom_access` integer NOT NULL,
	`waiting_category` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`stop_id`,`workday_id`,`driver_id`) REFERENCES `v2_stops`(`id`,`workday_id`,`driver_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "v2_experiences_yard_check" CHECK("v2_experiences"."yard" between 1 and 5),
	CONSTRAINT "v2_experiences_staging_check" CHECK("v2_experiences"."staging" between 1 and 5),
	CONSTRAINT "v2_experiences_staff_check" CHECK("v2_experiences"."staff" between 1 and 5),
	CONSTRAINT "v2_experiences_waiting_time_check" CHECK("v2_experiences"."waiting_time" between 1 and 5),
	CONSTRAINT "v2_experiences_bathroom_check" CHECK("v2_experiences"."bathroom_access" between 1 and 5),
	CONSTRAINT "v2_experiences_waiting_category_check" CHECK("v2_experiences"."waiting_category" in ('quick', 'standard', 'long', 'extremely_delayed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `v2_experiences_stop_idx` ON `v2_experiences` (`stop_id`);--> statement-breakpoint
CREATE TABLE `v2_idempotency` (
	`driver_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`operation` text NOT NULL,
	`workday_id` text NOT NULL,
	`aggregate` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`driver_id`, `idempotency_key`),
	FOREIGN KEY (`workday_id`,`driver_id`) REFERENCES `v2_workdays`(`id`,`driver_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `v2_idempotency_workday_idx` ON `v2_idempotency` (`workday_id`);--> statement-breakpoint
CREATE TABLE `v2_stop_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workday_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`stop_id`,`workday_id`,`driver_id`) REFERENCES `v2_stops`(`id`,`workday_id`,`driver_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "v2_stop_events_action_check" CHECK("v2_stop_events"."action" in ('navigate', 'arrive', 'depart'))
);
--> statement-breakpoint
CREATE INDEX `v2_stop_events_workday_idx` ON `v2_stop_events` (`workday_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `v2_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`workday_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`display_name` text NOT NULL,
	`address` text NOT NULL,
	`stop_type` text NOT NULL,
	`stop_order` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workday_id`,`driver_id`) REFERENCES `v2_workdays`(`id`,`driver_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "v2_stops_provider_check" CHECK(("v2_stops"."provider_id" glob 'osm:node:[1-9]*' and substr("v2_stops"."provider_id", length('osm:node:') + 1) not glob '*[^0-9]*') or ("v2_stops"."provider_id" glob 'osm:way:[1-9]*' and substr("v2_stops"."provider_id", length('osm:way:') + 1) not glob '*[^0-9]*') or ("v2_stops"."provider_id" glob 'osm:relation:[1-9]*' and substr("v2_stops"."provider_id", length('osm:relation:') + 1) not glob '*[^0-9]*')),
	CONSTRAINT "v2_stops_type_check" CHECK("v2_stops"."stop_type" in ('delivery', 'pickup', 'drop_hook', 'delivery_pickup')),
	CONSTRAINT "v2_stops_order_check" CHECK("v2_stops"."stop_order" >= 0),
	CONSTRAINT "v2_stops_state_check" CHECK("v2_stops"."state" in ('pending', 'navigating', 'arrived', 'departed', 'experience_published'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `v2_stops_id_workday_driver_idx` ON `v2_stops` (`id`,`workday_id`,`driver_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `v2_stops_workday_order_idx` ON `v2_stops` (`workday_id`,`stop_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `v2_stops_workday_provider_idx` ON `v2_stops` (`workday_id`,`provider_id`);--> statement-breakpoint
CREATE INDEX `v2_stops_driver_workday_idx` ON `v2_stops` (`driver_id`,`workday_id`);--> statement-breakpoint
CREATE TABLE `v2_workdays` (
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
	CONSTRAINT "v2_workdays_state_check" CHECK("v2_workdays"."state" in ('setup', 'active', 'completed')),
	CONSTRAINT "v2_workdays_equipment_check" CHECK("v2_workdays"."equipment_type" in ('tractor', 'bobtail', 'straight_truck', 'cargo_van')),
	CONSTRAINT "v2_workdays_trailer_check" CHECK(("v2_workdays"."equipment_type" = 'tractor' and "v2_workdays"."trailer_type" in ('dry_van', 'reefer', 'flatbed', 'step_deck')) or ("v2_workdays"."equipment_type" <> 'tractor' and "v2_workdays"."trailer_type" is null and "v2_workdays"."trailer_number" is null)),
	CONSTRAINT "v2_workdays_active_stop_check" CHECK("v2_workdays"."active_stop_index" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `v2_workdays_active_key_idx` ON `v2_workdays` (`active_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `v2_workdays_id_driver_idx` ON `v2_workdays` (`id`,`driver_id`);--> statement-breakpoint
CREATE INDEX `v2_workdays_driver_updated_idx` ON `v2_workdays` (`driver_id`,`updated_at`);
