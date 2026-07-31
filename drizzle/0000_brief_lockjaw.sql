CREATE TABLE `songs` (
	`slug` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
