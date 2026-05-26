/**
 * Outfit Calendar Router (ปฏิทินแต่งตัว)
 * --------------------------------------------------------------------------
 * Plans which matched look the user wears on each day of a month, plus a
 * per-day lucky-color note (Thai day tradition) and an optional weather note
 * (Open-Meteo, Bangkok). We REUSE looks the user already matched — rotating
 * them across the month — instead of generating a new image per day, so a
 * full month costs nothing extra in image generation.
 *
 *   - calendar.generateMonth  → fill a month from the user's matched looks
 *   - calendar.month          → read one month's plan (joined w/ look image)
 *   - calendar.assignDay      → manually set/replace one day's look
 *   - calendar.clearDay       → clear one day
 *   - calendar.today          → today's planned look (for the home/today card)
 *
 * The daily LINE reminder is sent separately by /api/cron/daily-outfit.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, like, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { outfitCalendar, outfitRecommendations } from "../../drizzle/schema";
import { luckyNoteForDate } from "../luckyColor";
import { fetchWeatherNotes } from "../_core/weather";
import { pushToUser, weekFlexMessage } from "../_core/lineMessaging";

const APP_BASE_URL = (process.env.APP_PUBLIC_URL || "https://fashion-pricing-demo.onrender.com").replace(/\/+$/, "");
const APP_CALENDAR_URL = `${APP_BASE_URL}/calendar`;

/** Bangkok-local "today" as yyyy-mm-dd (en-CA gives ISO order). */
function bkkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00+07:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

const monthRe = /^\d{4}-\d{2}$/;

function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); // m is 1-based → day 0 of next month
  const out: string[] = [];
  for (let d = 1; d <= last; d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
  return out;
}

export const calendarRouter = router({
  /**
   * Fill a whole month with outfits, rotating through the user's matched looks.
   * Past days (for the current month) are skipped — only today onward is planned.
   */
  generateMonth: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(monthRe).optional(), // "yyyy-mm"; default = current
        outfitIds: z.array(z.number().int().positive()).optional(), // limit rotation to these looks
        includeWeather: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ฐานข้อมูลไม่พร้อม" });

      const month = input.month ?? bkkToday().slice(0, 7);

      // Pull the user's matched looks (newest first). Only looks that have a
      // try-on image are useful on the calendar card.
      const allLooks = await db
        .select()
        .from(outfitRecommendations)
        .where(eq(outfitRecommendations.userId, ctx.user.id))
        .orderBy(desc(outfitRecommendations.createdAt));

      let looks = allLooks.filter(l => !!l.tryOnImageUrl);
      if (input.outfitIds && input.outfitIds.length) {
        const want = new Set(input.outfitIds);
        looks = looks.filter(l => want.has(l.id));
      }
      if (looks.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ยังไม่มีลุคที่แมตช์ไว้ — แมตช์ชุดอย่างน้อย 1 ลุคก่อน แล้วค่อยจัดปฏิทิน",
        });
      }

      const today = bkkToday();
      let days = daysOfMonth(month);
      // For the current month, don't plan days that already passed.
      if (month === today.slice(0, 7)) days = days.filter(d => d >= today);
      if (days.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "เดือนนี้ผ่านไปแล้ว เลือกเดือนถัดไป" });
      }

      const weather = input.includeWeather ? await fetchWeatherNotes() : {};

      // Rotate looks across the planned days.
      let assigned = 0;
      for (let i = 0; i < days.length; i++) {
        const date = days[i];
        const look = looks[i % looks.length];
        const luckyNote = luckyNoteForDate(date);
        const weatherNote = weather[date] ?? null;
        await db
          .insert(outfitCalendar)
          .values({
            userId: ctx.user.id,
            date,
            outfitId: look.id,
            luckyNote,
            weatherNote,
            pushed: 0,
          })
          .onDuplicateKeyUpdate({
            set: { outfitId: look.id, luckyNote, weatherNote, pushed: 0 },
          });
        assigned++;
      }

      // Push to LINE right away (format A): a 7-day Flex carousel of the coming
      // week, each day with its outfit thumbnail + lucky note + open-calendar button.
      const weekEnd = addDaysISO(today, 6);
      const weekRows = await db
        .select({
          date: outfitCalendar.date,
          luckyNote: outfitCalendar.luckyNote,
          title: outfitRecommendations.title,
          imageUrl: outfitRecommendations.tryOnImageUrl,
        })
        .from(outfitCalendar)
        .leftJoin(outfitRecommendations, eq(outfitCalendar.outfitId, outfitRecommendations.id))
        .where(
          and(
            eq(outfitCalendar.userId, ctx.user.id),
            gte(outfitCalendar.date, today),
            lte(outfitCalendar.date, weekEnd),
          ),
        )
        .orderBy(outfitCalendar.date);
      if (weekRows.length) {
        void pushToUser(ctx.user.id, [
          weekFlexMessage({ days: weekRows, calendarUrl: APP_CALENDAR_URL }),
        ]);
        // Mark the days we just surfaced as pushed so the daily cron won't repeat them.
        await db
          .update(outfitCalendar)
          .set({ pushed: 1 })
          .where(
            and(
              eq(outfitCalendar.userId, ctx.user.id),
              gte(outfitCalendar.date, today),
              lte(outfitCalendar.date, weekEnd),
            ),
          );
      }

      return { month, assigned, looksUsed: looks.length };
    }),

  /** Read one month's plan, joined with the look's image + title. */
  month: protectedProcedure
    .input(z.object({ month: z.string().regex(monthRe).optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { month: input.month ?? bkkToday().slice(0, 7), days: [] as any[] };
      const month = input.month ?? bkkToday().slice(0, 7);
      const rows = await db
        .select({
          date: outfitCalendar.date,
          outfitId: outfitCalendar.outfitId,
          luckyNote: outfitCalendar.luckyNote,
          weatherNote: outfitCalendar.weatherNote,
          title: outfitRecommendations.title,
          occasion: outfitRecommendations.occasion,
          imageUrl: outfitRecommendations.tryOnImageUrl,
        })
        .from(outfitCalendar)
        .leftJoin(outfitRecommendations, eq(outfitCalendar.outfitId, outfitRecommendations.id))
        .where(and(eq(outfitCalendar.userId, ctx.user.id), like(outfitCalendar.date, `${month}-%`)))
        .orderBy(outfitCalendar.date);
      return { month, days: rows };
    }),

  /** Manually set (or replace) one day's look. */
  assignDay: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        outfitId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ฐานข้อมูลไม่พร้อม" });
      // Confirm the look belongs to the user.
      const own = await db
        .select({ id: outfitRecommendations.id })
        .from(outfitRecommendations)
        .where(and(eq(outfitRecommendations.userId, ctx.user.id), eq(outfitRecommendations.id, input.outfitId)))
        .limit(1);
      if (!own.length) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลุคนี้" });
      const luckyNote = luckyNoteForDate(input.date);
      await db
        .insert(outfitCalendar)
        .values({ userId: ctx.user.id, date: input.date, outfitId: input.outfitId, luckyNote, pushed: 0 })
        .onDuplicateKeyUpdate({ set: { outfitId: input.outfitId, luckyNote, pushed: 0 } });
      return { success: true } as const;
    }),

  /** Clear one day. */
  clearDay: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ฐานข้อมูลไม่พร้อม" });
      await db
        .delete(outfitCalendar)
        .where(and(eq(outfitCalendar.userId, ctx.user.id), eq(outfitCalendar.date, input.date)));
      return { success: true } as const;
    }),

  /** Today's planned look (for a home/today highlight card). */
  today: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const today = bkkToday();
    const rows = await db
      .select({
        date: outfitCalendar.date,
        outfitId: outfitCalendar.outfitId,
        luckyNote: outfitCalendar.luckyNote,
        weatherNote: outfitCalendar.weatherNote,
        title: outfitRecommendations.title,
        occasion: outfitRecommendations.occasion,
        imageUrl: outfitRecommendations.tryOnImageUrl,
      })
      .from(outfitCalendar)
      .leftJoin(outfitRecommendations, eq(outfitCalendar.outfitId, outfitRecommendations.id))
      .where(and(eq(outfitCalendar.userId, ctx.user.id), eq(outfitCalendar.date, today)))
      .limit(1);
    return rows[0] ?? null;
  }),
});
