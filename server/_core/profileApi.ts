/**
 * REST profile API for the WordPress storefront (sheowa.com).
 * --------------------------------------------------------------------------
 * The app's style profile lives in the DB (styleProfiles), tied to the LINE
 * login session cookie. Because sheowa.com and app.sheowa.com share the
 * cookie (Domain=.sheowa.com) + CORS allows credentials, the WP "โปรไฟล์ของฉัน"
 * form can read/write the SAME profile through these endpoints.
 *
 *   GET  /api/profile  → current user's style profile (or null)
 *   POST /api/profile  → upsert { birthDate, skinTone, undertone, preferredStyles,
 *                                 profilePhotoBase64, profilePhotoMimeType }
 */
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { styleProfiles } from "../../drizzle/schema";
import { storagePut } from "../storage";

const SKIN = new Set(["fair", "light", "medium", "tan", "deep"]);
const UNDER = new Set(["cool", "neutral", "warm"]);

async function currentUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

export function registerProfileApi(app: Express) {
  app.get("/api/profile", async (req: Request, res: Response) => {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "db_unavailable" });
      return;
    }
    const rows = await db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.userId, user.id))
      .limit(1);
    res.json({ profile: rows[0] ?? null });
  });

  app.post("/api/profile", async (req: Request, res: Response) => {
    const user = await currentUser(req);
    if (!user) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "db_unavailable" });
      return;
    }

    const b = req.body ?? {};
    const set: Record<string, unknown> = {};
    if (typeof b.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birthDate))
      set.birthDate = b.birthDate;
    if (b.birthDate === null || b.birthDate === "") set.birthDate = null;
    if (typeof b.skinTone === "string" && SKIN.has(b.skinTone)) set.skinTone = b.skinTone;
    if (typeof b.undertone === "string" && UNDER.has(b.undertone)) set.undertone = b.undertone;
    if (typeof b.preferredStyles === "string") set.preferredStyles = b.preferredStyles.slice(0, 500);

    // Optional face photo upload (base64).
    if (typeof b.profilePhotoBase64 === "string" && b.profilePhotoBase64) {
      try {
        const mt = typeof b.profilePhotoMimeType === "string" ? b.profilePhotoMimeType : "image/jpeg";
        const ext = mt.includes("png") ? "png" : "jpg";
        const buffer = Buffer.from(b.profilePhotoBase64, "base64");
        const { url } = await storagePut(`profiles/${user.id}/face.${ext}`, buffer, mt);
        set.profilePhotoUrl = url;
      } catch (e) {
        console.warn("[profileApi] photo upload failed:", (e as Error)?.message ?? e);
      }
    }

    try {
      const existing = await db
        .select()
        .from(styleProfiles)
        .where(eq(styleProfiles.userId, user.id))
        .limit(1);
      if (existing[0]) {
        await db.update(styleProfiles).set(set).where(eq(styleProfiles.userId, user.id));
      } else {
        await db.insert(styleProfiles).values({ userId: user.id, ...set });
      }
      const rows = await db
        .select()
        .from(styleProfiles)
        .where(eq(styleProfiles.userId, user.id))
        .limit(1);
      res.json({ success: true, profile: rows[0] ?? null });
    } catch (e) {
      console.error("[profileApi] upsert failed:", e);
      res.status(500).json({ error: "save_failed" });
    }
  });
}
