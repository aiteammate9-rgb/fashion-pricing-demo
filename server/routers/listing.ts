import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

/**
 * Listing Router
 * สร้าง listing content สำหรับ eBay/Amazon จากข้อมูลสินค้า + ราคาต่างประเทศ
 */

export const listingRouter = router({
  /**
   * สร้าง listing สำหรับ eBay
   * Generate: title, description, item specifics, tags
   */
  generateEbay: publicProcedure
    .input(
      z.object({
        category: z.string(),
        brand: z.string(),
        size: z.string(),
        condition: z.string(),
        color: z.string().optional(),
        style: z.string().optional(),
        material: z.string().optional(),
        defectDescription: z.string().optional(),
        recommendedPriceUSD: z.number(),
        originalPriceTHB: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert eBay listing copywriter specializing in pre-owned fashion items. 
Create compelling, SEO-optimized listings that maximize visibility and sales.

Rules:
- Title must be under 80 characters, include brand, key features, and size
- Description should be detailed, honest about condition, and highlight value
- Use professional English
- Include relevant item specifics for eBay's structured data
- Suggest competitive pricing strategy
- Add relevant search tags/keywords

Respond in JSON only.`,
            },
            {
              role: "user",
              content: `Create an eBay listing for this pre-owned fashion item:
- Category: ${input.category}
- Brand: ${input.brand}
- Size: ${input.size}
- Condition: ${input.condition}
- Color: ${input.color || "Not specified"}
- Style: ${input.style || "Not specified"}
- Material: ${input.material || "Not specified"}
- Defects: ${input.defectDescription || "None"}
- Suggested Price: $${input.recommendedPriceUSD} USD
${input.originalPriceTHB ? `- Original Retail Price: ~$${Math.round(input.originalPriceTHB / 35.5)} USD` : ""}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ebay_listing",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "eBay listing title (max 80 chars), SEO-optimized",
                  },
                  subtitle: {
                    type: "string",
                    description: "Optional subtitle for extra visibility",
                  },
                  description: {
                    type: "string",
                    description: "Full HTML-free description with condition details, measurements note, and shipping info",
                  },
                  conditionDescription: {
                    type: "string",
                    description: "Brief condition note for eBay's condition field",
                  },
                  itemSpecifics: {
                    type: "object",
                    properties: {
                      brand: { type: "string" },
                      size: { type: "string" },
                      color: { type: "string" },
                      style: { type: "string" },
                      material: { type: "string" },
                      department: { type: "string" },
                      type: { type: "string" },
                      pattern: { type: "string" },
                    },
                    required: ["brand", "size", "color", "style", "material", "department", "type", "pattern"],
                    additionalProperties: false,
                  },
                  suggestedPrice: {
                    type: "object",
                    properties: {
                      buyItNow: { type: "number", description: "Buy It Now price in USD" },
                      auctionStart: { type: "number", description: "Auction starting price in USD" },
                      bestOffer: { type: "boolean", description: "Whether to enable Best Offer" },
                    },
                    required: ["buyItNow", "auctionStart", "bestOffer"],
                    additionalProperties: false,
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Search keywords/tags for better discoverability",
                  },
                  shippingNote: {
                    type: "string",
                    description: "Suggested shipping method and estimated cost",
                  },
                },
                required: ["title", "subtitle", "description", "conditionDescription", "itemSpecifics", "suggestedPrice", "tags", "shippingNote"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content as string | undefined;
        if (!content) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI failed to generate listing" });
        }

        return { success: true, platform: "ebay" as const, listing: JSON.parse(content) };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("[Listing eBay Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate eBay listing: ${error.message}`,
        });
      }
    }),

  /**
   * สร้าง listing สำหรับ Amazon
   */
  generateAmazon: publicProcedure
    .input(
      z.object({
        category: z.string(),
        brand: z.string(),
        size: z.string(),
        condition: z.string(),
        color: z.string().optional(),
        style: z.string().optional(),
        material: z.string().optional(),
        defectDescription: z.string().optional(),
        recommendedPriceUSD: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert Amazon Marketplace listing writer for pre-owned fashion.
Create listings optimized for Amazon's search algorithm (A9/A10).

Rules:
- Title: Brand + Key Feature + Size + Color (under 200 chars)
- Bullet points: 5 key features, each starting with CAPS keyword
- Description: Detailed, honest, professional
- Backend keywords: relevant search terms not in title
- Condition notes must be accurate for Amazon's grading system

Respond in JSON only.`,
            },
            {
              role: "user",
              content: `Create an Amazon listing for this pre-owned fashion item:
- Category: ${input.category}
- Brand: ${input.brand}
- Size: ${input.size}
- Condition: ${input.condition}
- Color: ${input.color || "Not specified"}
- Style: ${input.style || "Not specified"}
- Material: ${input.material || "Not specified"}
- Defects: ${input.defectDescription || "None"}
- Price: $${input.recommendedPriceUSD} USD`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "amazon_listing",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Amazon product title (under 200 chars)",
                  },
                  bulletPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "5 bullet points highlighting key features",
                  },
                  description: {
                    type: "string",
                    description: "Full product description",
                  },
                  conditionGrade: {
                    type: "string",
                    description: "Amazon condition: Like New, Very Good, Good, Acceptable",
                  },
                  conditionNote: {
                    type: "string",
                    description: "Detailed condition note",
                  },
                  backendKeywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Backend search terms (not visible to buyers)",
                  },
                  suggestedPrice: {
                    type: "number",
                    description: "Suggested listing price in USD",
                  },
                  category: {
                    type: "string",
                    description: "Suggested Amazon category path",
                  },
                },
                required: ["title", "bulletPoints", "description", "conditionGrade", "conditionNote", "backendKeywords", "suggestedPrice", "category"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content as string | undefined;
        if (!content) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI failed to generate listing" });
        }

        return { success: true, platform: "amazon" as const, listing: JSON.parse(content) };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error("[Listing Amazon Error]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate Amazon listing: ${error.message}`,
        });
      }
    }),
});
