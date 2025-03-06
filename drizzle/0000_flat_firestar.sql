CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bundle_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_bundle_id_unique` ON `apps` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `snapshot_apps` (
	`snapshot_id` integer NOT NULL,
	`app_id` integer NOT NULL,
	PRIMARY KEY(`snapshot_id`, `app_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`frontmost_app_id` integer,
	FOREIGN KEY (`frontmost_app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
