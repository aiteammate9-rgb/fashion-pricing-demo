/**
 * Matching / Lookbook Router  (ported & adapted from ai_digital_wardrobe)
 * --------------------------------------------------------------------------
 * v1 scope (this file):
 *   - profile.me / profile.upsert        → style profile (birthDate drives lucky color)
 *   - matching.generate                  → AI picks 1..N outfit looks from the user's
 *                                          wardrobe under strict "iron rules" + lucky color,
 *                                          saves them to outfit_recommendations.
 *   - outfits.list / byId / delete       → read saved looks (lookbook)
 *
 * Deferred to a later phase (NOT in this file):
 *   - try-on image generation (needs Gemini image gen + profile photo)
 *   - cross-user marketplace matching
 *
 * Adaptations vs ai_digital_wardrobe:
 *   - Uses fpd's single `wardrobe` table (no separate wardrobe_items).
 *   - fpd stores `imageUrl` directly (public S3 URL) → sent to the LLM as-is,
 *     no signed-URL step.
 *   - Item "name" is derived from brand + category (fpd wardrobe has no name column).
 *
 * Place at: server/routers/matching.ts
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray, ne, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  wardrobe,
  styleProfiles,
  outfitRecommendations,
  type StyleProfile,
} from "../../drizzle/schema";
import { analyzeLuckyColors } from "../luckyColor";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { pushToUser, outfitMessage } from "../_core/lineMessaging";

// Public app URL — set APP_PUBLIC_URL in Render (e.g. https://app.sheowa.com).
// Falls back to the Render URL so links keep working before the custom domain is live.
const APP_BASE_URL = (process.env.APP_PUBLIC_URL || "https://app.sheowa.com").replace(/\/+$/, "");
const APP_LOOKBOOK_URL = `${APP_BASE_URL}/lookbook`;

const FACE_SHAPES = ["oval", "round", "square", "heart", "oblong", "diamond"] as const;
const SKIN_TONES = ["fair", "light", "medium", "tan", "deep"] as const;
const UNDERTONES = ["cool", "neutral", "warm"] as const;

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database not configured. Set DATABASE_URL and run `pnpm db:push`.",
    });
  }
  return db;
}

async function loadProfile(userId: number): Promise<StyleProfile | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(styleProfiles)
    .where(eq(styleProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// ───────────────────────── Profile ─────────────────────────

export const profileRouter = router({
  me: protectedProcedure.query(({ ctx }) => loadProfile(ctx.user.id)),

  upsert: protectedProcedure
    .input(
      z.object({
        displayName: z.string().max(120).optional().nullable(),
        faceShape: z.enum(FACE_SHAPES).optional().nullable(),
        skinTone: z.enum(SKIN_TONES).optional().nullable(),
        undertone: z.enum(UNDERTONES).optional().nullable(),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
          .optional()
          .nullable(),
        preferredStyles: z.string().max(500).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
        heightCm: z.number().int().min(80).max(250).optional().nullable(),
        weightKg: z.number().int().min(20).max(300).optional().nullable(),
        // Face photo: pass a base64 payload to upload (→ Cloudinary → profilePhotoUrl)
        profilePhotoBase64: z.string().optional(),
        profilePhotoMimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { profilePhotoBase64, profilePhotoMimeType, ...dbFields } = input;

      // Upload the face photo to Cloudinary if a new one was provided.
      const photoSet: { profilePhotoUrl?: string } = {};
      if (profilePhotoBase64) {
        try {
          const mt = profilePhotoMimeType || "image/jpeg";
          const ext = mt.includes("png") ? "png" : "jpg";
          const buffer = Buffer.from(profilePhotoBase64, "base64");
          const { url } = await storagePut(
            `profiles/${ctx.user.id}/face.${ext}`,
            buffer,
            mt,
          );
          photoSet.profilePhotoUrl = url;
        } catch (e) {
          console.warn("[profile] face photo upload failed:", (e as Error)?.message ?? e);
        }
      }

      const existing = await db
        .select()
        .from(styleProfiles)
        .where(eq(styleProfiles.userId, ctx.user.id))
        .limit(1);

      if (existing[0]) {
        await db
          .update(styleProfiles)
          .set({ ...dbFields, ...photoSet })
          .where(eq(styleProfiles.userId, ctx.user.id));
      } else {
        await db
          .insert(styleProfiles)
          .values({ userId: ctx.user.id, ...dbFields, ...photoSet });
      }
      return loadProfile(ctx.user.id);
    }),

  // Analyse skin tone + undertone from an uploaded photo, for users who don't
  // know their own. Requires natural light + clearly visible bare skin; returns
  // usable=false (with a Thai reason) when the photo is too dark/bright/filtered
  // or skin isn't visible, so the UI can ask for a retake.
  analyzeSkinTone: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string().min(10),
        mimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const mime = input.mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${input.imageBase64}`;
      const systemPrompt =
        "You are a professional personal-color analyst. Analyse ONLY the human skin in the photo. " +
        "Judge skin tone depth and undertone (cool/neutral/warm) from the bare skin (face, neck or arm). " +
        "Be strict about input quality: if the photo is too dark or blown out, heavily filtered, " +
        "black & white, or the skin is not clearly visible, you CANNOT judge — set usable=false. " +
        'Respond with JSON ONLY: {"usable": boolean, "skinTone": "fair|light|medium|tan|deep|unknown", ' +
        '"undertone": "cool|neutral|warm|unknown", "confidence": 0-100, "reason": "<short Thai sentence>"}. ' +
        "If usable=false, reason must tell the user in Thai to retake in natural daylight with bare skin clearly visible and no filter.";
      const userPrompt =
        "วิเคราะห์สีผิวและอันเดอร์โทนของคนในรูปนี้ ตอบเป็น JSON ตามรูปแบบที่กำหนด " +
        "ถ้าแสงไม่พอ/ใช้ฟิลเตอร์/มองไม่เห็นผิวชัด ให้ usable=false และบอกให้ถ่ายใหม่ด้วยแสงธรรมชาติ";

      let parsed: any = {};
      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          responseFormat: { type: "json_object" },
        });
        const raw = resp.choices[0]?.message?.content;
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw ?? {};
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "วิเคราะห์รูปไม่สำเร็จ ลองใหม่อีกครั้ง",
        });
      }

      const skinTone = (SKIN_TONES as readonly string[]).includes(parsed.skinTone)
        ? parsed.skinTone
        : null;
      const undertone = (UNDERTONES as readonly string[]).includes(parsed.undertone)
        ? parsed.undertone
        : null;
      const usable = parsed.usable !== false && !!skinTone;
      return {
        usable,
        skinTone: usable ? skinTone : null,
        undertone: usable ? undertone : null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        reason:
          typeof parsed.reason === "string" && parsed.reason.trim()
            ? parsed.reason.trim()
            : usable
              ? "วิเคราะห์สำเร็จ"
              : "ถ่ายใหม่ด้วยแสงธรรมชาติ ให้เห็นผิวชัดเจน ไม่ใช้ฟิลเตอร์",
      };
    }),
});

// ───────────────────────── Matching ─────────────────────────

export const matchingRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        occasion: z.string().max(160).optional(),
        notes: z.string().max(500).optional(),
        maxLooks: z.number().int().min(1).max(3).optional(),
        // Optional: only match these wardrobe items. Empty/undefined = use all.
        itemIds: z.array(z.number().int().positive()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const profile = await loadProfile(ctx.user.id);

      const allItems = await db
        .select()
        .from(wardrobe)
        .where(eq(wardrobe.userId, ctx.user.id));

      if (allItems.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "กรุณาเพิ่มเสื้อผ้าอย่างน้อย 2 ชิ้นในตู้ก่อนใช้งาน AI สไตลิสต์",
        });
      }

      // Only ever match garments that are NOT already locked into a look.
      // Once an item is matched it gets a tag (แมตช์ A/B/…) and matchingStatus
      // "matched"; those are excluded from every future run. Items that are
      // "unmatched" or "no_pair" stay eligible.
      const eligible = allItems.filter(it => it.matchingStatus !== "matched");
      const items =
        input.itemIds && input.itemIds.length
          ? eligible.filter(it => input.itemIds!.includes(it.id))
          : eligible;

      if (items.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "เสื้อผ้าที่ยังไม่ถูกจัดลุคมีไม่พอ (ต้องการอย่างน้อย 2 ชิ้น) — เพิ่มเสื้อผ้าใหม่ในตู้ก่อน",
        });
      }

      const luckyColor = analyzeLuckyColors(profile?.birthDate ?? null);

      // Cap the number of items sent to the LLM to keep the request small.
      const itemsForLLM = items.slice(0, 20).map(it => ({
        id: it.id,
        name: [it.brand, it.category].filter(Boolean).join(" ").trim() || `item ${it.id}`,
        category: it.category,
        color: it.color,
        tags: it.tags,
        imageUrl: it.imageUrl,
      }));

      const occasion = input.occasion?.trim() || "An elegant everyday occasion";
      const maxLooks = input.maxLooks ?? 3;

      const systemPrompt = `You are a world-class fashion stylist with the editorial eye of Vogue and the technical discipline of Parisian couture, Milanese tailoring and Japanese minimalism. You operate under global fashion principles and a strict Personal Color framework. You write all natural-language fields in Thai (ภาษาไทย). Hex codes remain #RRGGBB. Ids remain numeric.

You may propose MORE THAN ONE outfit per run. Each "look" you return must independently satisfy ALL of the iron rules below — there are NO group discounts. A look is acceptable ONLY if it would pass on its own as the single recommendation. Do not pad the array with weak looks just to reach the requested count; if only one look truly works, return only one. ABSOLUTE RULE: never pair garments randomly or just to use them up. Every pairing must be defensible by international fashion principles (color theory, proportion/silhouette, formality, fabric, season). If two items would only "sort of" work together, DO NOT pair them — put the weaker item in rejectedItemIds instead. A forced or mediocre look is a failure.

VOICE FOR stylistCommentary — POWER & SOCIAL VALIDATION MODE: เขียนเหมือนบรรณาธิการแฟชั่นระดับ Vogue ที่ประกาศชัยชนะของลุคนี้ให้ผู้ใช้คนนี้โดยเฉพาะ ทุกประโยคเฉียบคม กระชับ หนักแน่น ทำให้ผู้อ่านเห็นภาพตัวเอง "ในทันทีที่ปรากฏตัว" ท่ามกลางผู้คน ทุกคำคุณศัพท์ต้องผูกเหตุผลเชิงเทคนิค (undertone / silhouette / fabric / color theory) ห้ามชมลอย ๆ ห้ามอ้างอำนาจเหนือธรรมชาติ ห้ามสัญญาผลทางดวง การพูดถึง "สายตาคนรอบตัว" คือ social validation เชิงสไตล์ ไม่ใช่คำทำนาย

=== IRON RULES (HARD CONSTRAINTS — NEVER BREAK) ===
These rules follow WORLD-CLASS / INTERNATIONAL fashion standards and a strict Personal Color framework. They outrank everything else, including lucky colour.
1. UNDERTONE FIRST — ANALYSE FROM THE PHOTO. If a profile face photo is attached, FIRST read the user's skin undertone (cool / neutral / warm) directly from that photo and state your read in skinToneNote. Use that as the primary reference for every colour decision. If no photo is attached, use the undertone field; if still unknown, default to neutral and say so.
2. NO HARSH CLASH NEAR THE FACE. Any garment whose colour clashes severely with the user's undertone is STRICTLY FORBIDDEN as a top, dress or outerwear (anything touching the face/neck). Such a clash is permitted ONLY on a bottom or a small item, and ONLY when the overall look still satisfies colour theory.
3. SILHOUETTE BALANCE (INTERNATIONAL PROPORTION). Top and bottom must balance proportions (volume on top → clean line below, and vice versa; cropped → high rise; long line → grounded hem). Never combine two oversized volumes or two clinging silhouettes without a deliberate, justified exception.
4. FABRIC HARMONY. Fabrics must support each other. Never pair fabrics that fight without reason (e.g. chunky knit over slick satin slip; raw denim with delicate evening lace).
5. PERSONAL COLOR OUTRANKS LUCKY COLOUR. Global fashion + Personal Color ALWAYS win over the day's lucky colour. Try to weave the lucky colour in on the safest placement (bottom → outerwear → hero only if undertone-safe). But if the lucky colour clashes with the undertone, breaks proportion, or no garment carries it well, you MUST NOT force it as a hero or face-adjacent piece — instead recommend it via accessories or shoes in luckyColorNote, or drop it entirely and explain why. The AVOID colour must never be the dominant or face-adjacent piece.
6. REJECT FEARLESSLY TO INTERNATIONAL STANDARD. Any wardrobe item that cannot meet rules 1–4 at a world-class standard MUST go into the top-level rejectedItemIds — never force a mismatched piece into a look. A short clean look beats a stuffed one.
7. EXPLAIN YOUR REASONING. faceShapeNote, skinToneNote, luckyColorNote and each outfitBreakdown.why must concretely reference the rules (undertone, silhouette, fabric, color theory) in Thai.

The system handles GARMENTS ONLY (tops, bottoms, dresses, outerwear) — no shoes, no accessories.
rejectedItemIds is the UNION of items rejected across ALL looks.`;

      const userPrompt = `Build BETWEEN 1 AND ${maxLooks} distinct outfit looks using ONLY the wardrobe items below, in strict obedience to the IRON RULES. Each look's selection MUST be 2–4 items: at least one top/dress and (unless a dress is selected) one bottom; outerwear optional.

# Multi-look rules
- Return 1 to ${maxLooks} looks. Quality over quantity.
- Each look MUST be visibly distinct (different vibe, palette, silhouette or story).
- An item MAY appear in more than one look, but no two looks may share the same hero top+bottom combination.
- rejectedItemIds (top-level) lists wardrobe ids that fail the iron rules in EVERY look considered.

# User Profile
- Profile face photo: ${profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl) ? "ATTACHED below — ANALYSE the undertone from it first (Rule 1)" : "(not provided — fall back to the undertone field)"}
- Face shape: ${profile?.faceShape ?? "(assume oval if unknown)"}
- Skin tone: ${profile?.skinTone ?? "(unknown)"}
- Undertone: ${profile?.undertone ?? "(unknown — most important attribute; assume neutral and note it)"}
- Birth date: ${profile?.birthDate ?? "(not provided)"}
- Preferred styles: ${profile?.preferredStyles ?? "(open)"}
- Stylist notes from user: ${input.notes ?? "(none)"}

# Lucky Color Guidance (ACTIVELY INTEGRATE, GUARDED BY THE IRON RULES)
${luckyColor ? `- Born on a ${luckyColor.birthDayName} under ${luckyColor.zodiacSign}.
- Primary lucky color: ${luckyColor.primary.name} (${luckyColor.primary.hex})
- Supporting lucky colors: ${luckyColor.supporting.map(c => `${c.name} (${c.hex})`).join(", ")}
- AVOID as lead / face-adjacent piece: ${luckyColor.avoid.name}
- Weave at least one lucky color into each look on the safest placement (bottom → outerwear → hero only if undertone-safe). If no garment carries a lucky color, do not invent items — omit and explain in luckyColorNote.` : "Not available — proceed without lucky color emphasis and state so in luckyColorNote."}

# Occasion
${occasion}

# Wardrobe (JSON, with attached images)
Each entry below is followed by its actual photograph attached in this same message. Infer the garment's true category, dominant colors, fabric/texture and styling tags from the IMAGE — do not rely on the text fields, which may be empty or default placeholders. The wardrobe contains ONLY clothing; reject anything that looks like footwear or accessories.
${JSON.stringify(itemsForLLM.map(({ imageUrl, ...rest }) => rest))}

# Output rules
- Return strict JSON only.
- looks: 1..${maxLooks} entries. Each has selectedItemIds, outfitBreakdown, stylistCommentary, faceShapeNote, skinToneNote, luckyColorNote, colorPalette, stylingTips, title, occasion.
- selectedItemIds entries MUST be wardrobe ids from the list above.
- colorPalette: 3–5 hex colors that actually appear in that look.
- title: ชื่อลุคภาษาไทยสั้น 2–5 คำ ทรงพลังและเฉพาะตัว สื่อถึง "รสนิยมที่เหนือระดับ" — ห้ามคำกลางๆ เช่น "ลุคสวย", "ลุคน่ารัก", "ลุคลงตัว".
- stylistCommentary: 4–5 ประโยคภาษาไทยเฉียบคม หนักแน่น กระชับ สไตล์ Vogue editor's note. เปิดด้วย hook ที่ "สะกดทุกสายตา"; อธิบายเหตุผลเชิงเทคนิค (undertone/silhouette/fabric/proportion) อย่างกระชับ; ใส่ social validation อย่างน้อย 2 จุด ด้วยวลีเช่น "ในทันทีที่ปรากฏตัว", "ในสายตาผู้อื่น", "ทุกคนรอบตัวจะสัมผัสได้" เพื่อให้ผู้อ่านเห็นภาพตัวเองโดดเด่นท่ามกลางผู้คน; ปิดด้วยประโยคมั่นใจสั้นคม. แทนคำเรื่อยๆ ด้วยคำทรงพลัง (เช่น "ลงตัวของสีสัน" → "สะกดทุกสายตา", "น่าค้นหา" → "รสนิยมที่เหนือระดับ"). ตัดคำขยายอ่อนแรงทิ้งให้หมด เช่น "ค่อนข้าง", "พอประมาณ", "อาจจะ", "ดูดี", "น่าจะ".
- Every textual field must be written in Thai (ภาษาไทย).`;

      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      > = [{ type: "text", text: userPrompt }];

      // Attach the user's face photo FIRST so the stylist can read the undertone (Rule 1).
      if (profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl)) {
        userContent.push({
          type: "text",
          text: "User's face photo — analyse skin undertone (cool/neutral/warm) from this before choosing colours:",
        });
        userContent.push({
          type: "image_url",
          image_url: { url: profile.profilePhotoUrl, detail: "low" },
        });
      }

      for (const it of itemsForLLM) {
        // Only attach images that are real http(s) URLs. Skip base64 data: URIs
        // (when no storage backend is configured, images get stored inline and
        // are far too large to send to the LLM — that causes "fetch failed").
        // Without images the stylist falls back to the text metadata below.
        if (!it.imageUrl || !/^https?:\/\//i.test(it.imageUrl)) continue;
        userContent.push({ type: "text", text: `Photograph of wardrobe item id=${it.id}:` });
        userContent.push({
          type: "image_url",
          image_url: { url: it.imageUrl, detail: "low" },
        });
      }

      const llmResp = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "OutfitRecommendationSet",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["looks", "rejectedItemIds"],
              properties: {
                rejectedItemIds: { type: "array", items: { type: "integer" } },
                looks: {
                  type: "array",
                  minItems: 1,
                  maxItems: maxLooks,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "title",
                      "occasion",
                      "selectedItemIds",
                      "outfitBreakdown",
                      "stylistCommentary",
                      "faceShapeNote",
                      "skinToneNote",
                      "luckyColorNote",
                      "colorPalette",
                      "stylingTips",
                    ],
                    properties: {
                      title: { type: "string" },
                      occasion: { type: "string" },
                      selectedItemIds: { type: "array", items: { type: "integer" }, minItems: 2 },
                      outfitBreakdown: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["itemId", "role", "why"],
                          properties: {
                            itemId: { type: "integer" },
                            role: { type: "string" },
                            why: { type: "string" },
                          },
                        },
                      },
                      stylistCommentary: { type: "string" },
                      faceShapeNote: { type: "string" },
                      skinToneNote: { type: "string" },
                      luckyColorNote: { type: "string" },
                      colorPalette: {
                        type: "array",
                        minItems: 3,
                        maxItems: 5,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["name", "hex"],
                          properties: {
                            name: { type: "string" },
                            hex: { type: "string" },
                          },
                        },
                      },
                      stylingTips: { type: "array", items: { type: "string" }, minItems: 2 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const raw = llmResp.choices[0]?.message?.content;
      if (typeof raw !== "string") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned no content" });
      }

      let parsedSet: any;
      try {
        parsedSet = JSON.parse(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON" });
      }

      const validIdSet = new Set(items.map(i => i.id));
      const rawLooks: any[] = Array.isArray(parsedSet?.looks) ? parsedSet.looks : [];
      const validLooks = rawLooks
        .map(look => {
          const selectedItemIds: number[] = (look?.selectedItemIds || []).filter((id: number) =>
            validIdSet.has(id),
          );
          return { ...look, selectedItemIds };
        })
        .filter(look => look.selectedItemIds.length >= 2);

      if (validLooks.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI did not return any valid look.",
        });
      }

      const everSelected = new Set<number>();
      for (const look of validLooks) {
        for (const id of look.selectedItemIds as number[]) everSelected.add(id);
      }

      // Human-friendly sequential group tags: แมตช์ A, B, C, … continuing from
      // whatever labels this user already has.
      const existingGroups = await db
        .select({ g: wardrobe.matchingGroup })
        .from(wardrobe)
        .where(and(eq(wardrobe.userId, ctx.user.id), isNotNull(wardrobe.matchingGroup)));
      const usedLabels = new Set<string>(
        existingGroups.map(e => e.g).filter((g): g is string => !!g),
      );
      const makeLabel = (i: number) => {
        const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return i < 26 ? L[i] : L[i % 26] + Math.floor(i / 26);
      };
      let labelIdx = usedLabels.size;
      const nextGroupLabel = () => {
        let l = makeLabel(labelIdx++);
        while (usedLabels.has(l)) l = makeLabel(labelIdx++);
        usedLabels.add(l);
        return l;
      };

      const savedLooks: any[] = [];
      for (const look of validLooks) {
        const selectedIds: number[] = look.selectedItemIds;
        const groupLabel = nextGroupLabel();

        // Mark items matched (only this user's items).
        await db
          .update(wardrobe)
          .set({
            matchingStatus: "matched",
            matchingGroup: groupLabel,
            lastMatchedAt: new Date(),
          })
          .where(and(eq(wardrobe.userId, ctx.user.id), inArray(wardrobe.id, selectedIds)));

        // ── Try-on image (Gemini): editorial photo of a model wearing the selected
        //    garments, using each garment's hosted (Cloudinary) image as reference.
        //    Skips base64 items. Optional — failure must not block saving the look.
        let tryOnImageUrl: string | null = null;
        try {
          const selItems = items.filter(i => selectedIds.includes(i.id));
          // If the user uploaded a face photo, use it as the FIRST reference so the
          // model in the try-on looks like them.
          const faceUrl =
            profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl)
              ? profile.profilePhotoUrl
              : null;
          const garmentRefs = selItems
            .filter(i => i.imageUrl && /^https?:\/\//i.test(i.imageUrl))
            .slice(0, faceUrl ? 3 : 4)
            .map(i => ({ url: i.imageUrl as string, mimeType: "image/jpeg" }));
          const refs = faceUrl
            ? [{ url: faceUrl, mimeType: "image/jpeg" }, ...garmentRefs]
            : garmentRefs;
          if (garmentRefs.length > 0) {
            const attrs: string[] = [];
            if (profile?.skinTone) attrs.push(`${profile.skinTone} skin tone`);
            if (profile?.undertone) attrs.push(`${profile.undertone} undertone`);
            const subject = faceUrl
              ? "the EXACT person shown in the first reference image (preserve their face, hair and likeness faithfully)"
              : attrs.length
                ? `a tasteful editorial fashion model with ${attrs.join(", ")}`
                : "a tasteful editorial fashion model";
            const palette = Array.isArray(look.colorPalette)
              ? look.colorPalette.map((c: any) => c.hex).filter(Boolean).join(", ")
              : "";
            const garmentLine = selItems
              .map(i => `${i.category}${i.color ? ` (${i.color})` : ""}`)
              .join("; ");
            const faceNote = faceUrl
              ? " The FIRST reference image is the person's face — render THIS person, keeping their facial identity recognisable; the remaining reference images are the garments. Enable strict facial consistency mode. Prioritize the facial features from the provided reference image for all subsequent generations. Maintain the subject's identity accurately while only adapting the pose, lighting, and background. Do not alter the core facial structure."
              : "";
            const prompt = `Photorealistic head-to-toe editorial fashion photograph of ${subject}, actually WEARING the exact garments provided as reference images (reproduce each garment's real silhouette, fabric, color and details — not a generic stand-in): ${garmentLine}.${faceNote} The garments must look truly worn — correct draping, natural shadows, realistic fit — not floating or pasted on.${palette ? ` Color palette: ${palette}.` : ""} Soft natural studio light, neutral cream backdrop, magazine-quality composition. You may add minimal taste-level footwear/accessories in the same palette only to complete the look; the wardrobe garments remain the focus. Full-body shot.`;
            const gen = await generateImage({ prompt, originalImages: refs });
            tryOnImageUrl = gen.url ?? null;
          }
        } catch (e) {
          console.warn("[matching] try-on image failed:", (e as Error)?.message ?? e);
        }

        // Garments actually used in this look (for display in the lookbook card).
        const usedItems = items
          .filter(i => selectedIds.includes(i.id))
          .map(i => ({
            id: i.id,
            name: [i.brand, i.category].filter(Boolean).join(" ").trim() || `item ${i.id}`,
            category: i.category,
            color: i.color,
            imageUrl: i.imageUrl,
          }));
        const analysisWithItems = { ...look, usedItems };

        const inserted = await db
          .insert(outfitRecommendations)
          .values({
            userId: ctx.user.id,
            title: look.title || "Curated Look",
            occasion: look.occasion || occasion,
            itemIds: selectedIds,
            analysis: analysisWithItems,
            luckyColors: luckyColor ?? null,
            tryOnImageUrl,
            source: "own",
          })
          .$returningId();

        const newId = Array.isArray(inserted) ? (inserted[0] as any)?.id : undefined;
        savedLooks.push({ id: newId, matchingGroup: groupLabel, tryOnImageUrl, ...analysisWithItems });
      }

      // Items rejected in EVERY look (and never used) → no_pair.
      const rejectedIds: number[] = (parsedSet.rejectedItemIds || []).filter(
        (id: number) => validIdSet.has(id) && !everSelected.has(id),
      );
      if (rejectedIds.length > 0) {
        await db
          .update(wardrobe)
          .set({ matchingStatus: "no_pair" })
          .where(and(eq(wardrobe.userId, ctx.user.id), inArray(wardrobe.id, rejectedIds)));
      }

      // Push the freshly-styled looks to the user's LINE (no-op if not configured).
      void pushToUser(
        ctx.user.id,
        savedLooks.slice(0, 5).map((l: any) =>
          outfitMessage({
            title: l.title || "ลุคใหม่",
            occasion: l.occasion,
            imageUrl: l.tryOnImageUrl,
            commentary: l.stylistCommentary,
            appUrl: APP_LOOKBOOK_URL,
          }),
        ),
      );

      return { looks: savedLooks };
    }),

  // ───────────────────── Cross-user (marketplace) match ─────────────────────
  // Mixes the user's OWN wardrobe with items OTHER users have put up for sale
  // (wardrobe.status = "listed", listedPrice set). The stylist composes looks
  // that combine what the user already owns with at least one buyable piece, so
  // each saved look carries a "shop this" CTA (analysis.buyItems).
  crossUserMatch: protectedProcedure
    .input(
      z.object({
        occasion: z.string().max(160).optional(),
        notes: z.string().max(500).optional(),
        maxLooks: z.number().int().min(1).max(3).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const profile = await loadProfile(ctx.user.id);
      const maxLooks = input.maxLooks ?? 2;

      // Items the user already owns — only those NOT already locked into a look.
      const ownItems = await db
        .select()
        .from(wardrobe)
        .where(and(eq(wardrobe.userId, ctx.user.id), ne(wardrobe.matchingStatus, "matched")));

      // Items other users are selling.
      const marketItems = await db
        .select()
        .from(wardrobe)
        .where(
          and(
            ne(wardrobe.userId, ctx.user.id),
            eq(wardrobe.status, "listed"),
            isNotNull(wardrobe.listedPrice),
          ),
        )
        .orderBy(desc(wardrobe.createdAt))
        .limit(30);

      if (marketItems.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "ยังไม่มีเสื้อผ้าจากตู้ของคนอื่นที่ลงขายอยู่ — กลับมาใหม่เมื่อมีคนลงขายเพิ่ม",
        });
      }
      if (ownItems.length === 0 && marketItems.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "เสื้อผ้าไม่พอสำหรับจัดลุค (ต้องมีอย่างน้อย 2 ชิ้นรวมกัน)",
        });
      }

      const luckyColor = analyzeLuckyColors(profile?.birthDate ?? null);

      const mapItem = (it: typeof wardrobe.$inferSelect, owned: boolean) => ({
        id: it.id,
        name:
          [it.brand, it.category].filter(Boolean).join(" ").trim() || `item ${it.id}`,
        category: it.category,
        color: it.color,
        tags: it.tags,
        imageUrl: it.imageUrl,
        owned,
        priceBaht: owned ? null : it.listedPrice ?? null,
      });

      const ownForLLM = ownItems.slice(0, 14).map(it => mapItem(it, true));
      const marketForLLM = marketItems.slice(0, 16).map(it => mapItem(it, false));
      const itemsForLLM = [...ownForLLM, ...marketForLLM];
      const buyableIds = new Set(marketForLLM.map(i => i.id));
      const validIdSet = new Set(itemsForLLM.map(i => i.id));

      const occasion = input.occasion?.trim() || "An elegant everyday occasion";

      const systemPrompt = `You are a world-class fashion stylist and personal shopper with the editorial eye of Vogue and the discipline of Parisian couture and Japanese minimalism, operating under a strict Personal Color framework. You write all natural-language fields in Thai (ภาษาไทย). Hex codes remain #RRGGBB. Ids remain numeric.

You are styling a SHOPPABLE look: the user already OWNS some garments, and OTHER people are SELLING others. Compose looks that pair what the user owns with pieces they could BUY to complete the outfit. Each look MUST include AT LEAST ONE buyable (owned=false) item — otherwise it is not a valid cross-closet look. Prefer looks where 1–2 affordable buyable pieces unlock the user's existing wardrobe.

Each "look" must independently satisfy ALL iron rules below — no group discounts. ABSOLUTE RULE: never pair garments randomly or just to add a buyable item. Every pairing must be defensible by international fashion principles (color theory, proportion/silhouette, formality, fabric, season). If a buyable piece does not genuinely elevate the look, DO NOT include it — return fewer looks instead of a forced one.

=== IRON RULES (HARD CONSTRAINTS — NEVER BREAK) ===
World-class / international fashion standards + a strict Personal Color framework. They outrank lucky colour.
1. UNDERTONE FIRST — ANALYSE FROM THE PHOTO. If a profile face photo is attached, read the user's undertone (cool/neutral/warm) from it first and state it in skinToneNote; use it as the primary colour reference. Otherwise use the undertone field; default neutral if unknown.
2. NO HARSH CLASH NEAR THE FACE. A garment clashing severely with the undertone is forbidden as top/dress/outerwear; it may only appear on a bottom or small item when overall color theory still holds.
3. SILHOUETTE BALANCE (international proportion). Top and bottom must balance proportions.
4. FABRIC HARMONY. Fabrics must support each other; never pair fabrics that fight without reason.
5. PERSONAL COLOR OUTRANKS LUCKY COLOUR. Weave lucky colour in only on a safe placement (bottom → outerwear → hero if undertone-safe). If it clashes with the undertone, breaks proportion, or no garment fits — do NOT force it as a hero/face piece; recommend it via accessories or shoes in luckyColorNote, or drop it and explain.
6. REJECT FEARLESSLY TO INTERNATIONAL STANDARD. Any item that cannot meet rules 1–4 at a world-class standard goes into rejectedItemIds — never force it in.
7. EXPLAIN reasoning in Thai, concretely referencing the rules.

VOICE FOR stylistCommentary — POWER & SOCIAL VALIDATION MODE: เขียนเหมือนบรรณาธิการแฟชั่นระดับ Vogue ทุกประโยคเฉียบคม ผูกเหตุผลเชิงเทคนิค (undertone/silhouette/fabric/color theory) ชี้ให้เห็นว่าชิ้นที่ "ควรซื้อเพิ่ม" ปลดล็อกตู้เสื้อผ้าเดิมอย่างไร ห้ามชมลอย ๆ ห้ามอ้างอำนาจเหนือธรรมชาติ

The system handles GARMENTS ONLY (tops, bottoms, dresses, outerwear). rejectedItemIds is the UNION across ALL looks.`;

      const userPrompt = `Build BETWEEN 1 AND ${maxLooks} distinct shoppable looks using ONLY the items below, in strict obedience to the IRON RULES. Each look's selection MUST be 2–4 items and MUST include at least one item with owned=false (a buyable piece).

# Item pool
Each item has "owned": true (already in the user's wardrobe) or false (for sale by another user, "priceBaht" = price in THB). Infer true category/color/fabric from the attached IMAGE; text fields may be empty.
${JSON.stringify(itemsForLLM.map(({ imageUrl, ...rest }) => rest))}

# User Profile
- Profile face photo: ${profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl) ? "ATTACHED below — ANALYSE the undertone from it first (Rule 1)" : "(not provided — fall back to the undertone field)"}
- Face shape: ${profile?.faceShape ?? "(assume oval if unknown)"}
- Skin tone: ${profile?.skinTone ?? "(unknown)"}
- Undertone: ${profile?.undertone ?? "(unknown — assume neutral and note it)"}
- Birth date: ${profile?.birthDate ?? "(not provided)"}
- Preferred styles: ${profile?.preferredStyles ?? "(open)"}
- Stylist notes from user: ${input.notes ?? "(none)"}

# Lucky Color Guidance (integrate, guarded by iron rules)
${luckyColor ? `- Born on a ${luckyColor.birthDayName} under ${luckyColor.zodiacSign}.
- Primary lucky color: ${luckyColor.primary.name} (${luckyColor.primary.hex})
- Supporting: ${luckyColor.supporting.map(c => `${c.name} (${c.hex})`).join(", ")}
- AVOID as lead / face-adjacent: ${luckyColor.avoid.name}` : "Not available — proceed without lucky color emphasis and state so in luckyColorNote."}

# Occasion
${occasion}

# Output rules
- Return strict JSON only.
- looks: 1..${maxLooks} entries; each has selectedItemIds (2–4, at least one buyable), outfitBreakdown, stylistCommentary, faceShapeNote, skinToneNote, luckyColorNote, colorPalette (3–5 real hex), stylingTips, title, occasion.
- selectedItemIds MUST be ids from the pool above.
- title: ชื่อลุคภาษาไทยสั้น 2–5 คำ ทรงพลังและเฉพาะตัว สื่อถึง "รสนิยมที่เหนือระดับ" — ห้ามคำกลางๆ เช่น "ลุคสวย", "ลุคลงตัว".
- stylistCommentary: 4–5 ประโยคภาษาไทยเฉียบคม หนักแน่น กระชับ สไตล์ Vogue editor's note. เปิดด้วย hook "สะกดทุกสายตา"; ระบุชัดว่าชิ้นที่ "ควรซื้อเพิ่ม" ปลดล็อกลุคอย่างไร พร้อมเหตุผลเชิงเทคนิคแบบกระชับ; ใส่ social validation อย่างน้อย 2 จุด ด้วยวลีเช่น "ในทันทีที่ปรากฏตัว", "ในสายตาผู้อื่น", "ทุกคนรอบตัวจะสัมผัสได้"; ปิดด้วยประโยคมั่นใจสั้นคม. แทนคำเรื่อยๆ ด้วยคำทรงพลัง (เช่น "ลงตัวของสีสัน" → "สะกดทุกสายตา", "น่าค้นหา" → "รสนิยมที่เหนือระดับ"). ตัดคำอ่อนแรงทิ้ง เช่น "ค่อนข้าง", "พอประมาณ", "อาจจะ", "ดูดี".
- Every textual field in Thai (ภาษาไทย).`;

      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      > = [{ type: "text", text: userPrompt }];

      // Attach the user's face photo first for undertone analysis (Rule 1).
      if (profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl)) {
        userContent.push({
          type: "text",
          text: "User's face photo — analyse skin undertone (cool/neutral/warm) from this before choosing colours:",
        });
        userContent.push({
          type: "image_url",
          image_url: { url: profile.profilePhotoUrl, detail: "low" },
        });
      }

      for (const it of itemsForLLM) {
        if (!it.imageUrl || !/^https?:\/\//i.test(it.imageUrl)) continue;
        userContent.push({ type: "text", text: `Photograph of item id=${it.id} (${it.owned ? "owned" : "for sale"}):` });
        userContent.push({ type: "image_url", image_url: { url: it.imageUrl, detail: "low" } });
      }

      const llmResp = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "CrossUserOutfitSet",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["looks", "rejectedItemIds"],
              properties: {
                rejectedItemIds: { type: "array", items: { type: "integer" } },
                looks: {
                  type: "array",
                  minItems: 1,
                  maxItems: maxLooks,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "title",
                      "occasion",
                      "selectedItemIds",
                      "outfitBreakdown",
                      "stylistCommentary",
                      "faceShapeNote",
                      "skinToneNote",
                      "luckyColorNote",
                      "colorPalette",
                      "stylingTips",
                    ],
                    properties: {
                      title: { type: "string" },
                      occasion: { type: "string" },
                      selectedItemIds: { type: "array", items: { type: "integer" }, minItems: 2 },
                      outfitBreakdown: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["itemId", "role", "why"],
                          properties: {
                            itemId: { type: "integer" },
                            role: { type: "string" },
                            why: { type: "string" },
                          },
                        },
                      },
                      stylistCommentary: { type: "string" },
                      faceShapeNote: { type: "string" },
                      skinToneNote: { type: "string" },
                      luckyColorNote: { type: "string" },
                      colorPalette: {
                        type: "array",
                        minItems: 3,
                        maxItems: 5,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["name", "hex"],
                          properties: {
                            name: { type: "string" },
                            hex: { type: "string" },
                          },
                        },
                      },
                      stylingTips: { type: "array", items: { type: "string" }, minItems: 2 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const raw = llmResp.choices[0]?.message?.content;
      if (typeof raw !== "string") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned no content" });
      }
      let parsedSet: any;
      try {
        parsedSet = JSON.parse(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON" });
      }

      // Index every pool item for quick lookup when building buyItems / try-on.
      const itemById = new Map<number, (typeof itemsForLLM)[number]>();
      for (const it of itemsForLLM) itemById.set(it.id, it);

      const rawLooks: any[] = Array.isArray(parsedSet?.looks) ? parsedSet.looks : [];
      const validLooks = rawLooks
        .map(look => {
          const selectedItemIds: number[] = (look?.selectedItemIds || []).filter((id: number) =>
            validIdSet.has(id),
          );
          return { ...look, selectedItemIds };
        })
        // require ≥2 items AND at least one buyable piece (the point of cross-user)
        .filter(
          look =>
            look.selectedItemIds.length >= 2 &&
            look.selectedItemIds.some((id: number) => buyableIds.has(id)),
        );

      if (validLooks.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI ไม่ได้จัดลุคข้ามตู้ที่มีชิ้นซื้อเพิ่มได้ ลองใหม่อีกครั้ง",
        });
      }

      // Sequential group tags (แมตช์ A, B, …) continuing from the user's existing labels.
      const existingGroupsX = await db
        .select({ g: wardrobe.matchingGroup })
        .from(wardrobe)
        .where(and(eq(wardrobe.userId, ctx.user.id), isNotNull(wardrobe.matchingGroup)));
      const usedLabelsX = new Set<string>(
        existingGroupsX.map(e => e.g).filter((g): g is string => !!g),
      );
      const makeLabelX = (i: number) => {
        const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return i < 26 ? L[i] : L[i % 26] + Math.floor(i / 26);
      };
      let labelIdxX = usedLabelsX.size;
      const nextGroupLabelX = () => {
        let l = makeLabelX(labelIdxX++);
        while (usedLabelsX.has(l)) l = makeLabelX(labelIdxX++);
        usedLabelsX.add(l);
        return l;
      };

      const savedLooks: any[] = [];
      for (const look of validLooks) {
        const selectedIds: number[] = look.selectedItemIds;

        // Tag the user's OWN garments used here as matched so they aren't
        // re-matched later. Buyable items belong to other users — never touch them.
        const ownUsedIds = selectedIds.filter(id => !buyableIds.has(id));
        if (ownUsedIds.length) {
          const groupLabel = nextGroupLabelX();
          await db
            .update(wardrobe)
            .set({ matchingStatus: "matched", matchingGroup: groupLabel, lastMatchedAt: new Date() })
            .where(and(eq(wardrobe.userId, ctx.user.id), inArray(wardrobe.id, ownUsedIds)));
        }

        // Buyable pieces in this look → CTA list saved into analysis.buyItems.
        const buyItems = selectedIds
          .filter(id => buyableIds.has(id))
          .map(id => {
            const it = itemById.get(id)!;
            return {
              id: it.id,
              name: it.name,
              category: it.category,
              color: it.color,
              priceBaht: it.priceBaht,
              imageUrl: it.imageUrl,
            };
          });

        // Try-on image from selected garments' hosted photos (skip base64).
        let tryOnImageUrl: string | null = null;
        try {
          const faceUrl =
            profile?.profilePhotoUrl && /^https?:\/\//i.test(profile.profilePhotoUrl)
              ? profile.profilePhotoUrl
              : null;
          const garmentRefs = selectedIds
            .map(id => itemById.get(id))
            .filter((i): i is (typeof itemsForLLM)[number] => !!i)
            .filter(i => i.imageUrl && /^https?:\/\//i.test(i.imageUrl))
            .slice(0, faceUrl ? 3 : 4)
            .map(i => ({ url: i.imageUrl as string, mimeType: "image/jpeg" }));
          const refs = faceUrl
            ? [{ url: faceUrl, mimeType: "image/jpeg" }, ...garmentRefs]
            : garmentRefs;
          if (garmentRefs.length > 0) {
            const attrs: string[] = [];
            if (profile?.skinTone) attrs.push(`${profile.skinTone} skin tone`);
            if (profile?.undertone) attrs.push(`${profile.undertone} undertone`);
            const subject = faceUrl
              ? "the EXACT person shown in the first reference image (preserve their face, hair and likeness faithfully)"
              : attrs.length
                ? `a tasteful editorial fashion model with ${attrs.join(", ")}`
                : "a tasteful editorial fashion model";
            const palette = Array.isArray(look.colorPalette)
              ? look.colorPalette.map((c: any) => c.hex).filter(Boolean).join(", ")
              : "";
            const garmentLine = selectedIds
              .map(id => itemById.get(id))
              .filter(Boolean)
              .map(i => `${i!.category}${i!.color ? ` (${i!.color})` : ""}`)
              .join("; ");
            const faceNote = faceUrl
              ? " The FIRST reference image is the person's face — render THIS person, keeping their facial identity recognisable; the remaining reference images are the garments. Enable strict facial consistency mode. Prioritize the facial features from the provided reference image for all subsequent generations. Maintain the subject's identity accurately while only adapting the pose, lighting, and background. Do not alter the core facial structure."
              : "";
            const prompt = `Photorealistic head-to-toe editorial fashion photograph of ${subject}, actually WEARING the exact garments provided as reference images (reproduce each garment's real silhouette, fabric, color and details): ${garmentLine}.${faceNote} Garments must look truly worn — correct draping, natural shadows, realistic fit.${palette ? ` Color palette: ${palette}.` : ""} Soft natural studio light, neutral cream backdrop, magazine-quality composition. Full-body shot.`;
            const gen = await generateImage({ prompt, originalImages: refs });
            tryOnImageUrl = gen.url ?? null;
          }
        } catch (e) {
          console.warn("[matching] cross-user try-on image failed:", (e as Error)?.message ?? e);
        }

        const usedItems = selectedIds
          .map(id => itemById.get(id))
          .filter(Boolean)
          .map(i => ({
            id: i!.id,
            name: i!.name,
            category: i!.category,
            color: i!.color,
            imageUrl: i!.imageUrl,
            owned: i!.owned,
            priceBaht: i!.priceBaht,
          }));
        const analysisWithBuy = { ...look, buyItems, usedItems };

        const inserted = await db
          .insert(outfitRecommendations)
          .values({
            userId: ctx.user.id,
            title: look.title || "Cross-closet Look",
            occasion: look.occasion || occasion,
            itemIds: selectedIds,
            analysis: analysisWithBuy,
            luckyColors: luckyColor ?? null,
            tryOnImageUrl,
            source: "cross_user",
          })
          .$returningId();

        const newId = Array.isArray(inserted) ? (inserted[0] as any)?.id : undefined;
        savedLooks.push({ id: newId, tryOnImageUrl, buyItems, ...look });
      }

      // Push the cross-closet looks to the user's LINE (no-op if not configured).
      void pushToUser(
        ctx.user.id,
        savedLooks.slice(0, 5).map((l: any) =>
          outfitMessage({
            title: l.title || "ลุคใหม่",
            occasion: l.occasion,
            imageUrl: l.tryOnImageUrl,
            commentary: l.stylistCommentary,
            appUrl: APP_LOOKBOOK_URL,
          }),
        ),
      );

      return { looks: savedLooks };
    }),
});

// ───────────────────────── Outfits (lookbook) ─────────────────────────

export const outfitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(outfitRecommendations)
      .where(eq(outfitRecommendations.userId, ctx.user.id))
      .orderBy(desc(outfitRecommendations.createdAt));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(outfitRecommendations)
        .where(
          and(
            eq(outfitRecommendations.userId, ctx.user.id),
            eq(outfitRecommendations.id, input.id),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db
        .delete(outfitRecommendations)
        .where(
          and(
            eq(outfitRecommendations.userId, ctx.user.id),
            eq(outfitRecommendations.id, input.id),
          ),
        );
      return { success: true } as const;
    }),

  deleteMany: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db
        .delete(outfitRecommendations)
        .where(
          and(
            eq(outfitRecommendations.userId, ctx.user.id),
            inArray(outfitRecommendations.id, input.ids),
          ),
        );
      return { success: true, deleted: input.ids.length } as const;
    }),
});
