/**
 * Retailed.io API Integration
 *
 * ใช้ StockX + Goat endpoints เพื่อดึงราคา resale ตลาดจริง
 * แล้วปรับให้เหมาะกับตลาดมือสองในไทยด้วย discount matrix
 */

const RETAILED_BASE_URL = "https://app.retailed.io/api/v1";

function getApiKey(): string {
  const key = process.env.RETAILED_API_KEY ?? "";
  if (!key) {
    console.warn("[Retailed] API key not configured");
  }
  return key;
}

// ─── Discount Matrix: EU/US → Thai Market (มือสอง) ───
// ราคาตลาดมือสองไทยต่ำกว่าต่างประเทศมาก เพราะกำลังซื้อต่างกัน

const THAI_MARKET_DISCOUNT: Record<string, number> = {
  fast_fashion: 0.14, // Uniqlo, H&M, Zara → เหลือ 14% ของราคา resale ต่างประเทศ (เสื้อ $25 → ~125 THB)
  mid_range: 0.22, // Levi's, CK, Polo → เหลือ 22% (เสื้อ $40 → ~310 THB)
  premium: 0.30, // Lacoste, Tommy → เหลือ 30% (เสื้อ $60 → ~640 THB)
  luxury: 0.55, // Gucci, LV → เหลือ 55% (กระเป๋า $500 → ~9,700 THB)
  streetwear: 0.40, // Supreme, BAPE → เหลือ 40% (เสื้อ $80 → ~1,136 THB)
  sport: 0.18, // Nike, Adidas → เหลือ 18% (เสื้อ $35 → ~225 THB)
};

// ─── International Pricing (สำหรับ eBay/Amazon ในอนาคต) ───
// ราคา resale ต่างประเทศ ลดเล็กน้อยจาก market price เพื่อแข่งขันได้

const INTERNATIONAL_DISCOUNT: Record<string, number> = {
  fast_fashion: 0.75, // ลด 25% จากราคา resale
  mid_range: 0.80, // ลด 20%
  premium: 0.82, // ลด 18%
  luxury: 0.88, // ลด 12%
  streetwear: 0.85, // ลด 15%
  sport: 0.78, // ลด 22%
};

const BRAND_TO_TIER: Record<string, string> = {
  // Fast Fashion
  uniqlo: "fast_fashion",
  "h&m": "fast_fashion",
  zara: "fast_fashion",
  "forever 21": "fast_fashion",
  mango: "fast_fashion",
  "cotton on": "fast_fashion",
  gap: "fast_fashion",
  bershka: "fast_fashion",
  "pull&bear": "fast_fashion",
  stradivarius: "fast_fashion",
  topshop: "fast_fashion",
  asos: "fast_fashion",
  pomelo: "fast_fashion",
  spao: "fast_fashion",
  "8 seconds": "fast_fashion",
  aiiz: "fast_fashion",
  // Mid Range
  "levi's": "mid_range",
  levis: "mid_range",
  "calvin klein": "mid_range",
  "ralph lauren": "mid_range",
  polo: "mid_range",
  tommy: "mid_range",
  "tommy hilfiger": "mid_range",
  "hugo boss": "mid_range",
  diesel: "mid_range",
  guess: "mid_range",
  "massimo dutti": "mid_range",
  reiss: "mid_range",
  // Thai Brands
  jaspal: "mid_range",
  cps: "mid_range",
  "cps chaps": "mid_range",
  greyhound: "mid_range",
  kloset: "mid_range",
  gentlewoman: "mid_range",
  carnival: "mid_range",
  playhound: "mid_range",
  "guy laroche": "mid_range",
  "pierre cardin": "mid_range",
  dapper: "mid_range",
  "mc jeans": "fast_fashion",
  "body glove": "fast_fashion",
  esp: "fast_fashion",
  hooks: "fast_fashion",
  naraya: "fast_fashion",
  // Thai Premium
  sretsis: "premium",
  disaya: "premium",
  asava: "premium",
  milin: "premium",
  vatanika: "premium",
  patinya: "premium",
  "tawn c.": "premium",
  "tawn c": "premium",
  flynow: "mid_range",
  theatre: "mid_range",
  issue: "mid_range",
  // Premium
  lacoste: "premium",
  "fred perry": "premium",
  coach: "premium",
  "michael kors": "premium",
  "kate spade": "premium",
  "marc jacobs": "premium",
  "tory burch": "premium",
  longchamp: "premium",
  mcm: "premium",
  sandro: "premium",
  maje: "premium",
  "acne studios": "premium",
  "ami paris": "premium",
  kenzo: "premium",
  // Luxury
  gucci: "luxury",
  "louis vuitton": "luxury",
  chanel: "luxury",
  prada: "luxury",
  dior: "luxury",
  balenciaga: "luxury",
  "bottega veneta": "luxury",
  "saint laurent": "luxury",
  celine: "luxury",
  loewe: "luxury",
  valentino: "luxury",
  fendi: "luxury",
  givenchy: "luxury",
  hermes: "luxury",
  "miu miu": "luxury",
  versace: "luxury",
  burberry: "luxury",
  // Streetwear
  supreme: "streetwear",
  bape: "streetwear",
  "off-white": "streetwear",
  stussy: "streetwear",
  palace: "streetwear",
  kith: "streetwear",
  "fear of god": "streetwear",
  essentials: "streetwear",
  "comme des garcons": "streetwear",
  cdg: "streetwear",
  "stone island": "streetwear",
  "cp company": "streetwear",
  neighborhood: "streetwear",
  wtaps: "streetwear",
  undercover: "streetwear",
  visvim: "streetwear",
  kapital: "streetwear",
  needles: "streetwear",
  "thom browne": "streetwear",
  sacai: "streetwear",
  "issey miyake": "streetwear",
  "rick owens": "streetwear",
  "human made": "streetwear",
  "anti social social club": "streetwear",
  "golf wang": "streetwear",
  "aime leon dore": "streetwear",
  yeezy: "streetwear",
  // K-Fashion
  "ader error": "mid_range",
  "gentle monster": "premium",
  "mardi mercredi": "mid_range",
  thisisneverthat: "mid_range",
  "andersson bell": "mid_range",
  "low classic": "mid_range",
  wooyoungmi: "premium",
  "juun.j": "premium",
  pushbutton: "mid_range",
  stylenanda: "fast_fashion",
  chuu: "fast_fashion",
  nerdy: "fast_fashion",
  covernat: "fast_fashion",
  emis: "fast_fashion",
  adlv: "fast_fashion",
  "hyein seo": "premium",
  kimhekim: "premium",
  // Vintage / Thrift
  wrangler: "mid_range",
  lee: "mid_range",
  pendleton: "mid_range",
  "ll bean": "mid_range",
  woolrich: "mid_range",
  filson: "premium",
  schott: "premium",
  barbour: "premium",
  "helmut lang": "streetwear",
  "raf simons": "streetwear",
  evisu: "streetwear",
  "hysteric glamour": "streetwear",
  coogi: "streetwear",
  "mitchell & ness": "mid_range",
  nautica: "mid_range",
  fiorucci: "mid_range",
  // Sports
  nike: "sport",
  adidas: "sport",
  "new balance": "sport",
  puma: "sport",
  converse: "sport",
  "under armour": "sport",
  mizuno: "sport",
  asics: "sport",
  saucony: "sport",
  hoka: "sport",
  "on running": "sport",
  salomon: "sport",
  lululemon: "sport",
  gymshark: "sport",
  "alo yoga": "sport",
  vuori: "sport",
  rapha: "sport",
  descente: "sport",
  goldwin: "sport",
  oakley: "sport",
  "the north face": "sport",
  patagonia: "sport",
  columbia: "sport",
  "arc'teryx": "sport",
  mammut: "sport",
  marmot: "sport",
  osprey: "sport",
  "snow peak": "sport",
  "and wander": "sport",
  montbell: "sport",
  haglofs: "sport",
  "peak performance": "sport",
};

// ─── Types ───

export interface RetailedSearchResult {
  id: string;
  name: string;
  slug: string;
  brand: string;
  image: string;
  category: string;
  colorway?: string;
}

export interface RetailedPriceData {
  source: "stockx" | "goat" | "vestiaire" | "depop" | "mercari";
  retailPrice: number | null;
  lowestAsk: number | null;
  highestBid: number | null;
  lastSale: number | null;
  currency: string;
  productName: string;
  brand: string;
  // Converted to THB
  retailPriceTHB: number | null;
  resalePriceTHB: number | null;
  // ราคาสำหรับตลาดมือสองไทย
  thaiMarketEstimate: {
    min: number;
    max: number;
    recommended: number;
  } | null;
  // ราคาสำหรับขายต่างประเทศ (eBay/Amazon)
  internationalEstimate: {
    min: number;
    max: number;
    recommended: number;
    currency: string;
  } | null;
}

export interface MarketPriceResult {
  found: boolean;
  sources: RetailedPriceData[];
  bestEstimate: {
    min: number;
    max: number;
    recommended: number;
    confidence: number;
  } | null;
  // ราคาสำหรับขายต่างประเทศ (eBay/Amazon)
  internationalEstimate: {
    min: number;
    max: number;
    recommended: number;
    currency: string;
    confidence: number;
  } | null;
  searchQuery: string;
}

// ─── Collab Detection ───

const COLLAB_KEYWORDS = [" x ", "collaboration", "collab", "limited edition", "special edition"];
const COLLAB_BRANDS = ["kaws", "supreme", "off-white", "bape", "stussy", "palace", "travis scott", "fragment"];

/**
 * ตรวจจับว่าสินค้าเป็น collab/limited edition หรือไม่
 * ถ้าใช่ → ใช้ streetwear tier (ราคาสูงกว่า fast fashion ทั่วไป)
 */
export function detectCollab(productName: string, brand: string): boolean {
  const name = productName.toLowerCase();
  const brandLower = brand.toLowerCase();

  // Check for " x " pattern (brand x brand)
  if (COLLAB_KEYWORDS.some(kw => name.includes(kw))) return true;

  // Check if product mentions a known collab brand
  if (COLLAB_BRANDS.some(cb => name.includes(cb) && cb !== brandLower)) return true;

  return false;
}

// ─── Currency Conversion ───

const USD_TO_THB = 35.5; // Approximate rate, could be fetched dynamically

function usdToThb(usd: number): number {
  return Math.round(usd * USD_TO_THB);
}

// ─── API Calls ───

async function fetchRetailed(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${RETAILED_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[Retailed] ${endpoint} returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[Retailed] fetch error: ${error.message}`);
    return null;
  }
}

/**
 * ค้นหาสินค้าจาก StockX
 */
export async function searchStockX(query: string): Promise<RetailedSearchResult[]> {
  const data = await fetchRetailed("/scraper/stockx/search", { query });
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 5).map((item: any) => ({
    id: item.id || item.slug,
    name: item.name,
    slug: item.slug,
    brand: item.brand || "",
    image: item.image || "",
    category: item.category || "apparel",
    colorway: item.colorway,
  }));
}

/**
 * ดึงราคาจาก StockX product
 */
export async function getStockXPrice(slug: string): Promise<RetailedPriceData | null> {
  const data = await fetchRetailed("/scraper/stockx/product", { query: slug });
  if (!data || !data.market) return null;

  const retailPriceStr = data.traits?.find((t: any) => t.name === "Retail Price")?.value;
  const retailPrice = retailPriceStr ? parseFloat(retailPriceStr) : null;
  const lowestAsk = data.market?.bids?.lowest_ask ?? null;
  const highestBid = data.market?.bids?.highest_bid ?? null;
  const lastSale = data.market?.sales?.last_sale ?? null;

  // Calculate Thai market estimate
  const brandNorm = (data.brand || "").toLowerCase();
  const productName = (data.name || "").toLowerCase();
  // Collab detection: ถ้าชื่อสินค้ามี " x " หรือ collab keywords → ใช้ streetwear tier
  const isCollab = detectCollab(productName, brandNorm);
  const tier = isCollab ? "streetwear" : (BRAND_TO_TIER[brandNorm] || "mid_range");
  const thaiDiscount = THAI_MARKET_DISCOUNT[tier] || 0.22;
  const intlDiscount = INTERNATIONAL_DISCOUNT[tier] || 0.80;

  const resaleUSD = lastSale || lowestAsk || highestBid;
  const resalePriceTHB = resaleUSD ? usdToThb(resaleUSD) : null;
  const retailPriceTHB = retailPrice ? usdToThb(retailPrice) : null;

  let thaiMarketEstimate = null;
  let internationalEstimate = null;
  if (resalePriceTHB && resaleUSD) {
    // Thai market: ลดเยอะมากเพราะกำลังซื้อต่างกัน
    const thaiBase = resalePriceTHB * thaiDiscount;
    thaiMarketEstimate = {
      min: Math.round(thaiBase * 0.80),
      max: Math.round(thaiBase * 1.25),
      recommended: Math.round(thaiBase),
    };
    // International: ราคาสำหรับ eBay/Amazon (เก็บเป็น USD)
    const intlBase = resaleUSD * intlDiscount;
    internationalEstimate = {
      min: Math.round(intlBase * 0.85 * 100) / 100,
      max: Math.round(intlBase * 1.10 * 100) / 100,
      recommended: Math.round(intlBase * 100) / 100,
      currency: "USD",
    };
  }

  return {
    source: "stockx",
    retailPrice,
    lowestAsk,
    highestBid,
    lastSale,
    currency: "USD",
    productName: data.name || "",
    brand: data.brand || "",
    retailPriceTHB,
    resalePriceTHB,
    thaiMarketEstimate,
    internationalEstimate,
  };
}

/**
 * ค้นหาสินค้าจาก Goat
 */
export async function searchGoat(query: string): Promise<RetailedSearchResult[]> {
  const data = await fetchRetailed("/scraper/goat/search", { query });
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 5).map((item: any) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    brand: item.brand || "",
    image: item.image || "",
    category: item.category || "apparel",
  }));
}

/**
 * ดึงราคาจาก Goat prices
 */
export async function getGoatPrices(productId: string, brand?: string, productName?: string): Promise<RetailedPriceData | null> {
  const data = await fetchRetailed("/scraper/goat/prices", { query: productId });
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  // หาราคาต่ำสุดจากทุกไซซ์
  let lowestPrice: number | null = null;
  let lastSoldPrice: number | null = null;

  for (const variant of data) {
    const lowest = variant.lowestPriceCents?.amountUsdCents;
    const lastSold = variant.lastSoldPriceCents?.amountUsdCents;

    if (lowest && (lowestPrice === null || lowest < lowestPrice)) {
      lowestPrice = lowest;
    }
    if (lastSold && (lastSoldPrice === null || lastSold < lastSoldPrice)) {
      lastSoldPrice = lastSold;
    }
  }

  // Goat prices are in cents
  const lowestAsk = lowestPrice ? lowestPrice / 100 : null;
  const lastSale = lastSoldPrice ? lastSoldPrice / 100 : null;

  const brandNorm = (brand || "").toLowerCase();
  const goatProductName = (productName || "").toLowerCase();
  const isCollab = detectCollab(goatProductName, brandNorm);
  const tier = isCollab ? "streetwear" : (BRAND_TO_TIER[brandNorm] || "mid_range");
  const thaiDiscount = THAI_MARKET_DISCOUNT[tier] || 0.22;
  const intlDiscount = INTERNATIONAL_DISCOUNT[tier] || 0.80;

  const resaleUSD = lastSale || lowestAsk;
  const resalePriceTHB = resaleUSD ? usdToThb(resaleUSD) : null;

  let thaiMarketEstimate = null;
  let internationalEstimate = null;
  if (resalePriceTHB && resaleUSD) {
    // Thai market
    const thaiBase = resalePriceTHB * thaiDiscount;
    thaiMarketEstimate = {
      min: Math.round(thaiBase * 0.80),
      max: Math.round(thaiBase * 1.25),
      recommended: Math.round(thaiBase),
    };
    // International (eBay/Amazon)
    const intlBase = resaleUSD * intlDiscount;
    internationalEstimate = {
      min: Math.round(intlBase * 0.85 * 100) / 100,
      max: Math.round(intlBase * 1.10 * 100) / 100,
      recommended: Math.round(intlBase * 100) / 100,
      currency: "USD",
    };
  }

  return {
    source: "goat",
    retailPrice: null,
    lowestAsk,
    highestBid: null,
    lastSale,
    currency: "USD",
    productName: "",
    brand: brand || "",
    retailPriceTHB: null,
    resalePriceTHB,
    thaiMarketEstimate,
    internationalEstimate,
  };
}

// ─── Additional Platforms: Vestiaire Collective, Depop, Mercari ───

/**
 * ค้นหาสินค้าจาก Vestiaire Collective
 */
export async function searchVestiaire(query: string): Promise<RetailedSearchResult[]> {
  const data = await fetchRetailed("/scraper/vestiaire/search", { query });
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 5).map((item: any) => ({
    id: item.id || item.slug || String(Math.random()),
    name: item.name || item.title || "",
    slug: item.slug || item.id || "",
    brand: item.brand || "",
    image: item.image || item.photo || "",
    category: item.category || "apparel",
  }));
}

/**
 * ค้นหาสินค้าจาก Depop
 */
export async function searchDepop(query: string): Promise<RetailedSearchResult[]> {
  const data = await fetchRetailed("/scraper/depop/search", { query });
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 5).map((item: any) => ({
    id: item.id || String(Math.random()),
    name: item.description || item.name || "",
    slug: item.slug || item.id || "",
    brand: item.brand || "",
    image: item.image || item.preview || "",
    category: item.category || "apparel",
  }));
}

/**
 * ค้นหาสินค้าจาก Mercari
 */
export async function searchMercari(query: string): Promise<RetailedSearchResult[]> {
  const data = await fetchRetailed("/scraper/mercari/search", { query });
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, 5).map((item: any) => ({
    id: item.id || String(Math.random()),
    name: item.name || item.title || "",
    slug: item.slug || item.id || "",
    brand: item.brand || "",
    image: item.image || item.thumbnail || "",
    category: item.category || "apparel",
  }));
}

/**
 * ดึงราคาจาก Vestiaire Collective product
 */
export async function getVestiairePrice(productId: string, brand?: string): Promise<RetailedPriceData | null> {
  const data = await fetchRetailed("/scraper/vestiaire/product", { query: productId });
  if (!data) return null;

  const price = data.price || data.sellingPrice || null;
  const currency = data.currency || "EUR";
  // Convert EUR to USD (approximate)
  const priceUSD = currency === "EUR" ? (price ? price * 1.08 : null) : price;

  const brandNorm = (brand || data.brand || "").toLowerCase();
  const tier = BRAND_TO_TIER[brandNorm] || "mid_range";
  const thaiDiscount = THAI_MARKET_DISCOUNT[tier] || 0.22;
  const intlDiscount = INTERNATIONAL_DISCOUNT[tier] || 0.80;

  const resaleUSD = priceUSD;
  const resalePriceTHB = resaleUSD ? usdToThb(resaleUSD) : null;

  let thaiMarketEstimate = null;
  let internationalEstimate = null;
  if (resalePriceTHB && resaleUSD) {
    const thaiBase = resalePriceTHB * thaiDiscount;
    thaiMarketEstimate = {
      min: Math.round(thaiBase * 0.80),
      max: Math.round(thaiBase * 1.25),
      recommended: Math.round(thaiBase),
    };
    const intlBase = resaleUSD * intlDiscount;
    internationalEstimate = {
      min: Math.round(intlBase * 0.85 * 100) / 100,
      max: Math.round(intlBase * 1.10 * 100) / 100,
      recommended: Math.round(intlBase * 100) / 100,
      currency: "USD",
    };
  }

  return {
    source: "vestiaire",
    retailPrice: null,
    lowestAsk: priceUSD,
    highestBid: null,
    lastSale: null,
    currency: "USD",
    productName: data.name || data.title || "",
    brand: data.brand || brand || "",
    retailPriceTHB: null,
    resalePriceTHB,
    thaiMarketEstimate,
    internationalEstimate,
  };
}

/**
 * ดึงราคาจาก Depop product
 */
export async function getDepopPrice(productId: string, brand?: string): Promise<RetailedPriceData | null> {
  const data = await fetchRetailed("/scraper/depop/product", { query: productId });
  if (!data) return null;

  const priceStr = data.price || data.priceAmount;
  const priceUSD = priceStr ? parseFloat(String(priceStr)) : null;

  const brandNorm = (brand || "").toLowerCase();
  const tier = BRAND_TO_TIER[brandNorm] || "mid_range";
  const thaiDiscount = THAI_MARKET_DISCOUNT[tier] || 0.22;
  const intlDiscount = INTERNATIONAL_DISCOUNT[tier] || 0.80;

  const resaleUSD = priceUSD;
  const resalePriceTHB = resaleUSD ? usdToThb(resaleUSD) : null;

  let thaiMarketEstimate = null;
  let internationalEstimate = null;
  if (resalePriceTHB && resaleUSD) {
    const thaiBase = resalePriceTHB * thaiDiscount;
    thaiMarketEstimate = {
      min: Math.round(thaiBase * 0.80),
      max: Math.round(thaiBase * 1.25),
      recommended: Math.round(thaiBase),
    };
    const intlBase = resaleUSD * intlDiscount;
    internationalEstimate = {
      min: Math.round(intlBase * 0.85 * 100) / 100,
      max: Math.round(intlBase * 1.10 * 100) / 100,
      recommended: Math.round(intlBase * 100) / 100,
      currency: "USD",
    };
  }

  return {
    source: "depop",
    retailPrice: null,
    lowestAsk: priceUSD,
    highestBid: null,
    lastSale: null,
    currency: "USD",
    productName: data.description || data.name || "",
    brand: brand || "",
    retailPriceTHB: null,
    resalePriceTHB,
    thaiMarketEstimate,
    internationalEstimate,
  };
}

/**
 * ค้นหาราคาตลาดจากทุก source ที่มี
 * ใช้ brand + category เป็น search query
 */
// ─── Market Data Cache (24hr TTL) ───
const marketCache = new Map<string, { data: MarketPriceResult; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(brand: string, category: string, productName?: string): string {
  return `${brand.toLowerCase().trim()}|${category.toLowerCase().trim()}|${(productName || "").toLowerCase().trim()}`;
}

export function clearMarketCache() {
  marketCache.clear();
}

export function getMarketCacheSize(): number {
  return marketCache.size;
}

export async function getMarketPrice(
  brand: string,
  category: string,
  productName?: string
): Promise<MarketPriceResult> {
  const searchQuery = productName || `${brand} ${category}`.trim();
  const cacheKey = getCacheKey(brand, category, productName);

  // Check cache first
  const cached = marketCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  // Remove expired entry
  if (cached) marketCache.delete(cacheKey);

  if (!getApiKey()) {
    return {
      found: false,
      sources: [],
      bestEstimate: null,
      internationalEstimate: null,
      searchQuery,
    };
  }

  // Search all platforms in parallel (StockX, Goat + Vestiaire, Depop, Mercari)
  const [stockxResults, goatResults, vestiaireResults, depopResults, mercariResults] = await Promise.all([
    searchStockX(searchQuery),
    searchGoat(searchQuery),
    searchVestiaire(searchQuery).catch(() => [] as RetailedSearchResult[]),
    searchDepop(searchQuery).catch(() => [] as RetailedSearchResult[]),
    searchMercari(searchQuery).catch(() => [] as RetailedSearchResult[]),
  ]);

  const sources: RetailedPriceData[] = [];

  // Get price from first StockX result
  if (stockxResults.length > 0) {
    const priceData = await getStockXPrice(stockxResults[0].slug);
    if (priceData) {
      priceData.productName = stockxResults[0].name;
      sources.push(priceData);
    }
  }

  // Get price from first Goat result
  if (goatResults.length > 0) {
    const priceData = await getGoatPrices(goatResults[0].id, brand, goatResults[0].name);
    if (priceData) {
      priceData.productName = goatResults[0].name;
      sources.push(priceData);
    }
  }

  // Get price from Vestiaire Collective (graceful fallback)
  if (vestiaireResults.length > 0) {
    try {
      const priceData = await getVestiairePrice(vestiaireResults[0].slug || vestiaireResults[0].id, brand);
      if (priceData) {
        priceData.productName = vestiaireResults[0].name;
        sources.push(priceData);
      }
    } catch (e) { /* Vestiaire endpoint may not be available */ }
  }

  // Get price from Depop (graceful fallback)
  if (depopResults.length > 0) {
    try {
      const priceData = await getDepopPrice(depopResults[0].id, brand);
      if (priceData) {
        priceData.productName = depopResults[0].name;
        sources.push(priceData);
      }
    } catch (e) { /* Depop endpoint may not be available */ }
  }

  if (sources.length === 0) {
    const noResult: MarketPriceResult = {
      found: false,
      sources: [],
      bestEstimate: null,
      internationalEstimate: null,
      searchQuery,
    };
    // Cache negative results for 1 hour (shorter TTL)
    marketCache.set(cacheKey, { data: noResult, expiry: Date.now() + CACHE_TTL_MS / 24 });
    return noResult;
  }

  // Calculate best estimate from all sources
  const estimates = sources
    .filter((s) => s.thaiMarketEstimate !== null)
    .map((s) => s.thaiMarketEstimate!);

  if (estimates.length === 0) {
    return {
      found: true,
      sources,
      bestEstimate: null,
      internationalEstimate: null,
      searchQuery,
    };
  }

  // Average estimates from multiple sources
  const avgMin = Math.round(estimates.reduce((sum, e) => sum + e.min, 0) / estimates.length);
  const avgMax = Math.round(estimates.reduce((sum, e) => sum + e.max, 0) / estimates.length);
  const avgRec = Math.round(estimates.reduce((sum, e) => sum + e.recommended, 0) / estimates.length);

  // Confidence based on number of sources and price agreement
  let confidence = 50;
  if (sources.length >= 2) confidence += 10;
  if (sources.length >= 3) confidence += 10;
  if (sources.length >= 4) confidence += 5;
  if (estimates.length >= 2) {
    const spread = Math.abs(estimates[0].recommended - estimates[1].recommended) / avgRec;
    if (spread < 0.2) confidence += 20; // prices agree within 20%
    else if (spread < 0.4) confidence += 10;
  }
  confidence = Math.min(95, confidence);

  // Calculate international estimate (average from sources)
  const intlEstimates = sources
    .filter((s) => s.internationalEstimate !== null)
    .map((s) => s.internationalEstimate!);

  let internationalEstimate = null;
  if (intlEstimates.length > 0) {
    const intlAvgMin = Math.round(intlEstimates.reduce((sum, e) => sum + e.min, 0) / intlEstimates.length * 100) / 100;
    const intlAvgMax = Math.round(intlEstimates.reduce((sum, e) => sum + e.max, 0) / intlEstimates.length * 100) / 100;
    const intlAvgRec = Math.round(intlEstimates.reduce((sum, e) => sum + e.recommended, 0) / intlEstimates.length * 100) / 100;
    internationalEstimate = {
      min: intlAvgMin,
      max: intlAvgMax,
      recommended: intlAvgRec,
      currency: "USD",
      confidence,
    };
  }

  const result: MarketPriceResult = {
    found: true,
    sources,
    bestEstimate: {
      min: avgMin,
      max: avgMax,
      recommended: avgRec,
      confidence,
    },
    internationalEstimate,
    searchQuery,
  };

  // Cache successful results for 24 hours
  marketCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}
