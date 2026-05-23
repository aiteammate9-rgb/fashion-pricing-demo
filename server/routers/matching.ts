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
import { and, desc, eq, inArray } from "drizzle-orm";
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const existing = await db
        .select()
        .from(styleProfiles)
        .where(eq(styleProfiles.userId, ctx.user.id))
        .limit(1);

      if (existing[0]) {
        await db
          .update(styleProfiles)
          .set({ ...input })
          .where(eq(styleProfiles.userId, ctx.user.id));
      } else {
        await db.insert(styleProfiles).values({ userId: ctx.user.id, ...input });
      }
      return loadProfile(ctx.user.id);
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

      const items = allItems.filter(
        it => (it.matchingStatus ?? "unmatched") === "unmatched",
      );
      if (items.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "เสื้อผ้าทุกชิ้นในตู้ถูกจัดคู่หรือทำเครื่องหมายว่าไม่มีคู่แล้ว ลองเพิ่มชิ้นใหม่",
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

You may propose MORE THAN ONE outfit per run. Each "look" you return must independently satisfy ALL of the iron rules below — there are NO group discounts. A look is acceptable ONLY if it would pass on its own as the single recommendation. Do not pad the array with weak looks just to reach the requested count; if only one look truly works, return only one.

VOICE FOR stylistCommentary — POWER & SOCIAL VALIDATION MODE: เขียนเหมือนบรรณาธิการแฟชั่นระดับ Vogue ที่ประกาศชัยชนะของลุคนี้ให้ผู้ใช้คนนี้โดยเฉพาะ ทุกประโยคเฉียบคม กระชับ หนักแน่น ทำให้ผู้อ่านเห็นภาพตัวเอง "ในทันทีที่ปรากฏตัว" ท่ามกลางผู้คน ทุกคำคุณศัพท์ต้องผูกเหตุผลเชิงเทคนิค (undertone / silhouette / fabric / color theory) ห้ามชมลอย ๆ ห้ามอ้างอำนาจเหนือธรรมชาติ ห้ามสัญญาผลทางดวง การพูดถึง "สายตาคนรอบตัว" คือ social validation เชิงสไตล์ ไม่ใช่คำทำนาย

=== IRON RULES (HARD CONSTRAINTS — NEVER BREAK) ===
1. UNDERTONE FIRST. Use the user's undertone (cool / neutral / warm) as the primary reference. If unknown, default to neutral and say so in skinToneNote.
2. NO HARSH CLASH NEAR THE FACE. Any garment that clashes severely with the user's undertone is FORBIDDEN as a top, dress or outerwear (anything touching the face/neck). Such a clash may only appear on bottoms, and only when the overall look still satisfies color theory.
3. SILHOUETTE BALANCE. Top and bottom must balance proportions (volume on top → clean line below, and vice versa; cropped → high rise; long line → grounded hem). Never combine two oversized volumes or two clinging silhouettes without a deliberate, justified exception.
4. FABRIC HARMONY. Fabrics must support each other. Never pair fabrics that fight without reason (e.g. chunky knit over slick satin slip; raw denim with delicate evening lace).
5. LUCKY COLOR MUST BE ACTIVELY CONSIDERED — BUT NEVER OVERRIDE RULES 1–4. If a birth-date lucky color is provided, try to weave it in (primary first, otherwise supporting) on the safest placement: bottom → outerwear → dress/top hero (only if undertone-safe). The AVOID color must never be the dominant or face-adjacent piece. Document the decision in luckyColorNote. If it cannot be reconciled, drop it and explain why.
6. REJECT FEARLESSLY. Any wardrobe item that cannot meet rules 2–4 within a look MUST go into the top-level rejectedItemIds. A short clean look beats a stuffed one.
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
- stylistCommentary: 4–5 ประโยคภาษาไทยทรงพลังสไตล์ Vogue editor's note — เปิดด้วย hook ที่ "สะกดทุกสายตา", อธิบายเหตุผลเชิงเทคนิค (undertone/silhouette/fabric/proportion), ใส่ social-validation อย่างน้อย 1 ประโยค ("ในทันทีที่ปรากฏตัว", "ในสายตาผู้อื่น"), ชู finishing touch, ปิดด้วยประโยคมั่นใจสั้นคม. ห้ามใช้คำกลาง ๆ เช่น "ค่อนข้าง", "พอประมาณ", "อาจจะ".
- Every textual field must be written in Thai (ภาษาไทย).`;

      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      > = [{ type: "text", text: userPrompt }];

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

      const savedLooks: any[] = [];
      for (const look of validLooks) {
        const selectedIds: number[] = look.selectedItemIds;
        const groupLabel =
          "G" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);

        // Mark items matched (only this user's items).
        await db
          .update(wardrobe)
          .set({
            matchingStatus: "matched",
            matchingGroup: groupLabel,
            lastMatchedAt: new Date(),
          })
          .where(and(eq(wardrobe.userId, ctx.user.id), inArray(wardrobe.id, selectedIds)));

        const inserted = await db
          .insert(outfitRecommendations)
          .values({
            userId: ctx.user.id,
            title: look.title || "Curated Look",
            occasion: look.occasion || occasion,
            itemIds: selectedIds,
            analysis: look,
            luckyColors: luckyColor ?? null,
            source: "own",
          })
          .$returningId();

        const newId = Array.isArray(inserted) ? (inserted[0] as any)?.id : undefined;
        savedLooks.push({ id: newId, matchingGroup: groupLabel, ...look });
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
});
