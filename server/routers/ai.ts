import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { storagePut, storageGetSignedUrl } from "../storage";
import { TRPCError } from "@trpc/server";
import { getMarketPrice } from "../services/retailed";
import { evaluateWithConsensus } from "../services/multi-agent";

/**
 * AI Router
 * - analyzeImage: รับ base64 images แล้วใช้ Vision AI ตรวจจับ brand, color, defects
 * - generateCaption: รับข้อมูลสินค้า + ผลประเมินราคา แล้ว generate ข้อความขายแบบฮุกโดนใจ
 */

export const aiRouter = router({
  /**
   * วิเคราะห์รูปภาพเสื้อผ้าด้วย Vision AI
   * รับ base64 images (max 3) แล้วตรวจจับ:
   * - ประเภทสินค้า (category)
   * - แบรนด์ (brand)
   * - สี (colors)
   * - ตำหนิ (defects)
   * - สภาพโดยรวม (condition)
   * - รายละเอียดเพิ่มเติม (details)
   */
  analyzeImage: publicProcedure
    .input(
      z.object({
        images: z.array(
          z.object({
            base64: z.string(),
            mimeType: z.string().default("image/jpeg"),
            label: z.string(), // "front", "back", "defect"
          })
        ).min(1).max(3),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Build image content parts for Vision
        const imageContents = input.images.map((img) => ({
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
5. สภาพโดยรวม (new_with_tag, like_new, good, fair, poor)
6. รายละเอียดเพิ่มเติม (ลวดลาย, วัสดุ, สไตล์)

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text" as const,
                  text: `วิเคราะห์รูปเสื้อผ้าต่อไปนี้ (${input.images.length} รูป: ${input.images.map((i) => i.label).join(", ")})`,
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
                  category: {
                    type: "string",
                    description: "ประเภทสินค้า: t_shirt, shirt, blouse, crop_top, camisole, tank_top, jeans, pants, shorts, skirt, leggings, dress, jumpsuit, romper, blazer, jacket, cardigan, sweater, hoodie, coat, bra, underwear, shapewear, sleepwear, sports_bra, yoga_pants, running_set, bikini, one_piece_swim, two_piece_swim, beachwear, bag",
                  },
                  brand: {
                    type: "string",
                    description: "ชื่อแบรนด์ที่ตรวจพบ หรือ 'ไม่ระบุ' ถ้าไม่เห็น",
                  },
                  primaryColor: {
                    type: "string",
                    description: "สีหลักของเสื้อผ้า เป็นภาษาไทย",
                  },
                  secondaryColor: {
                    type: "string",
                    description: "สีรอง (ถ้ามี) หรือ empty string",
                  },
                  condition: {
                    type: "string",
                    description: "สภาพ: new_with_tag, like_new, good, fair, poor",
                  },
                  defects: {
                    type: "array",
                    items: { type: "string" },
                    description: "รายการตำหนิที่พบ เช่น ['รอยเปื้อนเล็กน้อยที่ชายเสื้อ', 'สีซีดเล็กน้อย']",
                  },
                  defectLevel: {
                    type: "string",
                    description: "ระดับตำหนิ: none, minor, moderate, major",
                  },
                  material: {
                    type: "string",
                    description: "วัสดุที่คาดว่าเป็น เช่น ผ้าฝ้าย, โพลีเอสเตอร์, ยีนส์",
                  },
                  style: {
                    type: "string",
                    description: "สไตล์ เช่น casual, formal, streetwear, vintage, sporty",
                  },
                  pattern: {
                    type: "string",
                    description: "ลวดลาย เช่น สีพื้น, ลายทาง, ลายดอก, ลายสก็อต, กราฟิก",
                  },
                  confidence: {
                    type: "number",
                    description: "ความมั่นใจในการวิเคราะห์ 0-100",
                  },
                },
                required: [
                  "category",
                  "brand",
                  "primaryColor",
                  "secondaryColor",
                  "condition",
                  "defects",
                  "defectLevel",
                  "material",
                  "style",
                  "pattern",
                  "confidence",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI ไม่สามารถวิเคราะห์รูปภาพได้",
          });
        }

        const analysis = JSON.parse(content);
        return { success: true, analysis };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("[AI Analysis Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI วิเคราะห์ล้มเหลว: ${error.message || "Unknown error"}`,
        });
      }
    }),

  /**
   * สร้างข้อความขายแบบฮุกโดนใจสำหรับโพสขายบน social media
   * รับข้อมูลสินค้า + ผลประเมินราคา แล้ว generate caption 3 แบบ
   */
  generateCaption: publicProcedure
    .input(
      z.object({
        category: z.string(),
        brand: z.string(),
        size: z.string(),
        condition: z.string(),
        color: z.string().optional(),
        recommendedPrice: z.number(),
        originalPrice: z.number().optional(),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `คุณเป็นนักเขียน copywriting มือโปร เชี่ยวชาญการเขียนข้อความขายเสื้อผ้ามือสองบน social media ที่ดึงดูดคนซื้อ

สไตล์การเขียน:
- ใช้ภาษาไทยที่เป็นธรรมชาติ กระชับ ฮุกโดนใจ
- ใส่ emoji ให้เหมาะสม (ไม่มากเกินไป)
- เน้นจุดขาย: ราคาดี สภาพดี แบรนด์ดัง ของหายาก
- มีทั้งแบบสั้น (สำหรับ Twitter/X) และแบบยาว (สำหรับ Facebook/LINE)
- ใส่ hashtag ที่เกี่ยวข้อง

ตอบเป็น JSON เท่านั้น`,
            },
            {
              role: "user",
              content: `สร้างข้อความขายสำหรับสินค้านี้:
- ประเภท: ${input.category}
- แบรนด์: ${input.brand}
- ไซซ์: ${input.size}
- สภาพ: ${input.condition}
- สี: ${input.color || "ไม่ระบุ"}
- สไตล์: ${input.style || "ไม่ระบุ"}
- ราคาแนะนำ: ${input.recommendedPrice} บาท
${input.originalPrice ? `- ราคาเดิม: ${input.originalPrice} บาท (ลด ${Math.round((1 - input.recommendedPrice / input.originalPrice) * 100)}%)` : ""}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "sales_captions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  shortCaption: {
                    type: "string",
                    description: "ข้อความสั้น 1-2 บรรทัด สำหรับ Twitter/X (ไม่เกิน 140 ตัวอักษร)",
                  },
                  mediumCaption: {
                    type: "string",
                    description: "ข้อความกลาง 3-4 บรรทัด สำหรับ Instagram/LINE",
                  },
                  longCaption: {
                    type: "string",
                    description: "ข้อความยาว 5-7 บรรทัด สำหรับ Facebook Marketplace พร้อมรายละเอียดครบ",
                  },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Hashtag ที่แนะนำ 5-8 อัน",
                  },
                },
                required: ["shortCaption", "mediumCaption", "longCaption", "hashtags"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI ไม่สามารถสร้างข้อความได้",
          });
        }

        const captions = JSON.parse(content);
        return { success: true, captions };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("[AI Caption Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `สร้างข้อความล้มเหลว: ${error.message || "Unknown error"}`,
        });
      }
    }),

  /**
   * ดึงราคาตลาด resale จาก StockX/Goat ผ่าน Retailed.io
   * แล้วปรับให้เหมาะกับตลาดมือสองในไทย
   */
  getMarketPrice: publicProcedure
    .input(
      z.object({
        brand: z.string(),
        category: z.string(),
        productName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await getMarketPrice(
          input.brand,
          input.category,
          input.productName
        );
        return result;
      } catch (error: any) {
        console.error("[Market Price Error]", error);
        return {
          found: false,
          sources: [],
          bestEstimate: null,
          internationalEstimate: null,
          searchQuery: `${input.brand} ${input.category}`,
        };
      }
    }),

  /**
   * Multi-Agent Consensus: AI 3 ตัว (Gemini + GPT-4o + Claude) ประเมินร่วมกัน
   * แล้ว cross-validate + debate ก่อนสรุปผลลัพธ์สุดท้าย
   */
  evaluateConsensus: publicProcedure
    .input(
      z.object({
        images: z.array(
          z.object({
            base64: z.string(),
            mimeType: z.string().default("image/jpeg"),
          })
        ).min(1).max(3),
        additionalContext: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // ใช้รูปแรกเป็นหลักในการส่งให้ AI
        const primaryImage = input.images[0];
        const result = await evaluateWithConsensus(
          primaryImage.base64,
          primaryImage.mimeType,
          input.additionalContext,
        );
        return { success: true, ...result };
      } catch (error: any) {
        console.error("[Multi-Agent Consensus Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Multi-Agent Consensus ล้มเหลว: ${error.message || "Unknown error"}`,
        });
      }
    }),
});
