CREATE TABLE `app` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bundle_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_bundle_id_unique` ON `app` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `window` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`app_id` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`title` text NOT NULL,
	`is_frontmost` integer NOT NULL,
	`tab_url` text,
	`tab_title` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "title_check" CHECK("window"."title" != '')
);
