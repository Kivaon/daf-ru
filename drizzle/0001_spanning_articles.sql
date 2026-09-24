ALTER TABLE `articles` ADD `unit_ref` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `parts_json` text DEFAULT '[]' NOT NULL;
