CREATE TABLE `driver_preferences` (
	`driver_id` text PRIMARY KEY NOT NULL,
	`navigation_app` text DEFAULT 'google' NOT NULL,
	`traffic_layer_enabled` integer DEFAULT true NOT NULL,
	`anonymous_experiences` integer DEFAULT false NOT NULL,
	`public_driver_name` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
