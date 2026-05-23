/**
 * Thai Market Factor Module
 * 
 * ปรับราคาจากตลาดสากลให้เหมาะกับตลาดมือสองไทย
 * 
 * หลักการ:
 * - ราคาตลาดมือสองไทยต่ำกว่าตลาดสากล 10-40% ขึ้นกับ brand tier
 * - Luxury brands รักษามูลค่าได้ดีกว่า (ลดน้อย)
 * - Fast fashion ลดมาก เพราะ supply สูง + กำลังซื้อต่ำ
 * - Thai brands ไม่ต้องปรับ (ราคาเป็นราคาไทยอยู่แล้ว)
 * 
 * อ้างอิง:
 * - SCB EIC: ตลาดเสื้อผ้ามือสองไทย 2023 มูลค่า 1,800 ล้านบาท
 * - 2nd Street Japan (สาขาไทย): รับซื้อ 30-40% ของราคาร้าน
 * - ConsignCloud 1/3 Rule: ราคามือสอง ≈ 33% ของราคาปลีก (สากล)
 * - ตลาดไทย: ต่ำกว่าสากลอีก 10-25% เนื่องจากกำลังซื้อ + supply
 */

// ─── Thai Market Discount Factors ───
// ค่า factor = สัดส่วนที่ราคาไทยเป็นเมื่อเทียบกับราคาสากล
// เช่น 0.75 หมายถึง ราคาไทย = 75% ของราคาสากล (ลด 25%)

export interface ThaiMarketFactorConfig {
  /** ชื่อ tier */
  tier: string;
  /** Thai label */
  label: string;
  /** Factor เทียบกับราคาสากล (0-1) */
  thaiVsInternational: number;
  /** % ของราคาปลีกที่ขายมือสองได้ในไทย (สภาพดี) */
  resalePercentOfRetail: { min: number; max: number };
  /** ตัวอย่างแบรนด์ */
  examples: string[];
}

export const THAI_MARKET_FACTORS: Record<string, ThaiMarketFactorConfig> = {
  ultra_luxury: {
    tier: "ultra_luxury",
    label: "Ultra Luxury",
    thaiVsInternational: 0.85,
    resalePercentOfRetail: { min: 0.50, max: 0.75 },
    examples: ["Hermès", "Chanel", "Birkin"],
  },
  luxury: {
    tier: "luxury",
    label: "Luxury",
    thaiVsInternational: 0.80,
    resalePercentOfRetail: { min: 0.35, max: 0.60 },
    examples: ["Louis Vuitton", "Gucci", "Prada", "Dior", "Balenciaga"],
  },
  premium_accessible: {
    tier: "premium_accessible",
    label: "Premium / Accessible Luxury",
    thaiVsInternational: 0.75,
    resalePercentOfRetail: { min: 0.25, max: 0.45 },
    examples: ["Coach", "Kate Spade", "Michael Kors", "Longchamp", "Marc Jacobs"],
  },
  streetwear_hype: {
    tier: "streetwear_hype",
    label: "Streetwear / Hype",
    thaiVsInternational: 0.80,
    resalePercentOfRetail: { min: 0.30, max: 0.55 },
    examples: ["Supreme", "Off-White", "BAPE", "Stussy", "Palace"],
  },
  sport_premium: {
    tier: "sport_premium",
    label: "Sport Premium",
    thaiVsInternational: 0.75,
    resalePercentOfRetail: { min: 0.25, max: 0.45 },
    examples: ["Nike", "Adidas", "Lululemon", "Arc'teryx", "The North Face"],
  },
  high_street: {
    tier: "high_street",
    label: "High Street / Contemporary",
    thaiVsInternational: 0.70,
    resalePercentOfRetail: { min: 0.20, max: 0.35 },
    examples: ["Zara", "Mango", "COS", "& Other Stories", "Massimo Dutti"],
  },
  thai_premium: {
    tier: "thai_premium",
    label: "Thai Premium",
    thaiVsInternational: 1.00, // ไม่ต้องปรับ เป็นราคาไทยอยู่แล้ว
    resalePercentOfRetail: { min: 0.25, max: 0.40 },
    examples: ["Jaspal", "CPS", "Greyhound", "Sretsis", "Asava", "Vatanika"],
  },
  thai_mid: {
    tier: "thai_mid",
    label: "Thai Mid-tier",
    thaiVsInternational: 1.00,
    resalePercentOfRetail: { min: 0.15, max: 0.30 },
    examples: ["Pomelo", "CC Double O", "Hooks", "Sabina", "MC Jeans"],
  },
  mid_tier: {
    tier: "mid_tier",
    label: "Mid-tier / Fast Fashion+",
    thaiVsInternational: 0.65,
    resalePercentOfRetail: { min: 0.15, max: 0.30 },
    examples: ["Uniqlo", "GAP", "Muji", "H&M", "Cotton On"],
  },
  budget: {
    tier: "budget",
    label: "Budget / No Brand",
    thaiVsInternational: 0.60,
    resalePercentOfRetail: { min: 0.10, max: 0.20 },
    examples: ["No Brand", "SHEIN", "Giordano", "AIIZ"],
  },
};

// ─── Brand to Thai Market Tier Mapping ───
// Maps the existing brand tier system (low/mid/high/premium) + brand name to Thai market tier

const BRAND_THAI_TIER_OVERRIDE: Record<string, string> = {
  // Ultra Luxury
  "hermes": "ultra_luxury",
  "hermès": "ultra_luxury",
  "chanel": "ultra_luxury",
  // Luxury
  "louis vuitton": "luxury",
  "lv": "luxury",
  "gucci": "luxury",
  "prada": "luxury",
  "dior": "luxury",
  "balenciaga": "luxury",
  "bottega veneta": "luxury",
  "saint laurent": "luxury",
  "ysl": "luxury",
  "celine": "luxury",
  "loewe": "luxury",
  "valentino": "luxury",
  "fendi": "luxury",
  "givenchy": "luxury",
  "miu miu": "luxury",
  "versace": "luxury",
  "dolce & gabbana": "luxury",
  "burberry": "luxury",
  // Premium Accessible
  "coach": "premium_accessible",
  "michael kors": "premium_accessible",
  "kate spade": "premium_accessible",
  "ralph lauren": "premium_accessible",
  "polo ralph lauren": "premium_accessible",
  "marc jacobs": "premium_accessible",
  "tory burch": "premium_accessible",
  "furla": "premium_accessible",
  "longchamp": "premium_accessible",
  "mcm": "premium_accessible",
  "hugo boss": "premium_accessible",
  "sandro": "premium_accessible",
  "maje": "premium_accessible",
  // Streetwear / Hype
  "supreme": "streetwear_hype",
  "stussy": "streetwear_hype",
  "stüssy": "streetwear_hype",
  "off-white": "streetwear_hype",
  "off white": "streetwear_hype",
  "bape": "streetwear_hype",
  "a bathing ape": "streetwear_hype",
  "palace": "streetwear_hype",
  "fear of god": "streetwear_hype",
  "kith": "streetwear_hype",
  "comme des garcons": "streetwear_hype",
  "cdg": "streetwear_hype",
  "stone island": "streetwear_hype",
  "acne studios": "streetwear_hype",
  "issey miyake": "streetwear_hype",
  "yohji yamamoto": "streetwear_hype",
  "rick owens": "streetwear_hype",
  // Sport Premium
  "nike": "sport_premium",
  "adidas": "sport_premium",
  "new balance": "sport_premium",
  "the north face": "sport_premium",
  "patagonia": "sport_premium",
  "lululemon": "sport_premium",
  "arc'teryx": "sport_premium",
  "arcteryx": "sport_premium",
  "salomon": "sport_premium",
  "hoka": "sport_premium",
  "on running": "sport_premium",
  // High Street
  "zara": "high_street",
  "mango": "high_street",
  "cos": "high_street",
  "& other stories": "high_street",
  "massimo dutti": "high_street",
  "levi's": "high_street",
  "levis": "high_street",
  "tommy hilfiger": "high_street",
  "calvin klein": "high_street",
  "lacoste": "high_street",
  "fred perry": "high_street",
  "carhartt wip": "high_street",
  "dr. martens": "high_street",
  "dr martens": "high_street",
  // Thai Premium
  "jaspal": "thai_premium",
  "cps": "thai_premium",
  "cps chaps": "thai_premium",
  "greyhound": "thai_premium",
  "sretsis": "thai_premium",
  "disaya": "thai_premium",
  "kloset": "thai_premium",
  "asava": "thai_premium",
  "vatanika": "thai_premium",
  "tawn c.": "thai_premium",
  "tawn c": "thai_premium",
  "milin": "thai_premium",
  "patinya": "thai_premium",
  "flynow": "thai_premium",
  "theatre": "thai_premium",
  "gentlewoman": "thai_premium",
  "issue": "thai_premium",
  "senada": "thai_premium",
  "poem": "thai_premium",
  "carnival": "thai_premium",
  // Thai Mid
  "pomelo": "thai_mid",
  "cc double o": "thai_mid",
  "cc-oo": "thai_mid",
  "hooks": "thai_mid",
  "hook's": "thai_mid",
  "sabina": "thai_mid",
  "mc jeans": "thai_mid",
  "body glove": "thai_mid",
  "esp": "thai_mid",
  "lyn": "thai_mid",
  "lyn around": "thai_mid",
  "tango": "thai_mid",
  "naraya": "thai_mid",
  "dapper": "thai_mid",
  "soda": "thai_mid",
  // Mid-tier / Fast Fashion
  "uniqlo": "mid_tier",
  "h&m": "mid_tier",
  "gap": "mid_tier",
  "muji": "mid_tier",
  "cotton on": "mid_tier",
  "forever 21": "mid_tier",
  "topshop": "mid_tier",
  "pull&bear": "mid_tier",
  "bershka": "mid_tier",
  "converse": "mid_tier",
  "vans": "mid_tier",
  "puma": "mid_tier",
  "champion": "mid_tier",
  "fila": "mid_tier",
  // Budget
  "no brand": "budget",
  "unknown": "budget",
  "shein": "budget",
  "giordano": "budget",
  "bossini": "budget",
  "aiiz": "budget",
  "old navy": "budget",
  "factorie": "budget",
};

// ─── Core Functions ───

/**
 * หา Thai Market Tier จากชื่อแบรนด์
 * ลำดับ: override map → fallback จาก existing brand tier
 */
export function getThaiMarketTier(brand: string, existingBrandTier?: string): string {
  const normalized = (brand || "").trim().toLowerCase();
  
  // Check override map first
  if (BRAND_THAI_TIER_OVERRIDE[normalized]) {
    return BRAND_THAI_TIER_OVERRIDE[normalized];
  }

  // Fallback: map existing brand tier to Thai market tier
  if (existingBrandTier) {
    switch (existingBrandTier) {
      case "premium": return "premium_accessible";
      case "high": return "high_street";
      case "mid": return "mid_tier";
      case "low": return "budget";
      default: return "mid_tier";
    }
  }

  return "mid_tier"; // default
}

/**
 * คำนวณ Thai Market Factor สำหรับแบรนด์
 * Returns factor config + computed adjustment
 */
export function getThaiMarketFactor(brand: string, existingBrandTier?: string): ThaiMarketFactorConfig {
  const tier = getThaiMarketTier(brand, existingBrandTier);
  return THAI_MARKET_FACTORS[tier] || THAI_MARKET_FACTORS.mid_tier;
}

/**
 * ปรับราคาสากลให้เป็นราคาตลาดไทย
 */
export function applyThaiMarketFactor(internationalPrice: number, brand: string, existingBrandTier?: string): number {
  const factor = getThaiMarketFactor(brand, existingBrandTier);
  return Math.round(internationalPrice * factor.thaiVsInternational);
}

/**
 * คำนวณราคาจากราคาปลีก (retail price) โดยใช้ Thai market resale percentage
 * ใช้เมื่อรู้ราคาปลีกของสินค้า
 */
export function estimateThaiResaleFromRetail(
  retailPrice: number,
  brand: string,
  condition: string,
  existingBrandTier?: string,
): { min: number; max: number; recommended: number } {
  const factor = getThaiMarketFactor(brand, existingBrandTier);
  
  // Condition adjustment
  const conditionMultiplier: Record<string, number> = {
    new_with_tag: 1.10,
    like_new: 0.95,
    good: 0.80,
    fair: 0.60,
    poor: 0.40,
    defective: 0.35,
  };
  const condMult = conditionMultiplier[condition] || 0.80;

  const min = Math.round(retailPrice * factor.resalePercentOfRetail.min * condMult);
  const max = Math.round(retailPrice * factor.resalePercentOfRetail.max * condMult);
  const recommended = Math.round((min + max) / 2);

  return { min, max, recommended };
}

/**
 * สร้างข้อมูลเปรียบเทียบราคาไทย vs สากล
 * สำหรับแสดงใน UI
 */
export interface ThaiVsInternationalBreakdown {
  thaiPrice: number;
  internationalPrice: number;
  thaiMarketTier: string;
  thaiMarketLabel: string;
  discountPercent: number;
  explanation: string;
}

export function getThaiVsInternationalBreakdown(
  internationalPrice: number,
  brand: string,
  existingBrandTier?: string,
): ThaiVsInternationalBreakdown {
  const factor = getThaiMarketFactor(brand, existingBrandTier);
  const thaiPrice = Math.round(internationalPrice * factor.thaiVsInternational);
  const discountPercent = Math.round((1 - factor.thaiVsInternational) * 100);

  let explanation: string;
  if (factor.thaiVsInternational >= 1.0) {
    explanation = `แบรนด์ไทย — ใช้ราคาตลาดไทยโดยตรง`;
  } else if (discountPercent <= 15) {
    explanation = `${factor.label} — ราคาไทยใกล้เคียงสากล (ลด ${discountPercent}%) เพราะ demand สูง`;
  } else if (discountPercent <= 25) {
    explanation = `${factor.label} — ราคาไทยต่ำกว่าสากล ${discountPercent}% ตามกำลังซื้อ`;
  } else {
    explanation = `${factor.label} — ราคาไทยต่ำกว่าสากล ${discountPercent}% เพราะ supply สูง + กำลังซื้อต่ำ`;
  }

  return {
    thaiPrice,
    internationalPrice,
    thaiMarketTier: factor.tier,
    thaiMarketLabel: factor.label,
    discountPercent,
    explanation,
  };
}
