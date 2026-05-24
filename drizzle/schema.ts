import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Pricing History Table ───

export const pricingHistory = mysqlTable("pricing_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  // Product info
  category: varchar("category", { length: 64 }).notNull(),
  brand: varchar("brand", { length: 128 }).notNull(),
  size: varchar("size", { length: 32 }).notNull(),
  condition: varchar("condition", { length: 32 }).notNull(),
  defectLevel: varchar("defectLevel", { length: 32 }),
  color: varchar("color", { length: 64 }),
  style: varchar("style", { length: 64 }),
  originalPrice: int("originalPrice"),
  // Pricing results
  recommendedPrice: int("recommendedPrice").notNull(),
  fastSalePrice: int("fastSalePrice").notNull(),
  highValuePrice: int("highValuePrice").notNull(),
  marketMin: int("marketMin").notNull(),
  marketMax: int("marketMax").notNull(),
  sellabilityScore: int("sellabilityScore").notNull(),
  confidenceScore: int("confidenceScore").notNull(),
  // International pricing
  intlPriceUSD: int("intlPriceUSD"),
  // Thai Market Factor
  thaiMarketTier: varchar("thaiMarketTier", { length: 32 }),
  thaiMarketDiscount: int("thaiMarketDiscount"), // discount % applied
  internationalBasePrice: int("internationalBasePrice"), // price before Thai discount
  // AI consensus info
  consensusLevel: varchar("consensusLevel", { length: 32 }),
  agentCount: int("agentCount"),
  // Sale outcome (for learning)
  listedPrice: int("listedPrice"), // price actually listed at
  soldPrice: int("soldPrice"), // price actually sold at
  soldAt: timestamp("soldAt"), // when it was sold
  salesChannel: varchar("salesChannel", { length: 64 }), // e.g. "facebook", "kaidee", "shopee"
  daysToSell: int("daysToSell"), // actual days from listing to sold
  // Image URL (first image stored in S3)
  imageUrl: text("imageUrl"),
  // Listing data (JSON string for eBay/Amazon listing)
  listingData: text("listingData"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PricingHistory = typeof pricingHistory.$inferSelect;
export type InsertPricingHistory = typeof pricingHistory.$inferInsert;

// ─── Wardrobe Table ───

export const wardrobe = mysqlTable("wardrobe", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Product info from AI detection
  category: varchar("category", { length: 64 }).notNull(),
  brand: varchar("brand", { length: 128 }).notNull(),
  color: varchar("color", { length: 64 }),
  material: varchar("material", { length: 64 }),
  condition: varchar("condition", { length: 32 }).notNull(),
  conditionScore: int("conditionScore"),
  defects: text("defects"), // JSON array string
  // Size & measurements
  size: varchar("size", { length: 32 }),
  height: int("height"), // cm
  weight: int("weight"), // kg
  bust: int("bust"), // cm (for tops/dress)
  shoulder: int("shoulder"), // cm (for tops/dress)
  waist: int("waist"), // cm (for bottoms/skirt)
  hip: int("hip"), // cm (for bottoms/skirt)
  // Pricing results
  recommendedPrice: int("recommendedPrice"),
  marketMin: int("marketMin"),
  marketMax: int("marketMax"),
  sellabilityScore: int("sellabilityScore"),
  confidenceScore: int("confidenceScore"),
  // Image URL (primary image stored in S3)
  imageUrl: text("imageUrl"),
  imageUrl2: text("imageUrl2"),
  imageUrl3: text("imageUrl3"),
  // Thai Market Factor
  thaiMarketTier: varchar("thaiMarketTier", { length: 32 }),
  thaiMarketDiscount: int("thaiMarketDiscount"),
  // Status & Sale tracking
  // reserved = a buyer placed an order via cross-user matching; held until the seller confirms.
  status: mysqlEnum("status", ["in_wardrobe", "listed", "reserved", "sold"]).default("in_wardrobe").notNull(),
  listedPrice: int("listedPrice"),
  soldPrice: int("soldPrice"),
  soldAt: timestamp("soldAt"),
  salesChannel: varchar("salesChannel", { length: 64 }),

  // ─── Matching support (added for outfit matching / lookbook) ───
  // Free-text tag string used by the AI stylist to classify the garment
  // (e.g. "casual,linen,summer"). Optional — Gemini can refine at match time.
  tags: text("tags"),
  // Matching lifecycle so we only re-match fresh items.
  matchingStatus: mysqlEnum("matchingStatus", ["unmatched", "matched", "no_pair"])
    .default("unmatched")
    .notNull(),
  matchingGroup: varchar("matchingGroup", { length: 32 }),
  lastMatchedAt: timestamp("lastMatchedAt"),
  // Price (in satang) used when this item is offered in cross-user lookbook.
  // Mirrors `listedPrice` (baht) but kept separate to match the matching engine.
  listingPriceCents: int("listingPriceCents"),

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WardrobeItem = typeof wardrobe.$inferSelect;
export type InsertWardrobeItem = typeof wardrobe.$inferInsert;

// ─── Style Profile Table (ported from ai_digital_wardrobe) ───
// One per user. Drives personalization for AI matching + lucky color.

export const styleProfiles = mysqlTable("style_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  displayName: varchar("displayName", { length: 120 }),
  faceShape: mysqlEnum("faceShape", ["oval", "round", "square", "heart", "oblong", "diamond"]),
  skinTone: mysqlEnum("skinTone", ["fair", "light", "medium", "tan", "deep"]),
  undertone: mysqlEnum("undertone", ["cool", "neutral", "warm"]),
  birthDate: varchar("birthDate", { length: 16 }), // ISO yyyy-mm-dd — feeds analyzeLuckyColors()
  preferredStyles: text("preferredStyles"), // comma separated tags
  notes: text("notes"),
  heightCm: int("heightCm"), // personal default height (used by try-on body proportions)
  weightKg: int("weightKg"), // personal default weight
  profilePhotoUrl: varchar("profilePhotoUrl", { length: 500 }), // user's face photo → try-on reference
  profilePhotoKey: varchar("profilePhotoKey", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StyleProfile = typeof styleProfiles.$inferSelect;
export type InsertStyleProfile = typeof styleProfiles.$inferInsert;

// ─── Outfit Recommendations Table (ported from ai_digital_wardrobe) ───
// `itemIds` = JSON array of wardrobe.id included in the look.
// `analysis` = structured JSON returned by the LLM stylist.

export const outfitRecommendations = mysqlTable("outfit_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  occasion: varchar("occasion", { length: 120 }),
  itemIds: json("itemIds").notNull(),
  analysis: json("analysis").notNull(),
  luckyColors: json("luckyColors"),
  tryOnImageUrl: varchar("tryOnImageUrl", { length: 500 }),
  tryOnImageKey: varchar("tryOnImageKey", { length: 500 }),
  // 'own' = look built from the user's own wardrobe;
  // 'cross_user' = look that mixes in items listed by other users.
  source: mysqlEnum("source", ["own", "cross_user"]).default("own").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OutfitRecommendation = typeof outfitRecommendations.$inferSelect;
export type InsertOutfitRecommendation = typeof outfitRecommendations.$inferInsert;

// ─── Orders Table (cross-user marketplace purchases) ───
// Created when a buyer taps "สนใจซื้อ" on a cross-closet look. The reserved
// wardrobe item is held until the seller confirms (→ sold) or rejects (→ listed).

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  buyerUserId: int("buyerUserId").notNull(),
  sellerUserId: int("sellerUserId").notNull(),
  itemId: int("itemId").notNull(), // wardrobe.id of the purchased garment
  outfitId: int("outfitId"), // optional: the cross-user look this came from
  priceBaht: int("priceBaht").notNull(),
  // pending  = buyer reserved, awaiting seller
  // confirmed = seller accepted → item marked sold
  // cancelled = seller rejected or buyer cancelled → item back to listed
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"])
    .default("pending")
    .notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
