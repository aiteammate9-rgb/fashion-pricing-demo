/**
 * SSE Streaming Evaluation Endpoint
 * 
 * 2-Phase Pipeline:
 * Phase 1 (2-3s): Vision AI + Rule-based pricing → instant results
 * Phase 2 (8-12s background): Multi-Agent Consensus → refined price update
 * 
 * Client receives events:
 * - "phase1" → Vision detection + rule-based price (instant)
 * - "phase2" → Multi-Agent consensus refined price (background)
 * - "error" → Error message
 * - "done" → Stream complete
 */

import { Router, Request, Response } from "express";
import { invokeLLM } from "../_core/llm";
import { getMarketPrice } from "../services/retailed";
import { evaluateWithConsensus } from "../services/multi-agent";
import { getThaiMarketFactor, getThaiVsInternationalBreakdown, getThaiMarketTier } from "@shared/thai-market-factor";

// Map the 10 Thai market tiers (from the 145+ brand list) → the 5 base-price
// columns. This makes the full brand map the single source of truth for tiering
// so brands not in the small BRAND_TIER_MAP below no longer default to "low".
const THAI_TIER_TO_BASE: Record<string, "budget" | "low" | "mid" | "high" | "premium"> = {
  ultra_luxury: "premium",
  luxury: "premium",
  premium_accessible: "premium",
  streetwear_hype: "high",
  sport_premium: "high",
  high_street: "high",
  thai_premium: "high",
  thai_mid: "mid",
  mid_tier: "mid",
  budget: "budget",
};

const router = Router();

// ─── Types ───

interface EvaluateRequest {
  images: Array<{
    base64: string;
    mimeType: string;
    label: string;
  }>;
  itemIndex?: number;
}

interface Phase1Result {
  phase: "phase1";
  itemIndex: number;
  detection: {
    category: string;
    brand: string;
    primaryColor: string;
    secondaryColor: string;
    condition: string;
    defects: string[];
    defectLevel: string;
    material: string;
    style: string;
    pattern: string;
    confidence: number;
  };
  ruleBasedPrice: {
    recommendedPrice: number;
    fastSalePrice: number;
    highValuePrice: number;
    marketMin: number;
    marketMax: number;
    sellabilityScore: number;
    thaiMarketInfo?: {
      internationalPrice: number;
      thaiPrice: number;
      thaiMarketTier: string;
      thaiMarketLabel: string;
      discountPercent: number;
      explanation: string;
    };
  };
  marketData?: {
    found: boolean;
    bestEstimate: number | null;
    sources: any[];
  };
}

interface Phase2Result {
  phase: "phase2";
  itemIndex: number;
  consensus: {
    confidence: number;
    consensusLevel: string;
    estimatedResaleThaiPrice: number;
    estimatedResaleIntlPriceUSD: number;
    agentCount: number;
    debateLog?: string;
    agentResults?: any[];
  };
  refinedPrice: {
    recommendedPrice: number;
    fastSalePrice: number;
    highValuePrice: number;
    marketMin: number;
    marketMax: number;
  };
}

// ─── Vision AI Detection (Phase 1) ───

async function runVisionDetection(images: EvaluateRequest["images"]) {
  const imageContents = images.map((img) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
      detail: "high" as const,
    },
  }));

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `คุณเป็น AI ผู้เชี่ยวชาญด้านแฟชั่นและเสื้อผ้ามือสอง หน้าที่ของคุณคือวิเคราะห์รูปภาพเสื้อผ้าที่ผู้ใช้ส่งมา แล้วตอบกลับเป็น JSON ตามโครงสร้างที่กำหนด

กรุณาวิเคราะห์:
1. ประเภทสินค้า - เลือกจากรายการนี้เท่านั้น:
   - ท่อนบน: t_shirt, shirt, blouse, crop_top, camisole, tank_top
   - ท่อนล่าง: jeans, pants, shorts, skirt, leggings
   - ชุดชิ้นเดียว: dress, jumpsuit, romper
   - เสื้อคลุม: blazer, jacket, cardigan, sweater, hoodie, coat
   - ชุดชั้นใน/ชุดนอน: bra, underwear, shapewear, sleepwear
   - ชุดกีฬา: sports_bra, yoga_pants, running_set
   - ชุดว่ายน้ำ: bikini, one_piece_swim, two_piece_swim, beachwear
   - อื่นๆ: bag
2. แบรนด์ (ถ้าเห็นโลโก้หรือป้ายแบรนด์ ให้ระบุ ถ้าไม่แน่ใจให้ตอบ "ไม่ระบุ")
3. สีหลักและสีรอง
4. ตำหนิที่เห็น (รอยเปื้อน, รอยขาด, สีซีด, กระดุมหลุด ฯลฯ)
5. สภาพโดยรวม (new_with_tag, like_new, excellent, good, fair, poor, defective)
6. รายละเอียดเพิ่มเติม (ลวดลาย, วัสดุ, สไตล์)

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON`,
      },
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `วิเคราะห์รูปเสื้อผ้าต่อไปนี้ (${images.length} รูป: ${images.map((i) => i.label).join(", ")})`,
          },
          ...imageContents,
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "clothing_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            category: { type: "string", description: "ประเภทสินค้า" },
            brand: { type: "string", description: "ชื่อแบรนด์" },
            primaryColor: { type: "string", description: "สีหลัก" },
            secondaryColor: { type: "string", description: "สีรอง" },
            condition: { type: "string", description: "สภาพ: new_with_tag, like_new, excellent, good, fair, poor, defective" },
            defects: { type: "array", items: { type: "string" }, description: "รายการตำหนิ" },
            defectLevel: { type: "string", description: "ระดับตำหนิ: none, minor, moderate, major" },
            material: { type: "string", description: "วัสดุ" },
            style: { type: "string", description: "สไตล์" },
            pattern: { type: "string", description: "ลวดลาย" },
            confidence: { type: "number", description: "ความมั่นใจ 0-100" },
          },
          required: ["category", "brand", "primaryColor", "secondaryColor", "condition", "defects", "defectLevel", "material", "style", "pattern", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI ไม่สามารถวิเคราะห์รูปภาพได้");
  }

  return JSON.parse(content);
}

// ─── Rule-based Pricing (instant, no API call) ───

// Simplified version of the frontend pricing engine for server-side Phase 1
const CATEGORY_BASE_PRICE: Record<string, { low: number; mid: number; high: number; premium: number }> = {
  t_shirt: { low: 120, mid: 250, high: 450, premium: 900 },
  shirt: { low: 150, mid: 350, high: 600, premium: 1200 },
  blouse: { low: 150, mid: 350, high: 600, premium: 1200 },
  crop_top: { low: 100, mid: 220, high: 400, premium: 800 },
  camisole: { low: 80, mid: 180, high: 350, premium: 700 },
  tank_top: { low: 80, mid: 180, high: 350, premium: 700 },
  jeans: { low: 200, mid: 450, high: 850, premium: 1800 },
  pants: { low: 180, mid: 400, high: 750, premium: 1500 },
  shorts: { low: 120, mid: 280, high: 500, premium: 1000 },
  skirt: { low: 180, mid: 380, high: 700, premium: 1400 },
  leggings: { low: 100, mid: 250, high: 500, premium: 1000 },
  dress: { low: 250, mid: 500, high: 900, premium: 1800 },
  jumpsuit: { low: 250, mid: 500, high: 900, premium: 1800 },
  romper: { low: 200, mid: 400, high: 750, premium: 1500 },
  blazer: { low: 350, mid: 700, high: 1200, premium: 2500 },
  jacket: { low: 350, mid: 700, high: 1200, premium: 2500 },
  cardigan: { low: 200, mid: 400, high: 700, premium: 1400 },
  sweater: { low: 200, mid: 400, high: 700, premium: 1400 },
  hoodie: { low: 200, mid: 400, high: 750, premium: 1500 },
  coat: { low: 500, mid: 900, high: 1500, premium: 3500 },
  bra: { low: 80, mid: 180, high: 350, premium: 800 },
  underwear: { low: 50, mid: 120, high: 250, premium: 500 },
  shapewear: { low: 150, mid: 350, high: 600, premium: 1200 },
  sleepwear: { low: 120, mid: 280, high: 500, premium: 1000 },
  sports_bra: { low: 100, mid: 250, high: 500, premium: 1000 },
  yoga_pants: { low: 150, mid: 350, high: 700, premium: 1400 },
  running_set: { low: 150, mid: 350, high: 650, premium: 1300 },
  bikini: { low: 150, mid: 350, high: 600, premium: 1200 },
  one_piece_swim: { low: 180, mid: 400, high: 700, premium: 1400 },
  two_piece_swim: { low: 150, mid: 350, high: 600, premium: 1200 },
  beachwear: { low: 120, mid: 280, high: 500, premium: 1000 },
  bag: { low: 200, mid: 500, high: 1200, premium: 3000 },
};

const BRAND_TIER_MAP: Record<string, string> = {
  // Budget
  shein: "budget", "no brand": "budget", "ไม่ระบุ": "budget", unknown: "budget",
  // Fast fashion
  h_and_m: "low", hm: "low", cotton_on: "low", forever21: "low",
  // Mid
  uniqlo: "mid", muji: "mid", gap: "mid", old_navy: "mid",
  // High street
  zara: "high", mango: "high", pomelo: "high", cos: "high", "& other stories": "high",
  // Premium
  nike: "premium", adidas: "premium", levis: "premium", "levi's": "premium",
  calvin_klein: "premium", tommy_hilfiger: "premium", polo_ralph_lauren: "premium",
  // Thai brands
  jaspal: "high", cps_chaps: "high", greyhound: "high", sretsis: "premium",
  vatanika: "premium", asava: "premium", disaya: "premium",
  // K-fashion
  ader_error: "premium", gentle_monster: "premium", mardi_mercredi: "high",
  // Sports
  lululemon: "premium", hoka: "premium", on_running: "high",
  // Luxury (use premium tier for base, multiplied further)
  gucci: "premium", prada: "premium", chanel: "premium", louis_vuitton: "premium",
  hermes: "premium", balenciaga: "premium", dior: "premium",
};

// Condition multipliers — synced to pricing-system.md v2.0 (stricter, 7 levels).
const CONDITION_MULTIPLIER: Record<string, number> = {
  new_with_tag: 1.0,
  like_new: 0.88,
  excellent: 0.73,
  good: 0.58,
  fair: 0.38,
  poor: 0.18,
  defective: 0.15,
};

const DEFECT_MULTIPLIER: Record<string, number> = {
  none: 1.0,
  minor: 0.88,
  moderate: 0.75,
  medium: 0.75,
  major: 0.55,
};

const LUXURY_BRANDS = new Set([
  "gucci", "prada", "chanel", "louis_vuitton", "hermes", "balenciaga", "dior",
  "saint_laurent", "bottega_veneta", "celine", "fendi", "valentino", "givenchy",
  "burberry", "versace", "alexander_mcqueen", "loewe", "miu_miu",
]);

function calculateRuleBasedPrice(detection: any) {
  const category = detection.category?.toLowerCase() || "t_shirt";
  const brand = detection.brand?.toLowerCase().replace(/\s+/g, "_") || "no brand";
  const brandOriginal = detection.brand || "no brand"; // keep original for Thai factor lookup
  const condition = detection.condition?.toLowerCase() || "good";
  const defectLevel = detection.defectLevel?.toLowerCase() || "none";

  const basePrice = CATEGORY_BASE_PRICE[category] || CATEGORY_BASE_PRICE.t_shirt;
  // Resolve the base-price tier from the COMPLETE 145+ brand map (via Thai tier),
  // using the small BRAND_TIER_MAP only as a fallback hint for unlisted brands.
  const thaiTier = getThaiMarketTier(brandOriginal, BRAND_TIER_MAP[brand]);
  const tier = THAI_TIER_TO_BASE[thaiTier] || BRAND_TIER_MAP[brand] || "low";

  let base: number;
  if (tier === "budget") base = basePrice.low * 0.7;
  else if (tier === "low") base = basePrice.low;
  else if (tier === "mid") base = basePrice.mid;
  else if (tier === "high") base = basePrice.high;
  else base = basePrice.premium;

  // Luxury multiplier
  if (LUXURY_BRANDS.has(brand)) {
    base = base * 2.5;
  }

  const condMult = CONDITION_MULTIPLIER[condition] || 0.58;
  const defMult = DEFECT_MULTIPLIER[defectLevel] || 1.0;

  // Calculate international price (before Thai adjustment)
  const internationalRecommended = Math.round(base * condMult * defMult);

  // Apply Thai Market Factor
  const thaiMarketFactor = getThaiMarketFactor(brandOriginal, tier);
  const recommended = Math.round(internationalRecommended * thaiMarketFactor.thaiVsInternational);
  
  const fastSale = Math.round(recommended * 0.75);
  const highValue = Math.round(recommended * 1.35);
  const marketMin = Math.round(recommended * 0.7);
  const marketMax = Math.round(recommended * 1.5);

  // Sellability score
  let sellability = 65;
  if (condition === "new_with_tag" || condition === "like_new") sellability += 15;
  else if (condition === "excellent") sellability += 10;
  else if (condition === "poor" || condition === "defective") sellability -= 10;
  if (tier === "premium" || tier === "high") sellability += 10;
  if (defectLevel === "none") sellability += 5;
  if (defectLevel === "major") sellability -= 20;
  sellability = Math.max(20, Math.min(95, sellability));

  // Thai vs International breakdown
  const thaiVsIntl = getThaiVsInternationalBreakdown(internationalRecommended, brandOriginal, tier);

  return {
    recommendedPrice: recommended,
    fastSalePrice: fastSale,
    highValuePrice: highValue,
    marketMin,
    marketMax,
    sellabilityScore: sellability,
    // New: Thai Market Factor info
    thaiMarketInfo: {
      internationalPrice: internationalRecommended,
      thaiPrice: recommended,
      thaiMarketTier: thaiVsIntl.thaiMarketTier,
      thaiMarketLabel: thaiVsIntl.thaiMarketLabel,
      discountPercent: thaiVsIntl.discountPercent,
      explanation: thaiVsIntl.explanation,
    },
  };
}

// ─── Blend Phase 2 into Phase 1 ───

function blendPrices(phase1Price: number, consensusPrice: number, confidence: number) {
  // Weight: higher confidence → more weight to consensus
  const consensusWeight = Math.min(0.7, confidence / 100);
  const ruleWeight = 1 - consensusWeight;
  
  const blended = Math.round(phase1Price * ruleWeight + consensusPrice * consensusWeight);
  return {
    recommendedPrice: blended,
    fastSalePrice: Math.round(blended * 0.75),
    highValuePrice: Math.round(blended * 1.35),
    marketMin: Math.round(blended * 0.7),
    marketMax: Math.round(blended * 1.5),
  };
}

// ─── SSE Endpoint ───

router.post("/api/evaluate-stream", async (req: Request, res: Response) => {
  const { images, itemIndex = 0 } = req.body as EvaluateRequest;

  if (!images || images.length === 0) {
    res.status(400).json({ error: "No images provided" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ═══════════════════════════════════════════════
    // PHASE 1: Vision AI + Rule-based (2-3 seconds)
    // ═══════════════════════════════════════════════
    
    const detection = await runVisionDetection(images);
    const ruleBasedPrice = calculateRuleBasedPrice(detection);

    // Send Phase 1 result immediately
    const phase1Data: Phase1Result = {
      phase: "phase1",
      itemIndex,
      detection,
      ruleBasedPrice,
    };

    sendEvent("phase1", phase1Data);

    // ═══════════════════════════════════════════════
    // PHASE 2: Multi-Agent Consensus (background, 8-12s)
    // Market data fetch runs in parallel with consensus
    // ═══════════════════════════════════════════════

    const primaryImage = images[0];
    const additionalContext = `ข้อมูลเพิ่มเติม: ประเภท=${detection.category}, แบรนด์=${detection.brand}, สภาพ=${detection.condition}`;

    // Run market data + consensus in parallel
    const [marketResult, consensusResult] = await Promise.allSettled([
      getMarketPrice(detection.brand, detection.category),
      evaluateWithConsensus(primaryImage.base64, primaryImage.mimeType, additionalContext),
    ]);

    // Process market data
    let marketData: any = null;
    if (marketResult.status === "fulfilled" && marketResult.value?.found) {
      marketData = marketResult.value;
      // Update phase1 with market data
      sendEvent("market", { itemIndex, marketData });
    }

    // Process consensus
    if (consensusResult.status === "fulfilled") {
      const consensus = consensusResult.value;
      const ce = consensus.finalEvaluation;

      if (ce.estimatedResaleThaiPrice > 0) {
        const refined = blendPrices(
          ruleBasedPrice.recommendedPrice,
          ce.estimatedResaleThaiPrice,
          consensus.confidence
        );

        const phase2Data: Phase2Result = {
          phase: "phase2",
          itemIndex,
          consensus: {
            confidence: consensus.confidence,
            consensusLevel: consensus.consensusLevel,
            estimatedResaleThaiPrice: ce.estimatedResaleThaiPrice,
            estimatedResaleIntlPriceUSD: ce.estimatedResaleIntlPriceUSD,
            agentCount: consensus.agentResults?.length || 0,
            debateLog: consensus.debateLog,
            agentResults: consensus.agentResults?.map((ar) => ({
              agent: ar.agent,
              category: ar.category,
              brand: ar.brand,
              condition: ar.condition,
              estimatedResalePrice: ar.estimatedResalePrice,
              estimatedResalePriceUSD: ar.estimatedResalePriceUSD,
              confidence: ar.confidence,
              reasoning: ar.reasoning,
            })),
          },
          refinedPrice: refined,
        };

        sendEvent("phase2", phase2Data);
      }
    }

    // Done
    sendEvent("done", { itemIndex });
  } catch (error: any) {
    console.error("[Evaluate Stream Error]", error);
    sendEvent("error", { itemIndex, message: error.message || "Unknown error" });
  } finally {
    res.end();
  }
});

// ─── Batch endpoint for multiple items ───

router.post("/api/evaluate-stream-batch", async (req: Request, res: Response) => {
  const { items } = req.body as { items: EvaluateRequest[] };

  if (!items || items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("start", { totalItems: items.length });

  // Process all items: Phase 1 for all first (fast), then Phase 2 for all (background)
  const phase1Results: Array<{ detection: any; ruleBasedPrice: any; images: any[] }> = [];

  // ─── Phase 1 for all items (parallel Vision calls) ───
  const phase1Promises = items.map(async (item, index) => {
    try {
      const detection = await runVisionDetection(item.images);
      const ruleBasedPrice = calculateRuleBasedPrice(detection);

      const phase1Data: Phase1Result = {
        phase: "phase1",
        itemIndex: index,
        detection,
        ruleBasedPrice,
      };

      sendEvent("phase1", phase1Data);
      return { detection, ruleBasedPrice, images: item.images };
    } catch (error: any) {
      sendEvent("error", { itemIndex: index, message: error.message || "Vision failed" });
      return null;
    }
  });

  const results = await Promise.all(phase1Promises);

  // Notify that all Phase 1 is complete
  sendEvent("phase1_complete", { itemCount: results.filter(Boolean).length });

  // ─── Phase 2 for all items (parallel consensus) ───
  const phase2Promises = results.map(async (result, index) => {
    if (!result) return;

    try {
      const { detection, ruleBasedPrice, images } = result;
      const primaryImage = images[0];
      const additionalContext = `ข้อมูลเพิ่มเติม: ประเภท=${detection.category}, แบรนด์=${detection.brand}, สภาพ=${detection.condition}`;

      const [marketResult, consensusResult] = await Promise.allSettled([
        getMarketPrice(detection.brand, detection.category),
        evaluateWithConsensus(primaryImage.base64, primaryImage.mimeType, additionalContext),
      ]);

      // Market data
      if (marketResult.status === "fulfilled" && marketResult.value?.found) {
        sendEvent("market", { itemIndex: index, marketData: marketResult.value });
      }

      // Consensus
      if (consensusResult.status === "fulfilled") {
        const consensus = consensusResult.value;
        const ce = consensus.finalEvaluation;

        if (ce.estimatedResaleThaiPrice > 0) {
          const refined = blendPrices(
            ruleBasedPrice.recommendedPrice,
            ce.estimatedResaleThaiPrice,
            consensus.confidence
          );

          const phase2Data: Phase2Result = {
            phase: "phase2",
            itemIndex: index,
            consensus: {
              confidence: consensus.confidence,
              consensusLevel: consensus.consensusLevel,
              estimatedResaleThaiPrice: ce.estimatedResaleThaiPrice,
              estimatedResaleIntlPriceUSD: ce.estimatedResaleIntlPriceUSD,
              agentCount: consensus.agentResults?.length || 0,
              debateLog: consensus.debateLog,
              agentResults: consensus.agentResults?.map((ar) => ({
                agent: ar.agent,
                category: ar.category,
                brand: ar.brand,
                condition: ar.condition,
                estimatedResalePrice: ar.estimatedResalePrice,
                estimatedResalePriceUSD: ar.estimatedResalePriceUSD,
                confidence: ar.confidence,
                reasoning: ar.reasoning,
              })),
            },
            refinedPrice: refined,
          };

          sendEvent("phase2", phase2Data);
        }
      }
    } catch (error: any) {
      sendEvent("error", { itemIndex: index, message: `Phase 2 failed: ${error.message}` });
    }
  });

  await Promise.all(phase2Promises);

  sendEvent("done", { totalItems: items.length });
  res.end();
});

export function registerEvaluateStream(app: any) {
  app.use(router);
}
