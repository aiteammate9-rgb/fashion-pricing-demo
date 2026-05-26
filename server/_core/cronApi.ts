/**
 * Daily outfit-calendar reminder cron.
 * --------------------------------------------------------------------------
 * GET /api/cron/daily-outfit?key=CRON_SECRET
 *
 * Meant to be hit once each morning by an external scheduler
 * (e.g. cron-job.org). For every user whose calendar has TODAY planned and
 * not yet pushed, it sends a LINE flex card ("วันนี้ใส่ชุดนี้") and marks the
 * day as pushed so re-runs don't double-send.
 *
 * Why a cron endpoint instead of pre-loading 30 LINE messages? LINE has no
 * "schedule future message" API — you push when the day arrives. Render free
 * tier also sleeps, so an external pinger is the reliable trigger.
 */
import type { Express, Request, Response } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { ENV } from "./env";
import { getDb } from "../db";
import { outfitCalendar, outfitRecommendations } from "../../drizzle/schema";
import { pushToUser, outfitMessage, calendarMessage } from "./lineMessaging";
import { luckyNoteForDate } from "../luckyColor";

const APP_BASE_URL = (process.env.APP_PUBLIC_URL || "https://fashion-pricing-demo.onrender.com").replace(/\/+$/, "");
const APP_CALENDAR_URL = `${APP_BASE_URL}/calendar`;

function bkkToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function bkkWeekday(iso: string): number {
  return new Date(
    new Date(iso + "T00:00:00+07:00").toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  ).getDay(); // 0=Sun, 1=Mon
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00+07:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function registerCronApi(app: Express) {
  app.get("/api/cron/daily-outfit", async (req: Request, res: Response) => {
    // Auth: require a matching secret. If CRON_SECRET isn't configured, refuse.
    const key = (req.query.key as string) || req.get("x-cron-key") || "";
    if (!ENV.cronSecret || key !== ENV.cronSecret) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "db_unavailable" });
      return;
    }

    const today = bkkToday();
    const rows = await db
      .select({
        userId: outfitCalendar.userId,
        date: outfitCalendar.date,
        title: outfitRecommendations.title,
        imageUrl: outfitRecommendations.tryOnImageUrl,
        analysis: outfitRecommendations.analysis,
      })
      .from(outfitCalendar)
      .leftJoin(outfitRecommendations, eq(outfitCalendar.outfitId, outfitRecommendations.id))
      .where(and(eq(outfitCalendar.date, today), eq(outfitCalendar.pushed, 0)));

    let sent = 0;
    for (const r of rows) {
      if (!r.title) continue; // no look assigned that day
      const analysis: any = r.analysis ?? {};
      const ok = await pushToUser(r.userId, [
        outfitMessage({
          title: `วันนี้ใส่: ${r.title}`,
          occasion: luckyNoteForDate(today),
          imageUrl: r.imageUrl,
          commentary: analysis.stylistCommentary,
          appUrl: APP_CALENDAR_URL,
        }),
      ]);
      if (ok) sent++;
    }

    // Mark today's rows as pushed (whether or not LINE was configured — avoids
    // hammering on every cron tick; users without LINE simply get nothing).
    await db.update(outfitCalendar).set({ pushed: 1 }).where(
      and(eq(outfitCalendar.date, today), eq(outfitCalendar.pushed, 0)),
    );

    // Every Monday: also send the "open calendar" button to users who have a
    // plan in the coming week, so they can review the whole week in one tap.
    let weekly = 0;
    if (bkkWeekday(today) === 1) {
      const weekEnd = addDaysISO(today, 6);
      const upcoming = await db
        .select({ userId: outfitCalendar.userId })
        .from(outfitCalendar)
        .where(and(gte(outfitCalendar.date, today), lte(outfitCalendar.date, weekEnd)));
      const userIds = Array.from(new Set(upcoming.map(u => u.userId)));
      for (const uid of userIds) {
        const ok = await pushToUser(uid, [
          calendarMessage({
            calendarUrl: APP_CALENDAR_URL,
            title: "ปฏิทินแต่งตัวสัปดาห์นี้",
            subtitle: "ดูลุค 7 วันข้างหน้า + สีมงคลรายวัน",
          }),
        ]);
        if (ok) weekly++;
      }
    }

    res.json({ ok: true, date: today, candidates: rows.length, pushed: sent, weekly });
  });
}
