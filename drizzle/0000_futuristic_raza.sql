CREATE TABLE `app_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`launch_time` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bundle_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_bundle_id_unique` ON `apps` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `snapshot_app_sessions` (
	`snapshot_id` integer NOT NULL,
	`app_session_id` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `app_session_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_session_id`) REFERENCES `app_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `snapshot_windows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`app_session_id` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`title` text NOT NULL,
	`is_frontmost` integer NOT NULL,
	`tab_url` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_session_id`) REFERENCES `app_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL
);
