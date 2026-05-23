/**
 * Multi-Agent Consensus Service
 * 
 * ให้ AI 3 ตัว (Gemini, GPT-4o, Claude) ประเมินเสื้อผ้าแยกกัน
 * แล้วมา cross-validate + debate ก่อนสรุปผลลัพธ์สุดท้าย
 * 
 * Flow:
 * 1. Round 1 — Independent Evaluation: ส่งรูป+ข้อมูลไป 3 ตัวพร้อมกัน
 * 2. Round 2 — Cross-validation: เทียบผลลัพธ์ ถ้าตรงกัน → สรุปเลย
 * 3. Round 3 — Debate (ถ้าจำเป็น): ให้ AI ตัวหนึ่งตัดสินข้อขัดแย้ง
 */

import { ENV } from "../_core/env";
import { invokeLLM, type Message } from "../_core/llm";

// ─── Types ───

export interface AgentEvaluation {
  agent: "gemini" | "gpt4o" | "claude";
  category: string;
  brand: string;
  color: string;
  material: string;
  condition: string;
  conditionScore: number; // 1-10
  defects: string[];
  estimatedRetailPrice: number; // THB
  estimatedResalePrice: number; // THB
  estimatedResalePriceUSD: number; // USD for international
  confidence: number; // 0-100
  reasoning: string;
}

export interface ConsensusResult {
  finalEvaluation: {
    category: string;
    brand: string;
    color: string;
    material: string;
    condition: string;
    conditionScore: number;
    defects: string[];
    estimatedRetailPrice: number;
    estimatedResaleThaiPrice: number;
    estimatedResaleIntlPrice: number;
    estimatedResaleIntlPriceUSD: number;
  };
  confidence: number; // 0-100 overall consensus confidence
  consensusLevel: "unanimous" | "majority" | "debated";
  agentResults: AgentEvaluation[];
  debateLog?: string; // ถ้ามีการถก
  processingTime: number; // ms
}

// ─── Shared Prompt ───

const EVALUATION_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านเสื้อผ้าแฟชั่นมือสองในตลาดไทย วิเคราะห์รูปภาพเสื้อผ้าที่ให้มาและประเมินข้อมูลต่อไปนี้:

กรุณาตอบเป็น JSON เท่านั้น ตามรูปแบบนี้:
{
  "category": "ประเภทสินค้า (เลือกจาก: t_shirt, shirt, blouse, crop_top, camisole, tank_top, jeans, pants, shorts, skirt, leggings, dress, jumpsuit, romper, blazer, jacket, cardigan, sweater, hoodie, coat, bra, underwear, shapewear, sleepwear, sports_bra, yoga_pants, running_set, bikini, one_piece_swim, two_piece_swim, beachwear, bag)",
  "brand": "ชื่อแบรนด์ (ถ้าไม่รู้ใส่ 'ไม่ระบุแบรนด์')",
  "color": "สีหลัก",
  "material": "วัสดุ (cotton/polyester/denim/silk/wool/ผสม/อื่นๆ)",
  "condition": "สภาพ (ใหม่มาก/ดีมาก/ดี/พอใช้/ทรุดโทรม)",
  "conditionScore": 8,
  "defects": ["รายการตำหนิ ถ้ามี"],
  "estimatedRetailPrice": 990,
  "estimatedResalePrice": 650,
  "estimatedResalePriceUSD": 18,
  "confidence": 85,
  "reasoning": "เหตุผลสั้นๆ ที่ประเมินราคานี้"
}

หมายเหตุสำคัญ:
- estimatedRetailPrice = ราคาขายปลีกใหม่ในไทย (บาท)
- estimatedResalePrice = ราคาขายมือสองในตลาดไทย (บาท) — นี่คือราคาที่คนขายจริงๆ ในแอป/เพจมือสองไทย
- estimatedResalePriceUSD = ราคาขายมือสองในตลาดต่างประเทศ (USD) — สำหรับ eBay/Poshmark/Depop
- conditionScore: 10=ใหม่เอี่ยม, 8=ดีมาก, 6=ดี, 4=พอใช้, 2=ทรุดโทรม
- confidence: ความมั่นใจในการประเมิน 0-100%

ช่วงราคาอ้างอิงตลาดมือสองไทย (สภาพดี) พร้อม Thai Market Factor:
• Budget/ไม่มีแบรนด์ (SHEIN, Giordano, ไม่ระบุ): เสื้อยืด 50-150฿, กางเกง 80-200฿, แจ็คเก็ต 100-250฿ [ราคาไทย = 60% ของราคาสากล]
• Mid-tier/Fast Fashion+ (Uniqlo, H&M, GAP, Muji, Cotton On): เสื้อยืด 100-300฿, กางเกง 150-450฿, แจ็คเก็ต 200-600฿ [ราคาไทย = 65% ของราคาสากล]
• High Street (Zara, Mango, COS, Levi's, Calvin Klein): เสื้อยืด 150-450฿, กางเกง 250-700฿, แจ็คเก็ต 350-1000฿ [ราคาไทย = 70% ของราคาสากล]
• Sport Premium (Nike, Adidas, Lululemon, The North Face): เสื้อยืด 200-600฿, กางเกง 350-1000฿, แจ็คเก็ต 500-1800฿ [ราคาไทย = 75% ของราคาสากล]
• Streetwear/Hype (Supreme, Off-White, BAPE, Stussy): เสื้อยืด 300-1500฿, กางเกง 500-2500฿, แจ็คเก็ต 800-4000฿ [ราคาไทย = 80% ของราคาสากล]
• Premium Accessible (Coach, Kate Spade, Michael Kors, Longchamp): เสื้อยืด 500-2000฿, กางเกง 800-3000฿, กระเป๋า 1000-5000฿ [ราคาไทย = 75% ของราคาสากล]
• Luxury/Designer (Gucci, LV, Prada, Dior, Balenciaga): เสื้อยืด 2000-8000฿, กางเกง 3000-15000฿, กระเป๋า 5000-30000฿ [ราคาไทย = 80% ของราคาสากล]
• Ultra Luxury (Hermès, Chanel): เสื้อยืด 5000-20000฿, กางเกง 8000-40000฿, กระเป๋า 10000-80000฿ [ราคาไทย = 85% ของราคาสากล]
• Thai Premium (Jaspal, CPS, Greyhound, Sretsis, Asava): เสื้อยืด 150-600฿, กางเกง 250-900฿, แจ็คเก็ต 400-1500฿ [ใช้ราคาไทยโดยตรง ไม่ต้องปรับ]
• Thai Mid (Pomelo, CC Double O, Hooks, Sabina): เสื้อยืด 80-250฿, กางเกง 120-400฿, แจ็คเก็ต 200-600฿ [ใช้ราคาไทยโดยตรง ไม่ต้องปรับ]

สำคัญมาก: ราคาข้างต้นคือราคาที่คนซื้อจริงในแอปมือสองไทย (ไม่ใช่ราคาต่ำสุดหรือสูงสุด) ห้ามประเมินต่ำกว่าช่วงอ้างอิงข้างต้น

ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น`;

// ─── API Callers ───

/**
 * เรียก Gemini ผ่าน Google AI API โดยตรง (gemini-2.0-flash)
 * ใช้ GOOGLE_AI_API_KEY ที่เก็บไว้ใน ENV
 * Fallback ไปใช้ Manus Forge invokeLLM ถ้าไม่มี key หรือ API error
 */
async function callGemini(imageBase64: string, mimeType: string, additionalContext: string): Promise<AgentEvaluation | null> {
  // ถ้าไม่มี Google AI API Key → fallback ไปใช้ Manus Forge
  if (!ENV.googleAiApiKey) {
    console.warn("[Multi-Agent] Google AI API key not configured, falling back to Manus Forge");
    return callGeminiFallback(imageBase64, mimeType, additionalContext);
  }

  try {
    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ENV.googleAiApiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: EVALUATION_PROMPT + "\n\n" + (additionalContext || "วิเคราะห์เสื้อผ้าในรูปนี้"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Multi-Agent] Gemini API HTTP error:", response.status, errorText);
      // Fallback to Manus Forge on API error
      return callGeminiFallback(imageBase64, mimeType, additionalContext);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const json = extractJSON(content);
    if (!json) return null;

    return {
      agent: "gemini",
      category: json.category || "",
      brand: json.brand || "",
      color: json.color || "",
      material: json.material || "",
      condition: json.condition || "",
      conditionScore: json.conditionScore || 5,
      defects: json.defects || [],
      estimatedRetailPrice: json.estimatedRetailPrice || 0,
      estimatedResalePrice: json.estimatedResalePrice || 0,
      estimatedResalePriceUSD: json.estimatedResalePriceUSD || 0,
      confidence: json.confidence || 50,
      reasoning: json.reasoning || "",
    };
  } catch (error) {
    console.error("[Multi-Agent] Gemini error:", error);
    // Fallback to Manus Forge
    return callGeminiFallback(imageBase64, mimeType, additionalContext);
  }
}

/**
 * Fallback: เรียก Gemini ผ่าน Manus Forge invokeLLM
 */
async function callGeminiFallback(imageBase64: string, mimeType: string, additionalContext: string): Promise<AgentEvaluation | null> {
  try {
    const messages: Message[] = [
      { role: "system", content: EVALUATION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: additionalContext || "วิเคราะห์เสื้อผ้าในรูปนี้",
          },
        ],
      },
    ];
    const response = await invokeLLM({ messages });

    const rawContent = response.choices?.[0]?.message?.content || "";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const json = extractJSON(content);
    if (!json) return null;

    return {
      agent: "gemini",
      category: json.category || "",
      brand: json.brand || "",
      color: json.color || "",
      material: json.material || "",
      condition: json.condition || "",
      conditionScore: json.conditionScore || 5,
      defects: json.defects || [],
      estimatedRetailPrice: json.estimatedRetailPrice || 0,
      estimatedResalePrice: json.estimatedResalePrice || 0,
      estimatedResalePriceUSD: json.estimatedResalePriceUSD || 0,
      confidence: json.confidence || 50,
      reasoning: json.reasoning || "",
    };
  } catch (error) {
    console.error("[Multi-Agent] Gemini fallback error:", error);
    return null;
  }
}

/**
 * เรียก GPT-4o ผ่าน OpenAI API
 */
async function callGPT4o(imageBase64: string, mimeType: string, additionalContext: string): Promise<AgentEvaluation | null> {
  if (!ENV.openaiApiKey && !ENV.forgeApiKey) {
    console.warn("[Multi-Agent] OpenAI-compatible LLM key not configured");
    return null;
  }

  try {
    const messages: Message[] = [
      { role: "system", content: EVALUATION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: additionalContext || "วิเคราะห์เสื้อผ้าในรูปนี้",
          },
        ],
      },
    ];
    const response = await invokeLLM({ messages });
    const rawContent = response.choices?.[0]?.message?.content || "";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const json = extractJSON(content);
    if (!json) return null;

    return {
      agent: "gpt4o",
      category: json.category || "",
      brand: json.brand || "",
      color: json.color || "",
      material: json.material || "",
      condition: json.condition || "",
      conditionScore: json.conditionScore || 5,
      defects: json.defects || [],
      estimatedRetailPrice: json.estimatedRetailPrice || 0,
      estimatedResalePrice: json.estimatedResalePrice || 0,
      estimatedResalePriceUSD: json.estimatedResalePriceUSD || 0,
      confidence: json.confidence || 50,
      reasoning: json.reasoning || "",
    };
  } catch (error) {
    console.error("[Multi-Agent] GPT/OpenAI-compatible error:", error);
    return null;
  }
}

/**
 * เรียก Claude ผ่าน Anthropic API
 */
async function callClaude(imageBase64: string, mimeType: string, additionalContext: string): Promise<AgentEvaluation | null> {
  if (!ENV.anthropicApiKey) {
    console.warn("[Multi-Agent] Anthropic API key not configured");
    return null;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: EVALUATION_PROMPT + "\n\n" + (additionalContext || "วิเคราะห์เสื้อผ้าในรูปนี้"),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[Multi-Agent] Claude HTTP error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";
    const json = extractJSON(content);
    if (!json) return null;

    return {
      agent: "claude",
      category: json.category || "",
      brand: json.brand || "",
      color: json.color || "",
      material: json.material || "",
      condition: json.condition || "",
      conditionScore: json.conditionScore || 5,
      defects: json.defects || [],
      estimatedRetailPrice: json.estimatedRetailPrice || 0,
      estimatedResalePrice: json.estimatedResalePrice || 0,
      estimatedResalePriceUSD: json.estimatedResalePriceUSD || 0,
      confidence: json.confidence || 50,
      reasoning: json.reasoning || "",
    };
  } catch (error) {
    console.error("[Multi-Agent] Claude error:", error);
    return null;
  }
}

// ─── Consensus Logic ───

/**
 * ตรวจสอบว่าผลลัพธ์ตรงกันหรือไม่
 * ถ้าราคา resale ต่างกันไม่เกิน 30% ถือว่า agree
 */
function checkPriceAgreement(evaluations: AgentEvaluation[]): boolean {
  if (evaluations.length < 2) return true;

  const prices = evaluations.map(e => e.estimatedResalePrice);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // ทุกตัวต้องอยู่ภายใน ±30% ของค่าเฉลี่ย
  return prices.every(p => Math.abs(p - avg) / avg <= 0.30);
}

/**
 * Debate round: ส่งผลลัพธ์ที่ขัดแย้งให้ AI ตัดสิน
 */
async function runDebate(evaluations: AgentEvaluation[]): Promise<{ finalPrice: number; finalPriceUSD: number; reasoning: string }> {
  const debatePrompt = `คุณเป็นผู้ตัดสินในการประเมินราคาเสื้อผ้ามือสอง AI 3 ตัวให้ผลลัพธ์ต่างกัน:

${evaluations.map(e => `${e.agent}: ราคาไทย ${e.estimatedResalePrice} บาท, ราคาต่างประเทศ $${e.estimatedResalePriceUSD} — เหตุผล: ${e.reasoning}`).join("\n")}

กรุณาวิเคราะห์เหตุผลของแต่ละตัว แล้วสรุปราคาที่เหมาะสมที่สุด ตอบเป็น JSON:
{
  "finalResalePrice": 120,
  "finalResalePriceUSD": 4,
  "reasoning": "เหตุผลที่เลือกราคานี้"
}

หมายเหตุ: ตลาดมือสองไทยราคาต่ำมาก เสื้อ fast fashion ขาย 60-200 บาท, mid-range 150-500 บาท
ตอบ JSON เท่านั้น`;

  try {
    const messages: Message[] = [
      { role: "user", content: debatePrompt },
    ];
    const response = await invokeLLM({ messages });

    const rawContent = response.choices?.[0]?.message?.content || "";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const json = extractJSON(content);
    
    if (json) {
      return {
        finalPrice: json.finalResalePrice || 0,
        finalPriceUSD: json.finalResalePriceUSD || 0,
        reasoning: json.reasoning || "",
      };
    }
  } catch (error) {
    console.error("[Multi-Agent] Debate error:", error);
  }

  // Fallback: ใช้ median
  const prices = evaluations.map(e => e.estimatedResalePrice).sort((a, b) => a - b);
  const pricesUSD = evaluations.map(e => e.estimatedResalePriceUSD).sort((a, b) => a - b);
  return {
    finalPrice: prices[Math.floor(prices.length / 2)],
    finalPriceUSD: pricesUSD[Math.floor(pricesUSD.length / 2)],
    reasoning: "ใช้ค่ามัธยฐานจาก AI ทั้ง 3 ตัว",
  };
}

// ─── Main Function ───

/**
 * Multi-Agent Consensus Evaluation
 * ส่งรูปไป AI 3 ตัวพร้อมกัน → cross-validate → debate (ถ้าจำเป็น) → สรุปผล
 */
export async function evaluateWithConsensus(
  imageBase64: string,
  mimeType: string,
  additionalContext?: string,
): Promise<ConsensusResult> {
  const startTime = Date.now();
  const context = additionalContext || "วิเคราะห์เสื้อผ้าในรูปนี้ ประเมินราคาขายมือสองในตลาดไทย";

  // Round 1: Independent Evaluation (parallel)
  const [geminiResult, gpt4oResult, claudeResult] = await Promise.all([
    callGemini(imageBase64, mimeType, context),
    callGPT4o(imageBase64, mimeType, context),
    callClaude(imageBase64, mimeType, context),
  ]);

  const validResults = [geminiResult, gpt4oResult, claudeResult].filter(
    (r): r is AgentEvaluation => r !== null
  );

  // ถ้าไม่มี AI ตัวไหนตอบกลับเลย
  if (validResults.length === 0) {
    return {
      finalEvaluation: {
        category: "",
        brand: "",
        color: "",
        material: "",
        condition: "",
        conditionScore: 0,
        defects: [],
        estimatedRetailPrice: 0,
        estimatedResaleThaiPrice: 0,
        estimatedResaleIntlPrice: 0,
        estimatedResaleIntlPriceUSD: 0,
      },
      confidence: 0,
      consensusLevel: "debated",
      agentResults: [],
      processingTime: Date.now() - startTime,
    };
  }

  // ถ้ามีแค่ตัวเดียวตอบ → ใช้ผลนั้นเลย
  if (validResults.length === 1) {
    const r = validResults[0];
    return {
      finalEvaluation: {
        category: r.category,
        brand: r.brand,
        color: r.color,
        material: r.material,
        condition: r.condition,
        conditionScore: r.conditionScore,
        defects: r.defects,
        estimatedRetailPrice: r.estimatedRetailPrice,
        estimatedResaleThaiPrice: r.estimatedResalePrice,
        estimatedResaleIntlPrice: r.estimatedResalePriceUSD * 35.5,
        estimatedResaleIntlPriceUSD: r.estimatedResalePriceUSD,
      },
      confidence: Math.min(r.confidence, 60), // ลด confidence เพราะมีแค่ตัวเดียว
      consensusLevel: "debated",
      agentResults: validResults,
      processingTime: Date.now() - startTime,
    };
  }

  // Round 2: Cross-validation
  const isAgreed = checkPriceAgreement(validResults);

  let finalPrice: number;
  let finalPriceUSD: number;
  let consensusLevel: "unanimous" | "majority" | "debated";
  let debateLog: string | undefined;

  if (isAgreed) {
    // ทุกตัวเห็นตรงกัน → ใช้ค่าเฉลี่ยถ่วงน้ำหนักตาม confidence
    const totalConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0);
    finalPrice = Math.round(
      validResults.reduce((sum, r) => sum + r.estimatedResalePrice * r.confidence, 0) / totalConfidence
    );
    finalPriceUSD = Math.round(
      validResults.reduce((sum, r) => sum + r.estimatedResalePriceUSD * r.confidence, 0) / totalConfidence * 100
    ) / 100;
    consensusLevel = "unanimous";
  } else {
    // Round 3: Debate
    const debateResult = await runDebate(validResults);
    finalPrice = debateResult.finalPrice;
    finalPriceUSD = debateResult.finalPriceUSD;
    debateLog = debateResult.reasoning;

    // ถ้า 2 ใน 3 ใกล้เคียงกัน → majority, ไม่งั้น → debated
    const pricesSorted = validResults.map(r => r.estimatedResalePrice).sort((a, b) => a - b);
    if (pricesSorted.length >= 2) {
      const diff = (pricesSorted[1] - pricesSorted[0]) / pricesSorted[0];
      consensusLevel = diff <= 0.25 ? "majority" : "debated";
    } else {
      consensusLevel = "debated";
    }
  }

  // สรุปผลลัพธ์สุดท้าย — ใช้ majority vote สำหรับ categorical fields
  const finalEvaluation = {
    category: getMajorityVote(validResults.map(r => r.category)),
    brand: getMajorityVote(validResults.map(r => r.brand)),
    color: getMajorityVote(validResults.map(r => r.color)),
    material: getMajorityVote(validResults.map(r => r.material)),
    condition: getMajorityVote(validResults.map(r => r.condition)),
    conditionScore: Math.round(validResults.reduce((sum, r) => sum + r.conditionScore, 0) / validResults.length),
    defects: mergeDefects(validResults.map(r => r.defects)),
    estimatedRetailPrice: Math.round(
      validResults.reduce((sum, r) => sum + r.estimatedRetailPrice, 0) / validResults.length
    ),
    estimatedResaleThaiPrice: finalPrice,
    estimatedResaleIntlPrice: Math.round(finalPriceUSD * 35.5),
    estimatedResaleIntlPriceUSD: finalPriceUSD,
  };

  // คำนวณ overall confidence
  const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;
  const consensusBonus = consensusLevel === "unanimous" ? 15 : consensusLevel === "majority" ? 5 : -10;
  const overallConfidence = Math.min(100, Math.max(0, Math.round(avgConfidence + consensusBonus)));

  return {
    finalEvaluation,
    confidence: overallConfidence,
    consensusLevel,
    agentResults: validResults,
    debateLog,
    processingTime: Date.now() - startTime,
  };
}

// ─── Helpers ───

function extractJSON(text: string): any {
  try {
    // ลอง parse ตรงๆ ก่อน
    return JSON.parse(text);
  } catch {
    // หา JSON block ใน text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getMajorityVote(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const normalized = v.toLowerCase().trim();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  
  let maxCount = 0;
  let winner = values[0] || "";
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      // Return original casing from first match
      winner = values.find(v => v.toLowerCase().trim() === value) || value;
    }
  });
  return winner;
}

function mergeDefects(defectLists: string[][]): string[] {
  const unique = new Set<string>();
  for (const list of defectLists) {
    for (const defect of list) {
      if (defect && defect.trim()) {
        unique.add(defect.trim());
      }
    }
  }
  return Array.from(unique);
}
