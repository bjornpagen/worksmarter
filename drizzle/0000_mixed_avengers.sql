CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bundle_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_bundle_id_unique` ON `apps` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `screenshot_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`screenshot_id` integer NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`screenshot_id`) REFERENCES `screenshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `screenshot_apps` (
	`screenshot_id` integer NOT NULL,
	`app_id` integer NOT NULL,
	PRIMARY KEY(`screenshot_id`, `app_id`),
	FOREIGN KEY (`screenshot_id`) REFERENCES `screenshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`file_path` text NOT NULL,
	`frontmost_app_id` integer,
	FOREIGN KEY (`frontmost_app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
