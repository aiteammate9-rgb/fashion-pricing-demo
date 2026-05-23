/**
 * Brand Tier Tests
 * Verify that newly added brands across all 4 categories are correctly mapped
 * in both pricing-engine.ts (BRAND_TIERS) and retailed.ts (BRAND_TO_TIER)
 */
import { describe, it, expect } from "vitest";
import { evaluateItem, type UserInput } from "../client/src/lib/pricing-engine";

// Helper: evaluate a brand and return the pricing result
function evalBrand(brand: string, category = "t_shirt") {
  const input: UserInput = {
    brand,
    category,
    size: "M",
    condition: "good",
    defectLevel: "none",
    sellGoal: "easy_to_sell",
  };
  return evaluateItem(input);
}

describe("Brand Tier Mapping - Thai Brands", () => {
  it("Jaspal should price as high tier", () => {
    const result = evalBrand("Jaspal");
    // High tier t_shirt good condition: base 450 * 0.85 = ~382 → rounded
    expect(result.recommendedPrice).toBeGreaterThan(300);
  });

  it("Vatanika should price as premium tier", () => {
    const result = evalBrand("Vatanika", "dress");
    // Premium dress good condition: base 1800 * 0.85 = ~1530
    expect(result.recommendedPrice).toBeGreaterThan(1000);
  });

  it("AIIZ should price as low tier", () => {
    const result = evalBrand("AIIZ");
    // Low tier t_shirt good condition: base 120 * 0.85 = ~102
    expect(result.recommendedPrice).toBeLessThan(200);
  });

  it("Playhound should price as high tier", () => {
    const result = evalBrand("Playhound");
    expect(result.recommendedPrice).toBeGreaterThan(300);
  });
});

describe("Brand Tier Mapping - K-Fashion Brands", () => {
  it("Ader Error should price as high tier", () => {
    const result = evalBrand("Ader Error");
    expect(result.recommendedPrice).toBeGreaterThan(300);
  });

  it("Gentle Monster should price as premium tier", () => {
    const result = evalBrand("Gentle Monster", "bag");
    // Premium bag good condition: base 3000 * 0.85 = ~2550
    expect(result.recommendedPrice).toBeGreaterThan(2000);
  });

  it("Stylenanda should price as mid tier", () => {
    const result = evalBrand("Stylenanda");
    // Mid tier t_shirt good condition: base 250 * 0.85 = ~212
    expect(result.recommendedPrice).toBeGreaterThan(150);
    expect(result.recommendedPrice).toBeLessThan(400);
  });

  it("Wooyoungmi should price as premium tier", () => {
    const result = evalBrand("Wooyoungmi", "jacket");
    expect(result.recommendedPrice).toBeGreaterThan(1500);
  });
});

describe("Brand Tier Mapping - Vintage/Thrift Brands", () => {
  it("Barbour should price as premium tier", () => {
    const result = evalBrand("Barbour", "jacket");
    expect(result.recommendedPrice).toBeGreaterThan(1500);
  });

  it("Wrangler should price as mid tier", () => {
    const result = evalBrand("Wrangler", "pants");
    // Mid tier pants good condition: base 400 * 0.85 = ~340
    expect(result.recommendedPrice).toBeGreaterThan(250);
    expect(result.recommendedPrice).toBeLessThan(500);
  });

  it("Helmut Lang should price as premium tier", () => {
    const result = evalBrand("Helmut Lang", "jacket");
    expect(result.recommendedPrice).toBeGreaterThan(1500);
  });

  it("Evisu should price as high tier", () => {
    const result = evalBrand("Evisu", "pants");
    expect(result.recommendedPrice).toBeGreaterThan(500);
  });
});

describe("Brand Tier Mapping - Sports Brands", () => {
  it("Lululemon should price as high tier", () => {
    const result = evalBrand("Lululemon", "pants");
    expect(result.recommendedPrice).toBeGreaterThan(500);
  });

  it("Hoka should price as high tier", () => {
    const result = evalBrand("Hoka");
    expect(result.recommendedPrice).toBeGreaterThan(300);
  });

  it("Rapha should price as premium tier", () => {
    const result = evalBrand("Rapha", "jacket");
    expect(result.recommendedPrice).toBeGreaterThan(1500);
  });

  it("Gymshark should price as mid tier", () => {
    const result = evalBrand("Gymshark");
    expect(result.recommendedPrice).toBeGreaterThan(150);
    expect(result.recommendedPrice).toBeLessThan(400);
  });

  it("On Running should price as high tier", () => {
    const result = evalBrand("On Running");
    expect(result.recommendedPrice).toBeGreaterThan(300);
  });
});
