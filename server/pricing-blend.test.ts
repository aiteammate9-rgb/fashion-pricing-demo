import { describe, it, expect } from "vitest";
import { blendWithAIConsensus } from "../client/src/lib/pricing-engine";

/**
 * Test the pricing blend logic that combines AI consensus with rule-based pricing
 * Uses the actual exported function from pricing-engine.ts
 */

describe("Pricing Blend Logic (blendWithAIConsensus)", () => {
  it("should maintain order: fast < recommended < high", () => {
    const result = blendWithAIConsensus(1000, 250, 60);
    expect(result.fastSale).toBeLessThan(result.recommended);
    expect(result.recommended).toBeLessThan(result.highValue);
  });

  it("should not let AI drag price below 50% of rule-based (Levi's case)", () => {
    // Levi's pants: rule-based ~1099, AI says 250 (way too low)
    const result = blendWithAIConsensus(1099, 250, 60);
    // Must be at least 50% of rule-based = 550
    expect(result.recommended).toBeGreaterThanOrEqual(550);
    // Should still be reasonable (not 250)
    expect(result.recommended).toBeGreaterThan(700);
  });

  it("should give AI more influence when prices are close", () => {
    // Rule says 1000, AI says 900 (close, 10% deviation)
    const result = blendWithAIConsensus(1000, 900, 80);
    // AI should pull it down somewhat
    expect(result.recommended).toBeLessThan(1000);
    expect(result.recommended).toBeGreaterThan(900);
  });

  it("should give AI less influence when prices are far apart", () => {
    // Rule says 1000, AI says 200 (80% deviation)
    const result = blendWithAIConsensus(1000, 200, 60);
    // Should stay much closer to rule-based
    expect(result.recommended).toBeGreaterThan(700);
  });

  it("should respect high confidence AI when deviation is moderate", () => {
    // Rule says 1000, AI says 700 (30% deviation), high confidence
    const result = blendWithAIConsensus(1000, 700, 90);
    // Should move toward AI but not fully
    expect(result.recommended).toBeLessThan(1000);
    expect(result.recommended).toBeGreaterThan(700);
  });

  it("should handle AI price higher than rule-based", () => {
    // Rule says 500, AI says 1200 (AI thinks it's worth more)
    const result = blendWithAIConsensus(500, 1200, 70);
    // Should increase from rule-based
    expect(result.recommended).toBeGreaterThan(500);
    // But not fully to AI price
    expect(result.recommended).toBeLessThan(1200);
  });

  it("should handle low confidence AI", () => {
    // Low confidence = AI gets very little weight
    const result = blendWithAIConsensus(1000, 300, 20);
    // Should stay very close to rule-based
    expect(result.recommended).toBeGreaterThan(850);
  });

  it("should handle equal prices (no change needed)", () => {
    const result = blendWithAIConsensus(800, 800, 80);
    expect(result.recommended).toBe(800);
    expect(result.fastSale).toBe(656);
    expect(result.highValue).toBe(960);
  });

  it("should always produce marketMin < recommended < marketMax", () => {
    const testCases = [
      { rule: 1000, ai: 250, conf: 60 },
      { rule: 500, ai: 1500, conf: 80 },
      { rule: 300, ai: 300, conf: 50 },
      { rule: 2000, ai: 100, conf: 90 },
    ];
    for (const tc of testCases) {
      const result = blendWithAIConsensus(tc.rule, tc.ai, tc.conf);
      expect(result.marketMin).toBeLessThan(result.recommended);
      expect(result.recommended).toBeLessThan(result.marketMax);
    }
  });
});
