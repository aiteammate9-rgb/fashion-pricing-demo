/**
 * Thai Market Factor Tests
 * 
 * Verifies that the Thai Market Factor module correctly:
 * 1. Maps brands to the right Thai market tier
 * 2. Applies correct discount factors
 * 3. Handles edge cases (unknown brands, Thai brands, luxury)
 */
import { describe, it, expect } from "vitest";
import {
  getThaiMarketTier,
  getThaiMarketFactor,
  applyThaiMarketFactor,
  getThaiVsInternationalBreakdown,
  estimateThaiResaleFromRetail,
  THAI_MARKET_FACTORS,
} from "@shared/thai-market-factor";

describe("Thai Market Factor", () => {
  describe("getThaiMarketTier", () => {
    it("should map luxury brands to correct tier", () => {
      expect(getThaiMarketTier("Chanel")).toBe("ultra_luxury");
      expect(getThaiMarketTier("Hermès")).toBe("ultra_luxury");
      expect(getThaiMarketTier("Gucci")).toBe("luxury");
      expect(getThaiMarketTier("Louis Vuitton")).toBe("luxury");
    });

    it("should map Thai brands to thai_premium", () => {
      expect(getThaiMarketTier("Jaspal")).toBe("thai_premium");
      expect(getThaiMarketTier("CPS Chaps")).toBe("thai_premium");
      expect(getThaiMarketTier("Greyhound")).toBe("thai_premium");
      expect(getThaiMarketTier("Sretsis")).toBe("thai_premium");
    });

    it("should map Thai mid-tier brands correctly", () => {
      expect(getThaiMarketTier("Pomelo")).toBe("thai_mid");
      expect(getThaiMarketTier("CC Double O")).toBe("thai_mid");
      expect(getThaiMarketTier("Hooks")).toBe("thai_mid");
    });

    it("should map fast fashion to mid_tier", () => {
      expect(getThaiMarketTier("Uniqlo")).toBe("mid_tier");
      expect(getThaiMarketTier("H&M")).toBe("mid_tier");
      expect(getThaiMarketTier("GAP")).toBe("mid_tier");
    });

    it("should map streetwear brands correctly", () => {
      expect(getThaiMarketTier("Supreme")).toBe("streetwear_hype");
      expect(getThaiMarketTier("Off-White")).toBe("streetwear_hype");
      expect(getThaiMarketTier("BAPE")).toBe("streetwear_hype");
    });

    it("should fallback to mid_tier for unknown brands", () => {
      expect(getThaiMarketTier("SomeRandomBrand123")).toBe("mid_tier");
    });

    it("should use existingBrandTier fallback when brand not in override map", () => {
      expect(getThaiMarketTier("UnknownBrand", "premium")).toBe("premium_accessible");
      expect(getThaiMarketTier("UnknownBrand", "high")).toBe("high_street");
      expect(getThaiMarketTier("UnknownBrand", "mid")).toBe("mid_tier");
      expect(getThaiMarketTier("UnknownBrand", "low")).toBe("budget");
    });
  });

  describe("getThaiMarketFactor", () => {
    it("should return correct factor for luxury brands", () => {
      const factor = getThaiMarketFactor("Gucci");
      expect(factor.thaiVsInternational).toBe(0.80);
      expect(factor.tier).toBe("luxury");
    });

    it("should return factor of 1.0 for Thai brands (no discount)", () => {
      const factor = getThaiMarketFactor("Jaspal");
      expect(factor.thaiVsInternational).toBe(1.00);
    });

    it("should return lower factor for budget brands", () => {
      const factor = getThaiMarketFactor("SHEIN");
      expect(factor.thaiVsInternational).toBe(0.60);
    });
  });

  describe("applyThaiMarketFactor", () => {
    it("should reduce international price for non-Thai brands", () => {
      // Gucci: 80% of international
      const result = applyThaiMarketFactor(10000, "Gucci");
      expect(result).toBe(8000);
    });

    it("should not reduce price for Thai brands", () => {
      const result = applyThaiMarketFactor(5000, "Jaspal");
      expect(result).toBe(5000);
    });

    it("should apply 60% factor for budget brands", () => {
      const result = applyThaiMarketFactor(1000, "SHEIN");
      expect(result).toBe(600);
    });
  });

  describe("getThaiVsInternationalBreakdown", () => {
    it("should return correct breakdown for luxury", () => {
      const breakdown = getThaiVsInternationalBreakdown(10000, "Gucci");
      expect(breakdown.thaiPrice).toBe(8000);
      expect(breakdown.internationalPrice).toBe(10000);
      expect(breakdown.discountPercent).toBe(20);
      expect(breakdown.thaiMarketTier).toBe("luxury");
      expect(breakdown.explanation).toContain("20%");
    });

    it("should show 0% discount for Thai brands", () => {
      const breakdown = getThaiVsInternationalBreakdown(3000, "Jaspal");
      expect(breakdown.discountPercent).toBe(0);
      expect(breakdown.thaiPrice).toBe(3000);
      expect(breakdown.explanation).toContain("แบรนด์ไทย");
    });

    it("should show high discount for budget brands", () => {
      const breakdown = getThaiVsInternationalBreakdown(500, "No Brand");
      expect(breakdown.discountPercent).toBe(40);
      expect(breakdown.thaiPrice).toBe(300);
    });
  });

  describe("estimateThaiResaleFromRetail", () => {
    it("should estimate resale price from retail for luxury", () => {
      const result = estimateThaiResaleFromRetail(50000, "Gucci", "good");
      // Luxury: 35-60% of retail * 0.80 condition
      expect(result.min).toBeGreaterThan(0);
      expect(result.max).toBeGreaterThan(result.min);
      expect(result.recommended).toBe(Math.round((result.min + result.max) / 2));
    });

    it("should give lower resale for poor condition", () => {
      const good = estimateThaiResaleFromRetail(5000, "Uniqlo", "good");
      const poor = estimateThaiResaleFromRetail(5000, "Uniqlo", "poor");
      expect(poor.recommended).toBeLessThan(good.recommended);
    });
  });

  describe("THAI_MARKET_FACTORS config", () => {
    it("should have all required tiers", () => {
      const requiredTiers = [
        "ultra_luxury", "luxury", "premium_accessible",
        "streetwear_hype", "sport_premium", "high_street",
        "thai_premium", "thai_mid", "mid_tier", "budget",
      ];
      for (const tier of requiredTiers) {
        expect(THAI_MARKET_FACTORS[tier]).toBeDefined();
        expect(THAI_MARKET_FACTORS[tier].thaiVsInternational).toBeGreaterThan(0);
        expect(THAI_MARKET_FACTORS[tier].thaiVsInternational).toBeLessThanOrEqual(1);
      }
    });

    it("should have descending discount from luxury to budget", () => {
      const luxuryFactor = THAI_MARKET_FACTORS.luxury.thaiVsInternational;
      const midFactor = THAI_MARKET_FACTORS.mid_tier.thaiVsInternational;
      const budgetFactor = THAI_MARKET_FACTORS.budget.thaiVsInternational;
      
      expect(luxuryFactor).toBeGreaterThan(midFactor);
      expect(midFactor).toBeGreaterThan(budgetFactor);
    });
  });
});
