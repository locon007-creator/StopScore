ALTER TABLE `v2_experiences` ADD `bathroom_available` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `v2_experiences` ADD `bathroom_condition` text CHECK ((`bathroom_available` = 0 and `bathroom_condition` is null) or (`bathroom_available` = 1 and `bathroom_condition` in ('clean', 'dirty', 'needs_improvement')));
