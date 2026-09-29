CREATE TABLE `properties` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`status` text NOT NULL,
	`position` integer NOT NULL,
	`meta` text DEFAULT '' NOT NULL,
	`price` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`intro` text DEFAULT '[]' NOT NULL,
	`highlights` text DEFAULT '[]' NOT NULL,
	`specs` text DEFAULT '[]' NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`published_at` text,
	`published_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	CONSTRAINT "properties_status_check" CHECK("properties"."status" in ('Available', 'Under construction', 'Sold', 'Coming soon'))
);
--> statement-breakpoint
CREATE INDEX `properties_position_idx` ON `properties` (`position`);--> statement-breakpoint
CREATE TABLE `property_media` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`r2_key` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`width` integer,
	`height` integer,
	`bytes` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`slug`) REFERENCES `properties`(`slug`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "property_media_role_check" CHECK("property_media"."role" in ('card', 'hero', 'gallery'))
);
--> statement-breakpoint
CREATE INDEX `property_media_slug_idx` ON `property_media` (`slug`,`role`,`position`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL
);
