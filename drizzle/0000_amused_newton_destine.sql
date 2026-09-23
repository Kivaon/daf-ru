CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tractate` text NOT NULL,
	`ref` text NOT NULL,
	`title` text NOT NULL,
	`translation` text NOT NULL,
	`explanation` text NOT NULL,
	`rashi_json` text DEFAULT '[]' NOT NULL,
	`tosafot_json` text DEFAULT '[]' NOT NULL,
	`provider` text NOT NULL,
	`author_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_tractate_ref_unique` ON `articles` (`tractate`,`ref`);