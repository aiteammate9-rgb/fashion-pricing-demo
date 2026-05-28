/**
 * Clothing Pricing Engine V1 – TypeScript Frontend Version
 * 
 * Design: Soft Utility
 * ระบบประเมินราคาสินค้าแฟชั่นมือสองจากข้อมูลที่ผู้ใช้กรอก
 * เวอร์ชันนี้เป็น rule-based engine สำหรับ MVP
 */

// ─── Data Tables ───

// Base prices reflect realistic Thai second-hand market prices (THB)
// low = no brand/fast fashion, mid = mid-tier (Uniqlo, H&M, Gap), high = premium casual (Levi's, Nike, Zara)
const CATEGORY_BASE_PRICE: Record<string, { low: number; mid: number; high: number; premium: number }> = {
  // ─── Tops (ท่อนบน) ───
  t_shirt: { low: 120, mid: 250, high: 450, premium: 900 },
  shirt: { low: 150, mid: 350, high: 600, premium: 1200 },
  blouse: { low: 150, mid: 350, high: 600, premium: 1200 },
  crop_top: { low: 100, mid: 220, high: 400, premium: 800 },
  camisole: { low: 80, mid: 180, high: 350, premium: 700 },
  tank_top: { low: 80, mid: 180, high: 350, premium: 700 },
  // ─── Bottoms (ท่อนล่าง) ───
  jeans: { low: 200, mid: 450, high: 850, premium: 1800 },
  pants: { low: 180, mid: 400, high: 750, premium: 1500 },
  shorts: { low: 120, mid: 280, high: 500, premium: 1000 },
  skirt: { low: 180, mid: 380, high: 700, premium: 1400 },
  leggings: { low: 100, mid: 250, high: 500, premium: 1000 },
  // ─── One-Piece (ชุดชิ้นเดียว) ───
  dress: { low: 250, mid: 500, high: 900, premium: 1800 },
  jumpsuit: { low: 250, mid: 500, high: 900, premium: 1800 },
  romper: { low: 200, mid: 400, high: 750, premium: 1500 },
  // ─── Outerwear (เสื้อคลุม) ───
  blazer: { low: 350, mid: 700, high: 1200, premium: 2500 },
  jacket: { low: 350, mid: 700, high: 1200, premium: 2500 },
  cardigan: { low: 200, mid: 400, high: 700, premium: 1400 },
  sweater: { low: 200, mid: 400, high: 700, premium: 1400 },
  hoodie: { low: 200, mid: 400, high: 750, premium: 1500 },
  coat: { low: 500, mid: 900, high: 1500, premium: 3500 },
  // ─── Intimates & Sleepwear (ชุดชั้นในและชุดนอน) ───
  bra: { low: 80, mid: 180, high: 350, premium: 800 },
  underwear: { low: 50, mid: 120, high: 250, premium: 500 },
  shapewear: { low: 150, mid: 350, high: 600, premium: 1200 },
  sleepwear: { low: 120, mid: 280, high: 500, premium: 1000 },
  // ─── Activewear (ชุดกีฬา) ───
  sports_bra: { low: 100, mid: 250, high: 500, premium: 1000 },
  yoga_pants: { low: 150, mid: 350, high: 700, premium: 1400 },
  running_set: { low: 150, mid: 350, high: 650, premium: 1300 },
  // ─── Swimwear (ชุดว่ายน้ำ) ───
  bikini: { low: 150, mid: 350, high: 600, premium: 1200 },
  one_piece_swim: { low: 180, mid: 400, high: 700, premium: 1400 },
  two_piece_swim: { low: 150, mid: 350, high: 600, premium: 1200 },
  beachwear: { low: 120, mid: 280, high: 500, premium: 1000 },
  // ─── Accessories ───
  bag: { low: 250, mid: 600, high: 1200, premium: 3000 },
  unknown: { low: 150, mid: 300, high: 550, premium: 1000 },
};

// Brand tiers: low (no brand/budget), mid (fast fashion), high (mid-premium), premium (luxury/designer)
const BRAND_TIERS: Record<string, string> = {
  // ─── No Brand / Budget ───
  "no brand": "low",
  "unknown": "mid",
  "cotton on": "low",
  "factorie": "low",
  "penshoppe": "low",
  "bench": "low",
  "giordano": "low",
  "bossini": "low",
  "baleno": "low",

  // ─── Fast Fashion / Mid-tier ───
  "uniqlo": "mid",
  "h&m": "mid",
  "gap": "mid",
  "muji": "mid",
  "pomelo": "mid",
  "converse": "mid",
  "vans": "mid",
  "pull&bear": "mid",
  "bershka": "mid",
  "stradivarius": "mid",
  "forever 21": "mid",
  "topshop": "mid",
  "topman": "mid",
  "asos": "mid",
  "monki": "mid",
  "cos": "mid",
  "& other stories": "high",
  "arket": "mid",
  "weekday": "mid",
  "esprit": "mid",
  "banana republic": "mid",
  "old navy": "low",
  "american eagle": "mid",
  "hollister": "mid",
  "abercrombie & fitch": "mid",

  // ─── Thai Brands ───
  "jaspal": "high",
  "cps chaps": "high",
  "cps": "high",
  "greyhound": "high",
  "sretsis": "premium",
  "disaya": "premium",
  "kloset": "high",
  "issue": "high",
  "flynow": "high",
  "theatre": "high",
  "asava": "premium",
  "tawn c.": "premium",
  "tawn c": "premium",
  "soda": "mid",
  "cc double o": "mid",
  "cc-oo": "mid",
  "gentlewoman": "high",
  "milin": "premium",
  "poem": "high",
  "senada": "high",
  "hooks": "mid",
  "carnival": "high",
  "esp": "mid",
  "lyn": "high",
  "charles & keith": "high",
  "naraya": "mid",
  "mahanakhon": "mid",
  "dry clean only": "high",
  "playhound": "high",
  "lyn around": "mid",
  "tango": "mid",
  "sabina": "mid",
  "nara camicie": "high",
  "club 21": "high",
  "mc jeans": "mid",
  "body glove": "mid",
  "arrow": "mid",
  "guy laroche": "high",
  "pierre cardin": "high",
  "aiiz": "low",
  "dapper": "mid",
  "lyn beauty": "mid",
  "labella": "mid",
  "patinya": "premium",
  "tube gallery": "high",
  "curated by c": "high",
  "hook's": "mid",
  "anya": "high",
  "vatanika": "premium",
  "pi'a": "high",
  "sirivannavari": "premium",

  // ─── K-Fashion Brands ───
  "stylenanda": "mid",
  "chuu": "mid",
  "ader error": "high",
  "adererror": "high",
  "gentle monster": "premium",
  "mardi mercredi": "high",
  "instantfunk": "mid",
  "kirsh": "mid",
  "nerdy": "mid",
  "fila korea": "mid",
  "covernat": "mid",
  "thisisneverthat": "high",
  "this is never that": "high",
  "wooyoungmi": "premium",
  "juun.j": "premium",
  "pushbutton": "high",
  "low classic": "high",
  "andersson bell": "high",
  "andersson": "high",
  "87mm": "mid",
  "8 seconds": "mid",
  "spao": "low",
  "topten": "low",
  "mixxo": "mid",
  "emis": "mid",
  "musinsa standard": "mid",
  "musinsa": "mid",
  "whatitisnt": "mid",
  "romantic crown": "mid",
  "sculptor": "mid",
  "liful": "mid",
  "graver": "mid",
  "5252 by oioi": "mid",
  "oioi": "mid",
  "acme de la vie": "mid",
  "adlv": "mid",
  "waikei": "mid",
  "kangol korea": "mid",
  "rolarola": "mid",
  "lucky chouette": "high",
  "kuho": "premium",
  "beyond closet": "high",
  "charm's": "mid",
  "open the door": "mid",
  "mahagrid": "mid",
  "groove rhyme": "mid",
  "iamnotahumanbeing": "mid",
  "inhab": "mid",
  "d-antidote": "high",
  "blindness": "high",
  "rocket x lunch": "high",
  "sjyp": "high",
  "hyein seo": "premium",
  "kimhekim": "premium",
  "miss gee collection": "high",
  "le17septembre": "high",
  "dunst": "high",
  "nohant": "high",

  // ─── Vintage / Thrift Brands ───
  "levi's vintage": "premium",
  "wrangler": "mid",
  "lee": "mid",
  "lee cooper": "mid",
  "pendleton": "high",
  "ll bean": "mid",
  "l.l. bean": "mid",
  "woolrich": "high",
  "filson": "premium",
  "red wing": "high",
  "schott": "premium",
  "barbour": "premium",
  "burberrys": "premium",
  "yves saint laurent": "premium",
  "christian dior": "premium",
  "courreges": "premium",
  "pierre balmain": "premium",
  "gianni versace": "premium",
  "versace vintage": "premium",
  "champion vintage": "high",
  "russell athletic": "mid",
  "starter": "mid",
  "mitchell & ness": "high",
  "fruit of the loom": "low",
  "hanes": "low",
  "anvil": "low",
  "jerzees": "low",
  "screen stars": "mid",
  "nike vintage": "high",
  "adidas vintage": "high",
  "polo sport": "high",
  "polo jeans": "mid",
  "nautica": "mid",
  "tommy jeans": "mid",
  "dkny": "mid",
  "guess vintage": "high",
  "fiorucci": "high",
  "kenzo vintage": "premium",
  "coogi": "high",
  "coogi australia": "high",
  "carlo colucci": "high",
  "versace sport": "high",
  "moschino jeans": "high",
  "iceberg": "high",
  "stone island vintage": "premium",
  "cp company vintage": "premium",
  "helmut lang": "premium",
  "raf simons": "premium",
  "number (n)ine": "premium",
  "undercover vintage": "premium",
  "hysteric glamour": "premium",
  "evisu": "high",
  "bape vintage": "premium",
  "stussy vintage": "high",
  "xlarge": "mid",
  "x-large": "mid",
  "fubu": "mid",
  "karl kani": "mid",
  "cross colours": "mid",
  "pelle pelle": "mid",
  "rocawear": "low",
  "ecko": "low",
  "sean john": "low",
  "akademiks": "low",
  "enyce": "low",
  "harley davidson": "mid",
  "levi's orange tab": "high",
  "big e levi's": "premium",
  "lvc": "premium",

  // ─── Sports Brands ───
  "under armour": "high",
  "mizuno": "mid",
  "asics": "high",
  "saucony": "high",
  "brooks": "mid",
  "hoka": "high",
  "on running": "high",
  "on": "high",
  "salomon": "high",
  "arc'teryx": "premium",
  "arcteryx": "premium",
  "mammut": "premium",
  "marmot": "high",
  "mountain hardwear": "high",
  "black diamond": "high",
  "osprey": "high",
  "gregory": "high",
  "deuter": "mid",
  "lululemon": "high",
  "athleta": "mid",
  "gymshark": "mid",
  "alo yoga": "high",
  "vuori": "high",
  "outdoor voices": "mid",
  "sweaty betty": "high",
  "2xu": "mid",
  "pearl izumi": "mid",
  "castelli": "high",
  "rapha": "premium",
  "le col": "high",
  "pas normal studios": "premium",
  "maap": "high",
  "yonex": "mid",
  "wilson": "mid",
  "head": "mid",
  "babolat": "mid",
  "prince": "mid",
  "callaway": "mid",
  "titleist": "high",
  "taylormade": "mid",
  "footjoy": "mid",
  "oakley": "high",
  "speedo": "mid",
  "arena": "mid",
  "tyr": "mid",
  "descente": "high",
  "goldwin": "premium",
  "norrona": "premium",
  "peak performance": "high",
  "haglofs": "high",
  "rab": "high",
  "montbell": "mid",
  "snow peak": "high",
  "and wander": "premium",
  "white mountaineering": "premium",
  "nike acg": "high",
  "adidas terrex": "high",
  "jordan brand": "high",
  "air jordan": "high",

  // ─── Mid-Premium / International ───
  "zara": "high",
  "mango": "high",
  "levi's": "high",
  "levis": "high",
  "puma": "high",
  "reebok": "mid",
  "new balance": "high",
  "tommy hilfiger": "high",
  "calvin klein": "high",
  "guess": "high",
  "lacoste": "high",
  "fred perry": "high",
  "the north face": "high",
  "patagonia": "high",
  "columbia": "high",
  "carhartt": "high",
  "carhartt wip": "high",
  "dickies": "mid",
  "timberland": "high",
  "dr. martens": "high",
  "dr martens": "high",
  "birkenstock": "high",
  "fjallraven": "high",
  "herschel": "mid",
  "jansport": "mid",
  "fila": "mid",
  "champion": "mid",
  "kappa": "mid",
  "ellesse": "mid",
  "umbro": "mid",
  "diadora": "mid",
  "skechers": "mid",
  "crocs": "mid",

  // ─── Streetwear / Hype ───
  "supreme": "premium",
  "stussy": "premium",
  "stüssy": "premium",
  "off-white": "premium",
  "off white": "premium",
  "bape": "premium",
  "a bathing ape": "premium",
  "palace": "premium",
  "fear of god": "premium",
  "essentials": "high",
  "fog essentials": "high",
  "kith": "premium",
  "human made": "premium",
  "neighborhood": "premium",
  "wtaps": "premium",
  "undercover": "premium",
  "comme des garcons": "premium",
  "cdg": "premium",
  "comme des garçons": "premium",
  "visvim": "premium",
  "kapital": "premium",
  "needles": "premium",
  "stone island": "premium",
  "cp company": "premium",
  "acne studios": "premium",
  "ami paris": "premium",
  "maison kitsune": "premium",
  "thom browne": "premium",
  "sacai": "premium",
  "issey miyake": "premium",
  "yohji yamamoto": "premium",
  "rick owens": "premium",
  "vetements": "premium",
  "ambush": "premium",
  "mastermind": "premium",
  "anti social social club": "high",
  "assc": "high",
  "golf wang": "high",
  "brain dead": "high",
  "noah": "high",
  "aime leon dore": "premium",
  "ald": "premium",
  "jordan": "high",
  "yeezy": "premium",
  "travis scott": "premium",
  "dunk": "high",

  // ─── Premium / Accessible Luxury ───
  "coach": "premium",
  "michael kors": "premium",
  "kate spade": "premium",
  "ralph lauren": "premium",
  "polo ralph lauren": "premium",
  "marc jacobs": "premium",
  "tory burch": "premium",
  "furla": "premium",
  "longchamp": "premium",
  "mcm": "premium",
  "ted baker": "premium",
  "all saints": "high",
  "allsaints": "high",
  "sandro": "premium",
  "maje": "premium",
  "claudie pierlot": "premium",
  "theory": "premium",
  "vince": "premium",
  "equipment": "premium",
  "reiss": "high",
  "massimo dutti": "high",
  "hugo boss": "premium",
  "boss": "premium",
  "armani exchange": "high",
  "emporio armani": "premium",
  "versace jeans": "high",
  "moschino": "premium",
  "kenzo": "premium",
  "diesel": "high",
  "dsquared2": "premium",
  "vivienne westwood": "premium",
  "alexander mcqueen": "premium",
  "burberry": "premium",
  "gucci": "premium",
  "louis vuitton": "premium",
  "lv": "premium",
  "prada": "premium",
  "dior": "premium",
  "chanel": "premium",
  "hermes": "premium",
  "hermès": "premium",
  "balenciaga": "premium",
  "bottega veneta": "premium",
  "saint laurent": "premium",
  "ysl": "premium",
  "celine": "premium",
  "loewe": "premium",
  "valentino": "premium",
  "fendi": "premium",
  "givenchy": "premium",
  "miu miu": "premium",
  "versace": "premium",
  "dolce & gabbana": "premium",
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
  none: 1.00,
  minor: 0.88,
  medium: 0.70,
  major: 0.50,
};

// Market uplift — bumps every estimate up because real Thai resale prices for
// good-condition women's fashion run higher than the strict rule output.
// Tune this single number (1.0 = no change, 1.2 = +20%).
const MARKET_UPLIFT = 1.20;

const SIZE_DEMAND_SCORE: Record<string, number> = {
  xs: 66, s: 78, m: 84, l: 80, xl: 72, xxl: 64, "free size": 76, unknown: 65,
};

const CATEGORY_DEMAND_SCORE: Record<string, number> = {
  t_shirt: 78, shirt: 74, blouse: 76, dress: 72, pants: 70, skirt: 68, jacket: 62, bag: 74, unknown: 60,
};

// ─── Types ───

export interface UserInput {
  brand: string;
  size: string;
  condition: string;
  defectLevel: string;
  sellGoal: string;
  originalPrice?: number;
  defectDescription?: string;
  category: string;
}

export interface MarketDataSource {
  source: string;
  productName: string;
  retailPriceTHB: number | null;
  resalePriceTHB: number | null;
  thaiMarketEstimate: {
    min: number;
    max: number;
    recommended: number;
  } | null;
  internationalEstimate?: {
    min: number;
    max: number;
    recommended: number;
    currency: string;
  } | null;
}

export interface MarketData {
  found: boolean;
  sources: MarketDataSource[];
  bestEstimate: {
    min: number;
    max: number;
    recommended: number;
    confidence: number;
  } | null;
  // ราคาสำหรับขายต่างประเทศ (eBay/Amazon)
  internationalEstimate?: {
    min: number;
    max: number;
    recommended: number;
    currency: string;
    confidence: number;
  } | null;
  searchQuery: string;
}

export interface PricingResult {
  // Product info (for linking to listing page)
  brand?: string;
  category?: string;
  size?: string;
  condition?: string;
  color?: string;
  style?: string;
  marketMin: number;
  marketMax: number;
  fastSalePrice: number;
  recommendedPrice: number;
  highValuePrice: number;
  selectedPrice: number;
  estimatedDays: string;
  sellabilityScore: number;
  confidenceScore: number;
  explanation: string;
  factors: PricingFactor[];
  marketData?: MarketData;
  priceRange?: {
    low: number;
    mid: number;
    high: number;
  };
  consensusData?: {
    confidence: number;
    consensusLevel: "unanimous" | "majority" | "debated";
    agentCount: number;
    debateLog?: string;
    agentResults?: Array<{
      agent: "gemini" | "gpt4o" | "claude";
      category: string;
      brand: string;
      condition: string;
      estimatedResalePrice: number;
      estimatedResalePriceUSD: number;
      confidence: number;
      reasoning: string;
    }>;
  };
  blendInfo?: {
    ruleBasedPrice: number;
    aiPrice: number;
    aiWeight: number; // 0-1, how much AI influenced the final price
    ruleWeight: number; // 0-1, how much rule-based influenced
    finalPrice: number;
    reason: string; // e.g. "AI ให้ราคาต่ำกว่า threshold → ถ่วงน้ำหนัก rule-based มากขึ้น"
  };
  manualOverridePrice?: number; // user-set override price
}

export interface PricingFactor {
  name: string;
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
  weight: number;
}

// ─── Helpers ───

function normalize(value: string | undefined): string {
  return (value || "unknown").trim().toLowerCase();
}

function roundPrice(value: number): number {
  if (value < 100) return Math.max(29, Math.round(value / 10) * 10 - 1);
  if (value < 500) return Math.round(value / 10) * 10 - 1;
  return Math.round(value / 50) * 50 - 1;
}

function estimateBrandTier(brand: string): string {
  return BRAND_TIERS[normalize(brand)] || "mid";
}

function conditionScore(condition: string): number {
  const scores: Record<string, number> = {
    new_with_tag: 96, like_new: 88, excellent: 82, good: 76, fair: 58, poor: 42, defective: 38,
  };
  return scores[normalize(condition)] || 65;
}

function brandScore(brand: string): number {
  const tier = estimateBrandTier(brand);
  return { low: 58, mid: 72, high: 86 }[tier] || 68;
}

function priceScore(selectedPrice: number, recommendedPrice: number): number {
  if (recommendedPrice <= 0) return 60;
  const ratio = selectedPrice / recommendedPrice;
  if (ratio <= 0.85) return 94;
  if (ratio <= 1.00) return 84;
  if (ratio <= 1.15) return 70;
  if (ratio <= 1.30) return 56;
  return 40;
}

function daysFromScore(score: number): string {
  if (score >= 85) return "3–7 วัน";
  if (score >= 70) return "7–14 วัน";
  if (score >= 50) return "15–30 วัน";
  return "มากกว่า 30 วัน";
}

/**
 * Given a price the user wants to set vs the recommended price, estimate how
 * fast it will sell + a plain-language difficulty. Used by the "set your own
 * price" input so users see the trade-off live.
 */
export function estimateSaleFromPrice(
  price: number,
  recommendedPrice: number,
): { score: number; days: string; difficulty: string } {
  const score = priceScore(price, recommendedPrice);
  const difficulty =
    score >= 85 ? "ขายง่ายมาก" : score >= 70 ? "ขายง่าย" : score >= 50 ? "พอขายได้" : "ขายยาก";
  return { score, days: daysFromScore(score), difficulty };
}

// ─── Main Evaluation ───

export function evaluateItem(input: UserInput): PricingResult {
  const category = CATEGORY_BASE_PRICE[normalize(input.category)] ? normalize(input.category) : "unknown";
  const brandTier = estimateBrandTier(input.brand);
  const basePrice = CATEGORY_BASE_PRICE[category][brandTier as "low" | "mid" | "high" | "premium"] || CATEGORY_BASE_PRICE[category].mid;

  const condKey = normalize(input.condition);
  const defKey = normalize(input.defectLevel);

  const condMultiplier = CONDITION_MULTIPLIER[condKey] || 0.58;
  const defMultiplier = DEFECT_MULTIPLIER[defKey] || 0.85;

  let adjustedPrice = basePrice * condMultiplier * defMultiplier * MARKET_UPLIFT;

  if (input.originalPrice && input.originalPrice > 0) {
    const resaleCeiling = input.originalPrice * 0.62;
    adjustedPrice = Math.min(adjustedPrice, resaleCeiling);
  }

  const fastSalePrice = roundPrice(adjustedPrice * 0.82);
  const recommendedPrice = roundPrice(adjustedPrice);
  const highValuePrice = roundPrice(adjustedPrice * 1.20);

  const marketMin = Math.max(29, roundPrice(adjustedPrice * 0.75));
  const marketMax = Math.max(marketMin, roundPrice(adjustedPrice * 1.25));

  const sellGoal = normalize(input.sellGoal);
  let selectedPrice: number;
  if (["fast", "fast_sale"].includes(sellGoal)) {
    selectedPrice = fastSalePrice;
  } else if (["high_value"].includes(sellGoal)) {
    selectedPrice = highValuePrice;
  } else {
    selectedPrice = recommendedPrice;
  }

  const imageQualityScore = 75; // default for demo

  const sellability = Math.round(
    priceScore(selectedPrice, recommendedPrice) * 0.30 +
    brandScore(input.brand) * 0.20 +
    conditionScore(input.condition) * 0.20 +
    (CATEGORY_DEMAND_SCORE[category] || 60) * 0.10 +
    (SIZE_DEMAND_SCORE[normalize(input.size)] || 65) * 0.10 +
    imageQualityScore * 0.10
  );

  const estimatedDays = daysFromScore(sellability);

  const confidence = Math.round(72 * 0.45 + imageQualityScore * 0.25 + 75 * 0.30);

  // Build factors breakdown
  const factors: PricingFactor[] = [
    {
      name: "brand",
      label: "แบรนด์",
      value: `${input.brand} (${brandTier === "high" ? "พรีเมียม" : brandTier === "mid" ? "กลาง" : "ทั่วไป"})`,
      impact: brandTier === "high" ? "positive" : brandTier === "mid" ? "neutral" : "negative",
      weight: 20,
    },
    {
      name: "condition",
      label: "สภาพสินค้า",
      value: condKey === "new_with_tag" ? "ใหม่ ป้ายติด" : condKey === "like_new" ? "เหมือนใหม่" : condKey === "good" ? "ดี" : condKey === "fair" ? "พอใช้" : "มีตำหนิ",
      impact: condMultiplier >= 0.95 ? "positive" : condMultiplier >= 0.70 ? "neutral" : "negative",
      weight: 20,
    },
    {
      name: "defect",
      label: "ระดับตำหนิ",
      value: defKey === "none" ? "ไม่มี" : defKey === "minor" ? "เล็กน้อย" : defKey === "medium" ? "ปานกลาง" : "มาก",
      impact: defMultiplier >= 0.88 ? "positive" : defMultiplier >= 0.70 ? "neutral" : "negative",
      weight: 15,
    },
    {
      name: "category",
      label: "ประเภทสินค้า",
      value: {
        t_shirt: "เสื้อยืด", shirt: "เสื้อเชิ้ต", blouse: "เสื้อผู้หญิง", dress: "เดรส",
        pants: "กางเกง", skirt: "กระโปรง", jacket: "แจ็คเก็ต", bag: "กระเป๋า", unknown: "อื่น ๆ",
      }[category] || "อื่น ๆ",
      impact: (CATEGORY_DEMAND_SCORE[category] || 60) >= 74 ? "positive" : "neutral",
      weight: 10,
    },
    {
      name: "size",
      label: "ไซซ์",
      value: input.size.toUpperCase(),
      impact: (SIZE_DEMAND_SCORE[normalize(input.size)] || 65) >= 78 ? "positive" : "neutral",
      weight: 10,
    },
  ];

  const categoryLabel = {
    t_shirt: "เสื้อยืด", shirt: "เสื้อเชิ้ต", blouse: "เสื้อผู้หญิง", dress: "เดรส",
    pants: "กางเกง", skirt: "กระโปรง", jacket: "แจ็คเก็ต", bag: "กระเป๋า", unknown: "สินค้า",
  }[category] || "สินค้า";

  const explanation =
    `ระบบประเมินจากประเภท "${categoryLabel}", แบรนด์ "${input.brand}", ` +
    `ไซซ์ "${input.size.toUpperCase()}", สภาพ "${factors[1].value}", ` +
    `ระดับตำหนิ "${factors[2].value}" ` +
    `จึงแนะนำราคาหลักที่ ${recommendedPrice} บาท ` +
    `คาดว่ามีโอกาสขายออกในช่วง ${estimatedDays}`;

  return {
    marketMin,
    marketMax,
    fastSalePrice,
    recommendedPrice,
    highValuePrice,
    selectedPrice,
    estimatedDays,
    sellabilityScore: sellability,
    confidenceScore: confidence,
    explanation,
    factors,
  };
}

// ─── Evaluate with Market Data ───

/**
 * ประเมินราคาโดยรวมข้อมูลราคาตลาดจริงจาก Retailed.io
 * ถ้ามี market data จะปรับราคาโดยใช้ weighted average ระหว่าง rule-based กับ market
 */
export function evaluateItemWithMarket(input: UserInput, marketData?: MarketData): PricingResult {
  const baseResult = evaluateItem(input);

  if (!marketData || !marketData.found || !marketData.bestEstimate) {
    return { ...baseResult, marketData };
  }

  const market = marketData.bestEstimate;
  const marketConfidence = market.confidence / 100; // 0-1
  const ruleWeight = 1 - marketConfidence * 0.6; // market gets up to 60% weight
  const marketWeight = 1 - ruleWeight;

  // Blend rule-based and market prices
  const blendedRec = Math.round(
    baseResult.recommendedPrice * ruleWeight + market.recommended * marketWeight
  );
  const blendedMin = Math.round(
    baseResult.marketMin * ruleWeight + market.min * marketWeight
  );
  const blendedMax = Math.round(
    baseResult.marketMax * ruleWeight + market.max * marketWeight
  );

  const recommendedPrice = roundPrice(blendedRec);
  const fastSalePrice = roundPrice(blendedRec * 0.82);
  const highValuePrice = roundPrice(blendedRec * 1.20);
  const marketMin = Math.max(29, roundPrice(blendedMin));
  const marketMax = Math.max(marketMin, roundPrice(blendedMax));

  const sellGoal = normalize(input.sellGoal);
  let selectedPrice: number;
  if (["fast", "fast_sale"].includes(sellGoal)) {
    selectedPrice = fastSalePrice;
  } else if (["high_value"].includes(sellGoal)) {
    selectedPrice = highValuePrice;
  } else {
    selectedPrice = recommendedPrice;
  }

  // Boost confidence when market data is available
  const boostedConfidence = Math.min(95, baseResult.confidenceScore + Math.round(marketConfidence * 20));

  // Add market data factor
  const factors = [...baseResult.factors];
  factors.push({
    name: "market_data",
    label: "ราคาตลาดจริง",
    value: `อ้างอิง ${marketData.sources.length} แหล่ง (ความมั่นใจ ${market.confidence}%)`,
    impact: market.confidence >= 60 ? "positive" : "neutral",
    weight: 25,
  });

  const explanation =
    baseResult.explanation +
    ` โดยมีข้อมูลราคาตลาดจริงจาก ${marketData.sources.map(s => s.source).join("/")} มาช่วยปรับให้แม่นยำขึ้น`;

  return {
    marketMin,
    marketMax,
    fastSalePrice,
    recommendedPrice,
    highValuePrice,
    selectedPrice,
    estimatedDays: baseResult.estimatedDays,
    sellabilityScore: baseResult.sellabilityScore,
    confidenceScore: boostedConfidence,
    explanation,
    factors,
    marketData,
  };
}

// ─── AI Consensus Blend Logic ───

/**
 * Blend AI consensus price with rule-based price
 * AI gets less weight when its price deviates significantly from rule-based
 * Never allows final price to drop below 50% of rule-based
 */
export interface BlendInfo {
  ruleBasedPrice: number;
  aiPrice: number;
  aiWeight: number;
  ruleWeight: number;
  finalPrice: number;
  reason: string;
}

export function blendWithAIConsensus(
  rulePrice: number,
  aiPrice: number,
  confidence: number
): { recommended: number; fastSale: number; highValue: number; marketMin: number; marketMax: number; blendInfo: BlendInfo } {
  const deviation = Math.abs(aiPrice - rulePrice) / rulePrice;
  const aiConfidence = (confidence || 50) / 100; // 0-1

  // AI gets less weight when deviation is extreme
  // At 0% deviation: AI weight = confidence * 0.6 (max 60%)
  // At 100%+ deviation: AI weight drops significantly
  const deviationPenalty = Math.max(0.2, 1 - deviation * 0.8);
  const aiWeight = Math.min(0.6, aiConfidence * 0.6 * deviationPenalty);
  const ruleWeight = 1 - aiWeight;

  // Blend the prices
  const blendedRecommended = Math.round(rulePrice * ruleWeight + aiPrice * aiWeight);

  // Sanity check: never below 50% of rule-based price
  const recommended = Math.max(
    Math.round(rulePrice * 0.5),
    blendedRecommended
  );

  // Determine reason
  let reason: string;
  if (deviation < 0.15) {
    reason = `AI และ Rule-based ให้ราคาใกล้กัน → ใช้ AI ${Math.round(aiWeight * 100)}%`;
  } else if (aiPrice < rulePrice) {
    reason = `AI ให้ราคาต่ำกว่า (${Math.round(deviation * 100)}% deviation) → ถ่วงน้ำหนัก Rule-based ${Math.round(ruleWeight * 100)}%`;
  } else {
    reason = `AI ให้ราคาสูงกว่า (${Math.round(deviation * 100)}% deviation) → ถ่วงน้ำหนัก Rule-based ${Math.round(ruleWeight * 100)}%`;
  }

  const blendInfo: BlendInfo = {
    ruleBasedPrice: rulePrice,
    aiPrice,
    aiWeight,
    ruleWeight,
    finalPrice: recommended,
    reason,
  };

  const fastSale = Math.round(recommended * 0.82);
  const highValue = Math.round(recommended * 1.20);
  const marketMin = Math.max(29, Math.round(recommended * 0.75));
  const marketMax = Math.round(recommended * 1.25);

  return { recommended, fastSale, highValue, marketMin, marketMax, blendInfo };
}

// ─── Export constants for dropdowns ───

export const CATEGORY_GROUPS = [
  {
    group: "ท่อนบน (Tops)",
    items: [
      { value: "t_shirt", label: "เสื้อยืด" },
      { value: "shirt", label: "เสื้อเชิ้ต" },
      { value: "blouse", label: "เสื้อเบลาส์" },
      { value: "crop_top", label: "เสื้อครอป" },
      { value: "camisole", label: "สายเดี่ยว" },
      { value: "tank_top", label: "เสื้อกล้าม" },
    ],
  },
  {
    group: "ท่อนล่าง (Bottoms)",
    items: [
      { value: "jeans", label: "กางเกงยีนส์" },
      { value: "pants", label: "กางเกงขายาว/สแล็ค" },
      { value: "shorts", label: "กางเกงขาสั้น" },
      { value: "skirt", label: "กระโปรง" },
      { value: "leggings", label: "เลกกิ้ง" },
    ],
  },
  {
    group: "ชุดชิ้นเดียว (One-Piece)",
    items: [
      { value: "dress", label: "ชุดเดรส" },
      { value: "jumpsuit", label: "จั๊มป์สูท" },
      { value: "romper", label: "รอมเปอร์" },
    ],
  },
  {
    group: "เสื้อคลุม (Outerwear)",
    items: [
      { value: "blazer", label: "เบลเซอร์" },
      { value: "jacket", label: "แจ็คเก็ต" },
      { value: "cardigan", label: "คาร์ดิแกน" },
      { value: "sweater", label: "เสื้อกันหนาว" },
      { value: "hoodie", label: "ฮู้ดดี้" },
      { value: "coat", label: "เสื้อโค้ท" },
    ],
  },
  {
    group: "ชุดชั้นในและชุดนอน (Intimates)",
    items: [
      { value: "bra", label: "เสื้อชั้นใน" },
      { value: "underwear", label: "กางเกงใน" },
      { value: "shapewear", label: "ชุดกระชับสัดส่วน" },
      { value: "sleepwear", label: "ชุดนอน" },
    ],
  },
  {
    group: "ชุดกีฬา (Activewear)",
    items: [
      { value: "sports_bra", label: "สปอร์ตบรา" },
      { value: "yoga_pants", label: "กางเกงโยคะ" },
      { value: "running_set", label: "ชุดวิ่ง" },
    ],
  },
  {
    group: "ชุดว่ายน้ำ (Swimwear)",
    items: [
      { value: "bikini", label: "บิกินี่" },
      { value: "one_piece_swim", label: "วันพีซ" },
      { value: "two_piece_swim", label: "ทูพีซ" },
      { value: "beachwear", label: "ชุดคลุมเดินหาด" },
    ],
  },
  {
    group: "อื่นๆ (Accessories)",
    items: [
      { value: "bag", label: "กระเป๋า" },
    ],
  },
];

// Flat CATEGORIES array for backward compatibility
export const CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items);

export const BRANDS = [
  { value: "No Brand", label: "ไม่มีแบรนด์" },
  // Thai Brands
  { value: "Jaspal", label: "Jaspal" },
  { value: "CPS", label: "CPS Chaps" },
  { value: "Greyhound", label: "Greyhound" },
  { value: "Sretsis", label: "Sretsis" },
  { value: "Kloset", label: "Kloset" },
  { value: "Gentlewoman", label: "Gentlewoman" },
  { value: "Carnival", label: "Carnival" },
  { value: "Pomelo", label: "Pomelo" },
  { value: "Lyn", label: "Lyn" },
  // Fast Fashion
  { value: "Uniqlo", label: "Uniqlo" },
  { value: "H&M", label: "H&M" },
  { value: "Zara", label: "Zara" },
  { value: "Mango", label: "Mango" },
  { value: "GAP", label: "GAP" },
  { value: "Cotton On", label: "Cotton On" },
  { value: "Topshop", label: "Topshop" },
  { value: "Pull&Bear", label: "Pull&Bear" },
  { value: "Bershka", label: "Bershka" },
  // Sports & Casual
  { value: "Nike", label: "Nike" },
  { value: "Adidas", label: "Adidas" },
  { value: "New Balance", label: "New Balance" },
  { value: "Converse", label: "Converse" },
  { value: "Vans", label: "Vans" },
  { value: "Puma", label: "Puma" },
  { value: "The North Face", label: "The North Face" },
  { value: "Champion", label: "Champion" },
  // Mid-Premium
  { value: "Levi's", label: "Levi's" },
  { value: "Tommy Hilfiger", label: "Tommy Hilfiger" },
  { value: "Calvin Klein", label: "Calvin Klein" },
  { value: "Lacoste", label: "Lacoste" },
  { value: "Fred Perry", label: "Fred Perry" },
  { value: "Charles & Keith", label: "Charles & Keith" },
  { value: "Carhartt WIP", label: "Carhartt WIP" },
  { value: "Dr. Martens", label: "Dr. Martens" },
  // Streetwear
  { value: "Supreme", label: "Supreme" },
  { value: "Stussy", label: "Stüssy" },
  { value: "Off-White", label: "Off-White" },
  { value: "BAPE", label: "BAPE" },
  { value: "Palace", label: "Palace" },
  { value: "Essentials", label: "FOG Essentials" },
  { value: "Comme des Garcons", label: "Comme des Garçons" },
  // Premium / Luxury
  { value: "Coach", label: "Coach" },
  { value: "Michael Kors", label: "Michael Kors" },
  { value: "Kate Spade", label: "Kate Spade" },
  { value: "Ralph Lauren", label: "Ralph Lauren" },
  { value: "Marc Jacobs", label: "Marc Jacobs" },
  { value: "Longchamp", label: "Longchamp" },
  { value: "Gucci", label: "Gucci" },
  { value: "Louis Vuitton", label: "Louis Vuitton" },
  { value: "Burberry", label: "Burberry" },
  { value: "Prada", label: "Prada" },
  { value: "Balenciaga", label: "Balenciaga" },
  // Thai Brands (expanded)
  { value: "Playhound", label: "Playhound" },
  { value: "Tango", label: "Tango" },
  { value: "Sabina", label: "Sabina" },
  { value: "MC Jeans", label: "MC Jeans" },
  { value: "Body Glove", label: "Body Glove" },
  { value: "Guy Laroche", label: "Guy Laroche" },
  { value: "Pierre Cardin", label: "Pierre Cardin" },
  { value: "Dapper", label: "Dapper" },
  { value: "Patinya", label: "Patinya" },
  { value: "Tube Gallery", label: "Tube Gallery" },
  { value: "Vatanika", label: "Vatanika" },
  { value: "Asava", label: "Asava" },
  { value: "Disaya", label: "Disaya" },
  { value: "Milin", label: "Milin" },
  { value: "Flynow", label: "Flynow" },
  { value: "Theatre", label: "Theatre" },
  { value: "Senada", label: "Senada" },
  { value: "Poem", label: "Poem" },
  { value: "ESP", label: "ESP" },
  { value: "Hooks", label: "Hooks" },
  { value: "Anya", label: "Anya" },
  { value: "Naraya", label: "Naraya" },
  { value: "AIIZ", label: "AIIZ" },
  { value: "Tawn C.", label: "Tawn C." },
  { value: "Issue", label: "Issue" },
  { value: "CC Double O", label: "CC Double O" },
  // K-Fashion Brands
  { value: "Stylenanda", label: "Stylenanda" },
  { value: "Chuu", label: "Chuu" },
  { value: "Ader Error", label: "Ader Error" },
  { value: "Gentle Monster", label: "Gentle Monster" },
  { value: "Mardi Mercredi", label: "Mardi Mercredi" },
  { value: "Nerdy", label: "Nerdy" },
  { value: "Kirsh", label: "Kirsh" },
  { value: "Covernat", label: "Covernat" },
  { value: "Thisisneverthat", label: "thisisneverthat" },
  { value: "Andersson Bell", label: "Andersson Bell" },
  { value: "Low Classic", label: "Low Classic" },
  { value: "Wooyoungmi", label: "Wooyoungmi" },
  { value: "SPAO", label: "SPAO" },
  { value: "8 Seconds", label: "8 Seconds" },
  { value: "Emis", label: "Emis" },
  { value: "ADLV", label: "ADLV" },
  { value: "Oioi", label: "5252 by OiOi" },
  { value: "Musinsa Standard", label: "Musinsa Standard" },
  { value: "Romantic Crown", label: "Romantic Crown" },
  { value: "Sculptor", label: "Sculptor" },
  { value: "Mahagrid", label: "Mahagrid" },
  { value: "Instantfunk", label: "Instantfunk" },
  { value: "Lucky Chouette", label: "Lucky Chouette" },
  { value: "Pushbutton", label: "Pushbutton" },
  { value: "Hyein Seo", label: "Hyein Seo" },
  { value: "Kimhekim", label: "Kimhekim" },
  { value: "Dunst", label: "Dunst" },
  { value: "Nohant", label: "Nohant" },
  { value: "Kangol Korea", label: "Kangol Korea" },
  { value: "Rolarola", label: "Rolarola" },
  // Vintage / Thrift Brands
  { value: "Wrangler", label: "Wrangler" },
  { value: "Lee", label: "Lee" },
  { value: "Pendleton", label: "Pendleton" },
  { value: "LL Bean", label: "L.L. Bean" },
  { value: "Woolrich", label: "Woolrich" },
  { value: "Filson", label: "Filson" },
  { value: "Schott", label: "Schott" },
  { value: "Barbour", label: "Barbour" },
  { value: "Russell Athletic", label: "Russell Athletic" },
  { value: "Mitchell & Ness", label: "Mitchell & Ness" },
  { value: "Starter", label: "Starter" },
  { value: "Nautica", label: "Nautica" },
  { value: "Fiorucci", label: "Fiorucci" },
  { value: "Coogi", label: "Coogi" },
  { value: "Carlo Colucci", label: "Carlo Colucci" },
  { value: "Iceberg", label: "Iceberg" },
  { value: "Helmut Lang", label: "Helmut Lang" },
  { value: "Raf Simons", label: "Raf Simons" },
  { value: "Hysteric Glamour", label: "Hysteric Glamour" },
  { value: "Evisu", label: "Evisu" },
  { value: "XLarge", label: "X-Large" },
  { value: "Fubu", label: "FUBU" },
  { value: "Karl Kani", label: "Karl Kani" },
  { value: "Harley Davidson", label: "Harley Davidson" },
  // Sports Brands
  { value: "Under Armour", label: "Under Armour" },
  { value: "Mizuno", label: "Mizuno" },
  { value: "ASICS", label: "ASICS" },
  { value: "Saucony", label: "Saucony" },
  { value: "Hoka", label: "HOKA" },
  { value: "On Running", label: "On Running" },
  { value: "Salomon", label: "Salomon" },
  { value: "Lululemon", label: "Lululemon" },
  { value: "Gymshark", label: "Gymshark" },
  { value: "Alo Yoga", label: "Alo Yoga" },
  { value: "Vuori", label: "Vuori" },
  { value: "Rapha", label: "Rapha" },
  { value: "Descente", label: "Descente" },
  { value: "Goldwin", label: "Goldwin" },
  { value: "Oakley", label: "Oakley" },
  { value: "Yonex", label: "Yonex" },
  { value: "Mammut", label: "Mammut" },
  { value: "Marmot", label: "Marmot" },
  { value: "Osprey", label: "Osprey" },
  { value: "Snow Peak", label: "Snow Peak" },
  { value: "And Wander", label: "And Wander" },
  { value: "Montbell", label: "Montbell" },
  { value: "Haglofs", label: "Haglöfs" },
  { value: "Peak Performance", label: "Peak Performance" },
  { value: "Brooks", label: "Brooks" },
  { value: "Sweaty Betty", label: "Sweaty Betty" },
  { value: "Outdoor Voices", label: "Outdoor Voices" },
];

export const SIZES = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "Free Size", label: "Free Size" },
];

export const CONDITIONS = [
  { value: "new_with_tag", label: "ใหม่ ป้ายติด", desc: "ยังไม่ได้ใช้ มีป้ายราคาอยู่" },
  { value: "like_new", label: "เหมือนใหม่", desc: "ใส่ 1-2 ครั้ง ไม่มีร่องรอยการใช้งาน" },
  { value: "good", label: "สภาพดี", desc: "ใช้งานแล้วแต่ยังสวย ไม่มีตำหนิชัดเจน" },
  { value: "fair", label: "พอใช้", desc: "มีร่องรอยการใช้งาน เช่น สีซีดเล็กน้อย" },
  { value: "defective", label: "มีตำหนิ", desc: "มีตำหนิชัดเจน เช่น ขาด เปื้อน" },
];

export const DEFECT_LEVELS = [
  { value: "none", label: "ไม่มีตำหนิ" },
  { value: "minor", label: "เล็กน้อย" },
  { value: "medium", label: "ปานกลาง" },
  { value: "major", label: "มาก" },
];

export const SELL_GOALS = [
  { value: "fast", label: "ขายเร็ว", desc: "ตั้งราคาต่ำ ขายออกไว", icon: "⚡" },
  { value: "easy_to_sell", label: "ขายง่าย", desc: "ราคาเหมาะสม สมดุลดี", icon: "✓" },
  { value: "high_value", label: "ขายคุ้ม", desc: "ตั้งราคาสูง รอนานหน่อย", icon: "💎" },
];
