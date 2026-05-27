/**
 * Wardrobe Router
 * 
 * CRUD operations for user's wardrobe items.
 * Items are saved after scanning/evaluation and stored permanently.
 */

import { eq, desc, and, sql, inArray, ne, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { wardrobe } from "../../drizzle/schema";
import { storagePut } from "../storage";

export const wardrobeRouter = router({
  // Save a new item to wardrobe
  save: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        brand: z.string(),
        color: z.string().optional(),
        material: z.string().optional(),
        condition: z.string(),
        conditionScore: z.number().optional(),
        defects: z.array(z.string()).optional(),
        size: z.string().optional(),
        height: z.number().optional(),
        weight: z.number().optional(),
        bust: z.number().optional(),
        shoulder: z.number().optional(),
        waist: z.number().optional(),
        hip: z.number().optional(),
        recommendedPrice: z.number().optional(),
        marketMin: z.number().optional(),
        marketMax: z.number().optional(),
        sellabilityScore: z.number().optional(),
        confidenceScore: z.number().optional(),
        imageUrl: z.string().optional(),
        imageUrl2: z.string().optional(),
        imageUrl3: z.string().optional(),
        // Base64 image upload fields
        imageBase64: z.string().optional(),
        imageMimeType: z.string().optional(),
        imageBase64_2: z.string().optional(),
        imageMimeType_2: z.string().optional(),
        imageBase64_3: z.string().optional(),
        imageMimeType_3: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Resolve each image to a public URL (Cloudinary). Accepts either a base64
      // field, or a data: URI passed in imageUrl. Real http(s) URLs are kept as-is.
      // This prevents storing huge base64 blobs in the DB (which broke the wardrobe
      // list and the AI matching request).
      const resolveImage = async (
        rawUrl: string | undefined,
        base64: string | undefined,
        mime: string | undefined,
        keyName: string,
      ): Promise<string | null> => {
        // Already a hosted URL → keep it.
        if (rawUrl && /^https?:\/\//i.test(rawUrl)) return rawUrl;

        let b64 = base64 || null;
        let mt = mime || "image/jpeg";

        // data: URI passed via imageUrl → extract the base64 payload.
        if (!b64 && rawUrl && rawUrl.startsWith("data:")) {
          const m = /^data:([^;]+);base64,(.+)$/.exec(rawUrl);
          if (m) {
            mt = m[1];
            b64 = m[2];
          }
        }

        if (!b64) return null;

        const ext = mt.includes("png") ? "png" : "jpg";
        const buffer = Buffer.from(b64, "base64");
        const { url } = await storagePut(`wardrobe/${ctx.user.id}/${keyName}.${ext}`, buffer, mt);
        return url;
      };

      let imgUrl1: string | null = null;
      let imgUrl2: string | null = null;
      let imgUrl3: string | null = null;

      try {
        imgUrl1 = await resolveImage(input.imageUrl, input.imageBase64, input.imageMimeType, "item");
        imgUrl2 = await resolveImage(input.imageUrl2, input.imageBase64_2, input.imageMimeType_2, "item_back");
        imgUrl3 = await resolveImage(input.imageUrl3, input.imageBase64_3, input.imageMimeType_3, "item_defect");
      } catch (e) {
        console.warn("[Wardrobe] Image upload failed:", e);
      }

      const result = await db.insert(wardrobe).values({
        userId: ctx.user.id,
        category: input.category,
        brand: input.brand,
        color: input.color || null,
        material: input.material || null,
        condition: input.condition,
        conditionScore: input.conditionScore || null,
        defects: input.defects ? JSON.stringify(input.defects) : null,
        size: input.size || null,
        height: input.height || null,
        weight: input.weight || null,
        bust: input.bust || null,
        shoulder: input.shoulder || null,
        waist: input.waist || null,
        hip: input.hip || null,
        recommendedPrice: input.recommendedPrice || null,
        marketMin: input.marketMin || null,
        marketMax: input.marketMax || null,
        sellabilityScore: input.sellabilityScore || null,
        confidenceScore: input.confidenceScore || null,
        imageUrl: imgUrl1,
        imageUrl2: imgUrl2,
        imageUrl3: imgUrl3,
        status: "in_wardrobe",
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // List all wardrobe items for the current user
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        category: z.string().optional(),
        status: z.enum(["in_wardrobe", "listed", "sold"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [eq(wardrobe.userId, ctx.user.id)];
      if (input.category) {
        conditions.push(eq(wardrobe.category, input.category));
      }
      if (input.status) {
        conditions.push(eq(wardrobe.status, input.status));
      }

      const whereClause = and(...conditions);

      const items = await db
        .select()
        .from(wardrobe)
        .where(whereClause)
        .orderBy(desc(wardrobe.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(wardrobe)
        .where(whereClause);

      // Defensive: drop legacy base64 data: URIs before sending to the client.
      // Old items saved before Cloudinary stored the whole image inline, which
      // made this list response huge and froze the wardrobe page. New items
      // store a Cloudinary https URL and pass through untouched.
      const stripDataUri = (u: string | null) =>
        u && u.startsWith("data:") ? null : u;

      return {
        items: items.map((item) => ({
          ...item,
          imageUrl: stripDataUri(item.imageUrl),
          imageUrl2: stripDataUri(item.imageUrl2),
          imageUrl3: stripDataUri(item.imageUrl3),
          defects: item.defects ? JSON.parse(item.defects) : [],
        })),
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Browse all items OTHER users have listed for sale (the Shop page).
  shopList: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(60).default(40),
        offset: z.number().min(0).default(0),
        category: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const conditions = [
        ne(wardrobe.userId, ctx.user.id),
        eq(wardrobe.status, "listed"),
        isNotNull(wardrobe.listedPrice),
      ];
      if (input.category) conditions.push(eq(wardrobe.category, input.category));
      const whereClause = and(...conditions);
      const rows = await db
        .select({
          id: wardrobe.id,
          sellerUserId: wardrobe.userId,
          brand: wardrobe.brand,
          category: wardrobe.category,
          color: wardrobe.color,
          size: wardrobe.size,
          condition: wardrobe.condition,
          imageUrl: wardrobe.imageUrl,
          listedPrice: wardrobe.listedPrice,
          sellabilityScore: wardrobe.sellabilityScore,
          createdAt: wardrobe.createdAt,
        })
        .from(wardrobe)
        .where(whereClause)
        .orderBy(desc(wardrobe.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(wardrobe)
        .where(whereClause);
      const stripDataUri = (u: string | null) => (u && u.startsWith("data:") ? null : u);
      return {
        items: rows.map(r => ({ ...r, imageUrl: stripDataUri(r.imageUrl) })),
        total: Number(countResult[0]?.count || 0),
      };
    }),

  // Delete a wardrobe item
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(wardrobe)
        .where(and(eq(wardrobe.id, input.id), eq(wardrobe.userId, ctx.user.id)));

      return { success: true };
    }),

  // Delete many wardrobe items at once (multi-select).
  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(wardrobe)
        .where(and(eq(wardrobe.userId, ctx.user.id), inArray(wardrobe.id, input.ids)));

      return { success: true, deleted: input.ids.length };
    }),

  // Mark item as sold (for pricing learning)
  markAsSold: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        listedPrice: z.number().optional(),
        soldPrice: z.number(),
        salesChannel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [item] = await db
        .select()
        .from(wardrobe)
        .where(and(eq(wardrobe.id, input.id), eq(wardrobe.userId, ctx.user.id)))
        .limit(1);

      if (!item) throw new Error("ไม่พบสินค้าในตู้");

      await db
        .update(wardrobe)
        .set({
          status: "sold",
          listedPrice: input.listedPrice ? Math.round(input.listedPrice) : null,
          soldPrice: Math.round(input.soldPrice),
          soldAt: new Date(),
          salesChannel: input.salesChannel || null,
        })
        .where(eq(wardrobe.id, input.id));

      return { success: true };
    }),

  // Mark item as listed
  markAsListed: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        listedPrice: z.number(),
        salesChannel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(wardrobe)
        .set({
          status: "listed",
          listedPrice: Math.round(input.listedPrice),
          salesChannel: input.salesChannel || null,
        })
        .where(and(eq(wardrobe.id, input.id), eq(wardrobe.userId, ctx.user.id)));

      return { success: true };
    }),

  // One-time: convert legacy base64 (data:) images already stored in the wardrobe
  // into hosted Cloudinary URLs, so old items also work with the AI try-on
  // (which needs real image URLs as references).
  migrateImages: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select()
      .from(wardrobe)
      .where(eq(wardrobe.userId, ctx.user.id));

    const uploadDataUri = async (
      val: string | null,
      keyName: string
    ): Promise<string | null> => {
      if (!val || !val.startsWith("data:")) return null; // already a URL or empty → skip
      const m = /^data:([^;]+);base64,(.+)$/.exec(val);
      if (!m) return null;
      const mime = m[1];
      const ext = mime.includes("png") ? "png" : "jpg";
      const buffer = Buffer.from(m[2], "base64");
      const { url } = await storagePut(
        `wardrobe/${ctx.user.id}/${keyName}_${Date.now()}.${ext}`,
        buffer,
        mime
      );
      return url;
    };

    let migrated = 0;
    for (const it of rows) {
      const set: { imageUrl?: string; imageUrl2?: string; imageUrl3?: string } = {};
      try {
        const u1 = await uploadDataUri(it.imageUrl, "item");
        if (u1) set.imageUrl = u1;
        const u2 = await uploadDataUri(it.imageUrl2, "item_back");
        if (u2) set.imageUrl2 = u2;
        const u3 = await uploadDataUri(it.imageUrl3, "item_defect");
        if (u3) set.imageUrl3 = u3;
        if (Object.keys(set).length > 0) {
          await db.update(wardrobe).set(set).where(eq(wardrobe.id, it.id));
          migrated++;
        }
      } catch (e) {
        console.warn("[Wardrobe] migrate image failed for item", it.id, (e as Error)?.message ?? e);
      }
    }
    return { migrated, total: rows.length };
  }),

  // Get wardrobe stats (count by category)
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, byCategory: [] };

    const items = await db
      .select({
        category: wardrobe.category,
        count: sql<number>`count(*)`,
      })
      .from(wardrobe)
      .where(eq(wardrobe.userId, ctx.user.id))
      .groupBy(wardrobe.category);

    const total = items.reduce((sum, item) => sum + Number(item.count), 0);

    return {
      total,
      byCategory: items.map((i) => ({
        category: i.category,
        count: Number(i.count),
      })),
    };
  }),
});
