import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pricingHistory } from "../../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storagePut } from "../storage";

/**
 * History Router
 * - save: บันทึกผลประเมินราคาลง DB
 * - list: ดึงประวัติทั้งหมดของ user (หรือ guest)
 * - get: ดึงรายละเอียดประวัติ 1 รายการ
 * - delete: ลบประวัติ
 */

export const historyRouter = router({
  /**
   * บันทึกผลประเมินราคา
   * ใช้ publicProcedure เพื่อให้ guest ใช้ได้ (userId = null)
   */
  save: publicProcedure
    .input(
      z.object({
        category: z.string(),
        brand: z.string(),
        size: z.string(),
        condition: z.string(),
        defectLevel: z.string().optional(),
        color: z.string().optional(),
        style: z.string().optional(),
        originalPrice: z.number().optional(),
        recommendedPrice: z.number(),
        fastSalePrice: z.number(),
        highValuePrice: z.number(),
        marketMin: z.number(),
        marketMax: z.number(),
        sellabilityScore: z.number(),
        confidenceScore: z.number(),
        intlPriceUSD: z.number().optional(),
        // Thai Market Factor
        thaiMarketTier: z.string().optional(),
        thaiMarketDiscount: z.number().optional(),
        internationalBasePrice: z.number().optional(),
        consensusLevel: z.string().optional(),
        agentCount: z.number().optional(),
        imageBase64: z.string().optional(),
        imageMimeType: z.string().optional(),
        listingData: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Upload image to S3 if provided
      let imageUrl: string | null = null;
      if (input.imageBase64) {
        try {
          const buffer = Buffer.from(input.imageBase64, "base64");
          const ext = input.imageMimeType?.includes("png") ? "png" : "jpg";
          const key = `pricing-history/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const result = await storagePut(key, buffer, input.imageMimeType || "image/jpeg");
          imageUrl = result.url;
        } catch (e) {
          console.warn("[History] Failed to upload image:", e);
        }
      }

      const userId = ctx.user?.id ?? null;

      const [inserted] = await db.insert(pricingHistory).values({
        userId,
        category: input.category,
        brand: input.brand,
        size: input.size,
        condition: input.condition,
        defectLevel: input.defectLevel || null,
        color: input.color || null,
        style: input.style || null,
        originalPrice: input.originalPrice ? Math.round(input.originalPrice) : null,
        recommendedPrice: Math.round(input.recommendedPrice),
        fastSalePrice: Math.round(input.fastSalePrice),
        highValuePrice: Math.round(input.highValuePrice),
        marketMin: Math.round(input.marketMin),
        marketMax: Math.round(input.marketMax),
        sellabilityScore: Math.round(input.sellabilityScore),
        confidenceScore: Math.round(input.confidenceScore),
        intlPriceUSD: input.intlPriceUSD ? Math.round(input.intlPriceUSD) : null,
        thaiMarketTier: input.thaiMarketTier || null,
        thaiMarketDiscount: input.thaiMarketDiscount ? Math.round(input.thaiMarketDiscount) : null,
        internationalBasePrice: input.internationalBasePrice ? Math.round(input.internationalBasePrice) : null,
        consensusLevel: input.consensusLevel || null,
        agentCount: input.agentCount || null,
        imageUrl,
        listingData: input.listingData || null,
      });

      return { success: true, id: inserted.insertId };
    }),

  /**
   * ดึงประวัติการประเมินราคา
   * ถ้า login → ดึงของ user นั้น
   * ถ้า guest → return empty (ต้อง login เพื่อดูประวัติ)
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const userId = ctx.user?.id;
      if (!userId) return { items: [], total: 0 };

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const items = await db
        .select()
        .from(pricingHistory)
        .where(eq(pricingHistory.userId, userId))
        .orderBy(desc(pricingHistory.createdAt))
        .limit(limit)
        .offset(offset);

      // Count total
      const countResult = await db
        .select({ count: pricingHistory.id })
        .from(pricingHistory)
        .where(eq(pricingHistory.userId, userId));

      return { items, total: countResult.length };
    }),

  /**
   * ดึงรายละเอียดประวัติ 1 รายการ
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [item] = await db
        .select()
        .from(pricingHistory)
        .where(eq(pricingHistory.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบประวัติ" });
      }

      // Check ownership
      if (item.userId && ctx.user?.id && item.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึง" });
      }

      return item;
    }),

  /**
   * ลบประวัติ
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify ownership
      const [item] = await db
        .select()
        .from(pricingHistory)
        .where(eq(pricingHistory.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบประวัติ" });
      }

      if (item.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ลบ" });
      }

      await db.delete(pricingHistory).where(eq(pricingHistory.id, input.id));

      return { success: true };
    }),

  /**
   * บันทึกผลการขายจริง (สำหรับ pricing history learning)
   */
  recordSale: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        listedPrice: z.number().optional(),
        soldPrice: z.number(),
        salesChannel: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Verify ownership
      const [item] = await db
        .select()
        .from(pricingHistory)
        .where(eq(pricingHistory.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบประวัติ" });
      }

      if (item.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์แก้ไข" });
      }

      // Calculate days to sell
      const createdAt = item.createdAt;
      const soldAt = new Date();
      const daysToSell = Math.max(1, Math.round((soldAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));

      await db
        .update(pricingHistory)
        .set({
          listedPrice: input.listedPrice ? Math.round(input.listedPrice) : null,
          soldPrice: Math.round(input.soldPrice),
          soldAt,
          salesChannel: input.salesChannel || null,
          daysToSell,
        })
        .where(eq(pricingHistory.id, input.id));

      return { success: true, daysToSell };
    }),

  /**
   * อัปเดต listing data สำหรับ record ที่มีอยู่แล้ว
   */
  updateListing: publicProcedure
    .input(
      z.object({
        id: z.number(),
        listingData: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      await db
        .update(pricingHistory)
        .set({ listingData: input.listingData })
        .where(eq(pricingHistory.id, input.id));

      return { success: true };
    }),
});
