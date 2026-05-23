import { describe, it, expect } from "vitest";
import { detectCollab } from "./services/retailed";

describe("Retailed Pricing Logic", () => {
  describe("detectCollab", () => {
    it("should detect collab items with ' x ' pattern", () => {
      expect(detectCollab("KAWS x Uniqlo T-Shirt", "uniqlo")).toBe(true);
      expect(detectCollab("Supreme x Nike Air Force 1", "nike")).toBe(true);
      expect(detectCollab("Travis Scott x Jordan 1", "jordan")).toBe(true);
    });

    it("should detect collab items with collab keywords", () => {
      expect(detectCollab("Uniqlo KAWS Collaboration Tee", "uniqlo")).toBe(true);
      expect(detectCollab("Nike Limited Edition Air Max", "nike")).toBe(true);
      expect(detectCollab("Adidas Special Edition Ultraboost", "adidas")).toBe(true);
    });

    it("should detect collab items when product mentions known collab brands", () => {
      expect(detectCollab("Uniqlo KAWS Sesame Street Tee", "uniqlo")).toBe(true);
      expect(detectCollab("Nike Off-White Dunk Low", "nike")).toBe(true);
      expect(detectCollab("Adidas BAPE NMD R1", "adidas")).toBe(true);
    });

    it("should NOT detect collab for regular items", () => {
      expect(detectCollab("Uniqlo Dry-EX Crew Neck T-Shirt", "uniqlo")).toBe(false);
      expect(detectCollab("Zara Basic Slim Fit Shirt", "zara")).toBe(false);
      expect(detectCollab("Nike Dri-FIT Running Tee", "nike")).toBe(false);
      expect(detectCollab("Levi's 501 Original Fit Jeans", "levi's")).toBe(false);
    });

    it("should NOT flag brand itself as collab (e.g. Supreme product from Supreme)", () => {
      expect(detectCollab("Supreme Box Logo Tee", "supreme")).toBe(false);
      expect(detectCollab("BAPE Shark Hoodie", "bape")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(detectCollab("KAWS X UNIQLO TEE", "UNIQLO")).toBe(true);
      expect(detectCollab("nike off-white blazer", "NIKE")).toBe(true);
    });
  });
});
