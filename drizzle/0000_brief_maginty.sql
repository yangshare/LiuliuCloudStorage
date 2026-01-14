CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`details` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_id` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_created_at` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_action_type` ON `activity_logs` (`action_type`);--> statement-breakpoint
CREATE INDEX `idx_activity_logs_user_created` ON `activity_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `daily_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`upload_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`delete_count` integer DEFAULT 0 NOT NULL,
	`folder_create_count` integer DEFAULT 0 NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`total_size` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_daily_stats_user_id` ON `daily_stats` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_daily_stats_date` ON `daily_stats` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_stats_user_date` ON `daily_stats` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `download_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_path` text NOT NULL,
	`auto_create_date_folder` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`cached_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_file_cache_user_path` ON `file_cache` (`user_id`,`path`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_encrypted` text NOT NULL,
	`base_path` text DEFAULT '/',
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_token` ON `sessions` (`token_encrypted`);--> statement-breakpoint
CREATE TABLE `transfer_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`task_type` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`remote_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`transferred_size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`task_id` text,
	`error_message` text,
	`resumable` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transfer_queue_user_id` ON `transfer_queue` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_queue_status` ON `transfer_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_transfer_queue_task_type` ON `transfer_queue` (`task_type`);--> statement-breakpoint
CREATE INDEX `idx_transfer_queue_user_status` ON `transfer_queue` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`quota_total` integer DEFAULT 10737418240,
	`quota_used` integer DEFAULT 0,
	`is_admin` integer DEFAULT false,
	`onboarding_completed` integer DEFAULT false,
	`alist_token` text,
	`token_expires_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_username` ON `users` (`username`);