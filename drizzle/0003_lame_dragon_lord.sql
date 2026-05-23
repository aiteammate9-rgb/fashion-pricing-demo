ALTER TABLE `pricing_history` ADD `thaiMarketTier` varchar(32);--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `thaiMarketDiscount` int;--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `internationalBasePrice` int;--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `listedPrice` int;--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `soldPrice` int;--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `soldAt` timestamp;--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `salesChannel` varchar(64);--> statement-breakpoint
ALTER TABLE `pricing_history` ADD `daysToSell` int;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `thaiMarketTier` varchar(32);--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `thaiMarketDiscount` int;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `listedPrice` int;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `soldPrice` int;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `soldAt` timestamp;--> statement-breakpoint
ALTER TABLE `wardrobe` ADD `salesChannel` varchar(64);