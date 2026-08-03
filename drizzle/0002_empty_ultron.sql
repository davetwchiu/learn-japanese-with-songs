CREATE TABLE `mirror_applied_events` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mirror_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`slug` text NOT NULL,
	`payload` text,
	`source_updated_at` integer NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mirror_outbox_retry_idx` ON `mirror_outbox` (`next_attempt_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `mirror_versions` (
	`slug` text PRIMARY KEY NOT NULL,
	`source_updated_at` integer NOT NULL,
	`operation` text NOT NULL
);
