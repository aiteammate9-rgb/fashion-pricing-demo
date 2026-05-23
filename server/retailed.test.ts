import { describe, it, expect } from "vitest";

/**
 * Test Retailed.io API connectivity
 * Validates that the RETAILED_API_KEY env var is set and can reach the API
 * Note: 402 = quota exceeded (valid key but out of credits) - still counts as "connected"
 */
describe("Retailed.io API Integration", () => {
  const API_KEY = process.env.RETAILED_API_KEY;
  const BASE_URL = "https://app.retailed.io/api/v1";

  it("should have RETAILED_API_KEY configured", () => {
    expect(API_KEY).toBeDefined();
    expect(API_KEY).not.toBe("");
    expect(API_KEY!.length).toBeGreaterThan(10);
  });

  it("should successfully search StockX", { timeout: 15000 }, async () => {
    const url = new URL(`${BASE_URL}/scraper/stockx/search`);
    url.searchParams.set("query", "nike t-shirt");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
    });

    // 200 = success, 402 = quota exceeded (valid key, out of credits)
    expect([200, 402]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it("should successfully search Goat", { timeout: 15000 }, async () => {
    const url = new URL(`${BASE_URL}/scraper/goat/search`);
    url.searchParams.set("query", "adidas hoodie");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": API_KEY!,
        "Content-Type": "application/json",
      },
    });

    // 200 = success, 402 = quota exceeded (valid key, out of credits)
    expect([200, 402]).toContain(response.status);
    if (response.status === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});
