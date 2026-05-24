/**
 * Orders Router (cross-user marketplace purchases)
 * --------------------------------------------------------------------------
 *  - orders.create        → buyer reserves a listed item (item → "reserved")
 *  - orders.mine          → orders the current user is BUYING
 *  - orders.incoming      → pending orders the current user must act on (SELLING)
 *  - orders.sellerAction  → seller confirm (→ sold) or cancel (→ back to listed)
 *
 * Place at: server/routers/orders.ts
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { wardrobe, orders } from "../../drizzle/schema";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database not configured.",
    });
  }
  return db;
}

export const ordersRouter = router({
  // Buyer reserves a listed item from another user's closet.
  create: protectedProcedure
    .input(
      z.object({
        itemId: z.number().int().positive(),
        outfitId: z.number().int().positive().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [item] = await db
        .select()
        .from(wardrobe)
        .where(eq(wardrobe.id, input.itemId))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบสินค้า" });
      if (item.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ซื้อเสื้อผ้าของตัวเองไม่ได้" });
      }
      if (item.status !== "listed") {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            item.status === "reserved"
              ? "ชิ้นนี้มีคนจองแล้ว"
              : item.status === "sold"
                ? "ชิ้นนี้ขายไปแล้ว"
                : "ชิ้นนี้ยังไม่ได้ลงขาย",
        });
      }
      const price = item.listedPrice ?? 0;
      if (price <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "สินค้านี้ยังไม่มีราคา" });
      }

      // Hold the item.
      await db
        .update(wardrobe)
        .set({ status: "reserved" })
        .where(and(eq(wardrobe.id, item.id), eq(wardrobe.status, "listed")));

      const inserted = await db
        .insert(orders)
        .values({
          buyerUserId: ctx.user.id,
          sellerUserId: item.userId,
          itemId: item.id,
          outfitId: input.outfitId ?? null,
          priceBaht: price,
          note: input.note ?? null,
          status: "pending",
        })
        .$returningId();

      const newId = Array.isArray(inserted) ? (inserted[0] as any)?.id : undefined;
      return { success: true as const, orderId: newId, priceBaht: price };
    }),

  // Orders the current user placed (buying).
  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.buyerUserId, ctx.user.id))
      .orderBy(desc(orders.createdAt));
    return rows;
  }),

  // Pending orders the current user (as seller) needs to act on.
  incoming: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.sellerUserId, ctx.user.id))
      .orderBy(desc(orders.createdAt));
    return rows;
  }),

  // Seller confirms (→ sold) or cancels (→ item back to listed).
  sellerAction: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["confirm", "cancel"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบออเดอร์" });
      if (order.sellerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่ใช่ออเดอร์ของคุณ" });
      }
      if (order.status !== "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "ออเดอร์นี้ดำเนินการไปแล้ว" });
      }

      if (input.action === "confirm") {
        await db
          .update(orders)
          .set({ status: "confirmed" })
          .where(eq(orders.id, order.id));
        await db
          .update(wardrobe)
          .set({
            status: "sold",
            soldPrice: order.priceBaht,
            soldAt: new Date(),
            salesChannel: "sheowa-crossuser",
          })
          .where(eq(wardrobe.id, order.itemId));
        return { success: true as const, status: "confirmed" as const };
      }

      // cancel → release the item back to listed
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
      await db
        .update(wardrobe)
        .set({ status: "listed" })
        .where(and(eq(wardrobe.id, order.itemId), eq(wardrobe.status, "reserved")));
      return { success: true as const, status: "cancelled" as const };
    }),
});
