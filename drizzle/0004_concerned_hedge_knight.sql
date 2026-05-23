CREATE TABLE `outfit_recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`occasion` varchar(120),
	`itemIds` json NOT NULL,
	`analysis` json NOT NULL,
	`luckyColors` json,
	`tryOnImageUrl` varchar(500),
	`tryOnImageKey` varchar(500),
	`source` enum('own','cross_user') NOT NULL DEFAULT 'own',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outfit_recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(120),
	`faceShape` enum('oval','round','square','heart','oblong','diamond'),
	`skinTone` enum('fair','light','medium','tan','deep'),
	`undertone` enum('cool','neutral','warm'),
	`birthDate` varchar(16),
	`preferredStyles` text,
	`notes` text,
	`profilePhotoUrl` varchar(500),
	`profilePhotoKey` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `matchingStatus` enum('unmatched','matched','no_pair') DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `matchingGroup` varchar(32);--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `lastMatchedAt` timestamp;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `listingPriceCents` int;