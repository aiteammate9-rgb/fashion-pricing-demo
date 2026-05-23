# Fashion Pricing Demo — Complete Project Summary

> **Purpose of this document**: This is a comprehensive handoff document for Claude (or any AI assistant) to continue development on this project. It covers every feature, API integration, pricing logic formula, database schema, frontend/backend architecture, and suggested next steps in full detail.

---

## 1. Project Overview

**Fashion Pricing Demo** is a full-stack Thai second-hand fashion pricing web application. Users upload clothing photos, and the system uses a combination of rule-based pricing logic, real-time market data from resale platforms, and a multi-agent AI consensus system (Gemini, GPT-4o, Claude) to produce accurate Thai second-hand market prices. The app also generates AI-powered eBay and Amazon listing content for international resale.

**Live URL**: `https://fashionscore-gwdrsxj4.manus.space`

**Key Design Philosophy**:
- AI prices are **never used directly** — they are always blended with rule-based pricing using a weighted formula that penalizes extreme deviations
- The rule-based engine serves as the "anchor" to prevent unrealistic AI estimates
- All prices are calibrated for the **Thai second-hand market** (not international)
- International pricing (USD) is maintained separately for future eBay/Amazon integration

---

## 2. Tech Stack & Architecture

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4 |
| UI Components | shadcn/ui | Latest |
| Animation | Framer Motion | Latest |
| Routing | Wouter | Latest |
| Backend | Express | 4 |
| API Layer | tRPC | 11 |
| ORM | Drizzle ORM | 0.44.5 |
| Database | MySQL (TiDB) | — |
| Auth | Manus OAuth (JWT session cookie) | — |
| Build Tool | Vite | 7.1.9 |
| Package Manager | pnpm | — |
| Testing | Vitest | — |

**Architecture Diagram (Conceptual)**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                       │
│  Home.tsx → ImageUploader + Form + PricingResultPanel + Share   │
│  History.tsx → Grid of past evaluations                         │
│  ListingGenerator.tsx → eBay/Amazon listing content             │
├─────────────────────────────────────────────────────────────────┤
│                    tRPC Client (httpBatchLink)                   │
├─────────────────────────────────────────────────────────────────┤
│                     BACKEND (Express + tRPC)                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ AI      │  │ History  │  │ Listing  │  │ Auth (Manus     │ │
│  │ Router  │  │ Router   │  │ Router   │  │ OAuth + JWT)    │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └─────────────────┘ │
│       │             │              │                             │
│  ┌────▼────┐   ┌────▼─────┐  ┌────▼─────┐                     │
│  │Multi-   │   │ Drizzle  │  │ invokeLLM│                     │
│  │Agent    │   │ ORM      │  │ (Forge)  │                     │
│  │Service  │   └────┬─────┘  └──────────┘                     │
│  └────┬────┘        │                                           │
│       │        ┌────▼─────┐                                     │
│  ┌────▼────┐   │  TiDB    │                                     │
│  │Retailed │   │ Database │                                     │
│  │.io API  │   └──────────┘                                     │
│  └─────────┘                                                    │
├─────────────────────────────────────────────────────────────────┤
│              EXTERNAL APIs                                       │
│  • Google AI (Gemini 2.0 Flash)                                 │
│  • OpenAI (GPT-4o)                                              │
│  • Anthropic (Claude Sonnet 4)                                  │
│  • Retailed.io (StockX, Goat, Vestiaire, Depop, Mercari)       │
│  • Manus Forge (LLM fallback, S3 storage, notifications)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Project File Structure

```
fashion-pricing-demo/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx              ← Main evaluation page (upload + form + results)
│   │   │   ├── History.tsx           ← Past evaluations dashboard
│   │   │   ├── ListingGenerator.tsx  ← eBay/Amazon listing generator
│   │   │   └── NotFound.tsx
│   │   ├── components/
│   │   │   ├── PricingResultPanel.tsx ← Results display (3 tiers, blend info, per-agent)
│   │   │   ├── SharePanel.tsx         ← Social sharing + AI caption generation
│   │   │   ├── ImageUploader.tsx      ← 3-slot image upload grid
│   │   │   ├── AnalysisLoadingOverlay.tsx ← Multi-step loading progress
│   │   │   ├── GaugeMeter.tsx         ← Sellability score gauge
│   │   │   └── ui/                    ← shadcn/ui components
│   │   ├── lib/
│   │   │   ├── pricing-engine.ts      ← Rule-based pricing + blend logic
│   │   │   └── trpc.ts               ← tRPC client binding
│   │   ├── _core/hooks/useAuth.ts     ← Auth hook
│   │   ├── App.tsx                    ← Routes & providers
│   │   ├── main.tsx                   ← tRPC/QueryClient setup
│   │   └── index.css                  ← Global styles + Tailwind theme
│   └── index.html
├── server/
│   ├── _core/
│   │   ├── index.ts          ← Express server entrypoint (50MB body limit)
│   │   ├── env.ts            ← Environment variable bindings
│   │   ├── trpc.ts           ← tRPC init + publicProcedure/protectedProcedure
│   │   ├── context.ts        ← tRPC context (authenticateRequest)
│   │   ├── llm.ts            ← invokeLLM helper (Manus Forge)
│   │   ├── sdk.ts            ← Manus OAuth SDK (session, JWT)
│   │   ├── oauth.ts          ← OAuth callback route
│   │   ├── storageProxy.ts   ← /manus-storage/* presigned URL proxy
│   │   ├── notification.ts   ← notifyOwner helper
│   │   └── imageGeneration.ts
│   ├── routers/
│   │   ├── ai.ts             ← AI analysis, market price, consensus endpoints
│   │   ├── history.ts        ← CRUD for pricing history
│   │   └── listing.ts        ← eBay/Amazon listing generation
│   ├── services/
│   │   ├── multi-agent.ts    ← 3-agent consensus (Gemini + GPT-4o + Claude)
│   │   └── retailed.ts       ← Retailed.io market data integration
│   ├── routers.ts            ← AppRouter combining all sub-routers
│   ├── storage.ts            ← S3 storage helpers (storagePut, storageGet)
│   └── db.ts                 ← Database connection + query helpers
├── drizzle/
│   ├── schema.ts             ← DB schema (users + pricingHistory)
│   └── relations.ts
├── shared/
│   └── const.ts              ← Shared constants (COOKIE_NAME, error messages)
├── todo.md                   ← Feature tracking
├── PROJECT_SUMMARY.md        ← This file
├── vitest.config.ts
├── vite.config.ts
└── package.json
```

---

## 4. Environment Variables

All environment variables are managed through the Manus platform's secret management system. They are injected at runtime and should never be hardcoded.

| Variable | Purpose | Used In |
|----------|---------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string | `server/db.ts` |
| `JWT_SECRET` | Session cookie signing | `server/_core/sdk.ts` |
| `VITE_APP_ID` | Manus OAuth application ID | Frontend login URL |
| `OAUTH_SERVER_URL` | Manus OAuth backend | `server/_core/sdk.ts` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL | Frontend redirect |
| `OWNER_OPEN_ID` | Owner's Manus ID | Admin checks |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API base URL | LLM, storage, notifications |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge bearer token | Server-side API calls |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend Forge token | Client-side (unused currently) |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini | `multi-agent.ts` |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o | `multi-agent.ts` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `multi-agent.ts` |
| `RETAILED_API_KEY` | Retailed.io API key | `retailed.ts` |

---

## 5. Database Schema

The database uses MySQL (TiDB) via Drizzle ORM. Schema is defined in `drizzle/schema.ts`.

### 5.1 Users Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (auto-increment, PK) | Surrogate primary key |
| `openId` | VARCHAR(64), UNIQUE | Manus OAuth identifier |
| `name` | TEXT | Display name |
| `email` | VARCHAR(320) | Email (optional) |
| `loginMethod` | VARCHAR(64) | OAuth provider |
| `role` | ENUM('user', 'admin') | Role-based access |
| `createdAt` | TIMESTAMP | Account creation |
| `updatedAt` | TIMESTAMP | Last update (auto) |
| `lastSignedIn` | TIMESTAMP | Last login time |

### 5.2 Pricing History Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (auto-increment, PK) | Record ID |
| `userId` | INT (nullable) | FK to users.id (null = guest) |
| `category` | VARCHAR(64) | Product category |
| `brand` | VARCHAR(128) | Brand name |
| `size` | VARCHAR(32) | Size (XS–XXL, Free Size) |
| `condition` | VARCHAR(32) | Condition code |
| `defectLevel` | VARCHAR(32) | Defect severity |
| `color` | VARCHAR(64) | Primary color |
| `style` | VARCHAR(64) | Style (casual, streetwear, etc.) |
| `originalPrice` | INT | Original retail price (optional) |
| `recommendedPrice` | INT | Final recommended price (THB) |
| `fastSalePrice` | INT | Fast sale price (82% of recommended) |
| `highValuePrice` | INT | High value price (120% of recommended) |
| `marketMin` | INT | Market range minimum |
| `marketMax` | INT | Market range maximum |
| `sellabilityScore` | INT | 0–100 sellability score |
| `confidenceScore` | INT | 0–100 confidence score |
| `intlPriceUSD` | INT | International price in USD |
| `consensusLevel` | VARCHAR(32) | "unanimous" / "majority" / "debated" |
| `agentCount` | INT | Number of AI agents that responded |
| `imageUrl` | TEXT | S3 URL of uploaded image |
| `listingData` | TEXT | JSON string of eBay/Amazon listing |
| `createdAt` | TIMESTAMP | Record creation time |

---

## 6. API Routes (tRPC)

All API routes are served at `/api/trpc` via tRPC with superjson transformer.

### 6.1 Auth Router (`auth.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | Query | Public | Returns current user or null |
| `auth.logout` | Mutation | Public | Clears session cookie |

### 6.2 AI Router (`ai.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `ai.analyzeImage` | Mutation | Public | Vision AI analysis of clothing images (brand, category, condition, defects, color, material, style) |
| `ai.generateCaption` | Mutation | Public | Generate social media captions (short/medium/long + hashtags) |
| `ai.getMarketPrice` | Mutation | Public | Fetch market prices from Retailed.io (StockX, Goat, Vestiaire, Depop, Mercari) |
| `ai.evaluateConsensus` | Mutation | Public | Multi-agent consensus evaluation (3 AI agents) |

### 6.3 History Router (`history.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `history.save` | Mutation | Public | Save evaluation result (uploads image to S3) |
| `history.list` | Query | Public | List user's history (requires login, paginated) |
| `history.get` | Query | Public | Get single history record |
| `history.delete` | Mutation | Protected | Delete history record (ownership check) |
| `history.updateListing` | Mutation | Public | Update listing data for existing record |

### 6.4 Listing Router (`listing.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `listing.generateEbay` | Mutation | Public | Generate eBay listing content (title, description, tags, pricing strategy, item specifics) |
| `listing.generateAmazon` | Mutation | Public | Generate Amazon listing content (title, bullets, description, keywords, category path) |

### 6.5 System Router (`system.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `system.health` | Query | Public | Health check |
| `system.notifyOwner` | Mutation | Admin | Send notification to project owner |

---

## 7. Pricing Logic — Complete Technical Detail

The pricing system has three layers that work together:

### 7.1 Layer 1: Rule-Based Engine (`pricing-engine.ts`)

The rule-based engine calculates a base price from lookup tables:

```
adjustedPrice = CATEGORY_BASE_PRICE[category][brandTier] × CONDITION_MULTIPLIER × DEFECT_MULTIPLIER
```

**Category Base Prices (THB)**:

| Category | Low (budget) | Mid (fast fashion) | High (mid-premium) | Premium (luxury) |
|----------|------|-----|------|---------|
| T-shirt | 120 | 250 | 450 | 900 |
| Shirt | 150 | 350 | 600 | 1,200 |
| Blouse | 150 | 350 | 600 | 1,200 |
| Dress | 250 | 500 | 900 | 1,800 |
| Pants | 180 | 400 | 750 | 1,500 |
| Skirt | 180 | 380 | 700 | 1,400 |
| Jacket | 350 | 700 | 1,200 | 2,500 |
| Bag | 250 | 600 | 1,200 | 3,000 |

**Brand Tiers** (~150 brands mapped):

| Tier | Examples | Base Price Used |
|------|----------|----------------|
| `low` | Cotton On, Giordano, Factorie, Old Navy | Low column |
| `mid` | Uniqlo, H&M, Gap, Muji, Converse, Vans, Champion | Mid column |
| `high` | Zara, Nike, Adidas, Levi's, Jaspal, CPS, New Balance, The North Face | High column |
| `premium` | Gucci, LV, Supreme, Off-White, BAPE, Coach, Sretsis, Asava | Premium column |

**Condition Multipliers**:

| Condition | Multiplier |
|-----------|-----------|
| New with tag | 1.10 |
| Like new | 0.95 |
| Good | 0.85 |
| Fair | 0.70 |
| Defective | 0.45 |

**Defect Multipliers**:

| Defect Level | Multiplier |
|-------------|-----------|
| None | 1.00 |
| Minor | 0.88 |
| Medium | 0.70 |
| Major | 0.50 |

**Price Tiers from Adjusted Price**:
- Fast Sale = adjustedPrice × 0.82
- Recommended = adjustedPrice × 1.00
- High Value = adjustedPrice × 1.20
- Market Min = adjustedPrice × 0.75
- Market Max = adjustedPrice × 1.25

**Resale Ceiling**: If user provides original retail price, `adjustedPrice = min(adjustedPrice, originalPrice × 0.55)`.

### 7.2 Layer 2: Market Data Integration (`retailed.ts`)

When market data is available from Retailed.io, it is blended with rule-based using confidence-weighted averaging:

```
marketWeight = (marketConfidence / 100) × 0.6    // max 60% weight
ruleWeight = 1 - marketWeight
blendedPrice = rulePrice × ruleWeight + marketPrice × marketWeight
```

**Thai Market Discount Matrix** (applied to international resale prices):

| Brand Tier | Discount Factor | Meaning |
|-----------|----------------|---------|
| Fast Fashion | 0.14 | Thai price = 14% of international resale |
| Mid Range | 0.22 | Thai price = 22% of international resale |
| Premium | 0.30 | Thai price = 30% of international resale |
| Luxury | 0.55 | Thai price = 55% of international resale |
| Streetwear | 0.40 | Thai price = 40% of international resale |
| Sport | 0.18 | Thai price = 18% of international resale |

**International Discount Matrix** (for eBay/Amazon pricing):

| Brand Tier | Discount Factor | Meaning |
|-----------|----------------|---------|
| Fast Fashion | 0.75 | Sell at 75% of market resale |
| Mid Range | 0.80 | Sell at 80% of market resale |
| Premium | 0.82 | Sell at 82% of market resale |
| Luxury | 0.88 | Sell at 88% of market resale |
| Streetwear | 0.85 | Sell at 85% of market resale |
| Sport | 0.78 | Sell at 78% of market resale |

**Collab Detection**: If product name contains " x ", "collaboration", "collab", "limited edition", or mentions known collab brands (KAWS, Supreme, Off-White, BAPE, etc.), the tier is overridden to "streetwear" for higher pricing.

**Currency Conversion**: `USD_TO_THB = 35.5` (hardcoded constant).

### 7.3 Layer 3: AI Consensus Blend (`blendWithAIConsensus()`)

After the multi-agent consensus returns a price, it is blended with the rule-based price using a deviation-aware formula:

```typescript
function blendWithAIConsensus(rulePrice, aiPrice, confidence):
    deviation = |aiPrice - rulePrice| / rulePrice
    aiConfidence = confidence / 100                    // normalize to 0–1
    deviationPenalty = max(0.2, 1 - deviation × 0.8)  // penalize large deviations
    aiWeight = min(0.6, aiConfidence × 0.6 × deviationPenalty)  // max 60% AI weight
    ruleWeight = 1 - aiWeight

    blendedPrice = rulePrice × ruleWeight + aiPrice × aiWeight

    // Floor: never below 50% of rule-based price
    finalPrice = max(rulePrice × 0.5, blendedPrice)
```

**Key Properties**:
- At 0% deviation (AI agrees with rule-based): AI gets up to 60% weight
- At 50% deviation: AI weight drops significantly due to penalty
- At 100%+ deviation: AI weight is minimal (~12%)
- **Hard floor**: Final price can never drop below 50% of rule-based price
- This prevents AI from producing unrealistically low prices for known brands

---

## 8. Multi-Agent Consensus System (`multi-agent.ts`)

### 8.1 Architecture

Three AI agents evaluate clothing photos independently, then cross-validate:

```
Round 1: Independent Evaluation (parallel)
  ├── Gemini 2.0 Flash (Google AI API direct, fallback to Manus Forge)
  ├── GPT-4o (OpenAI API)
  └── Claude Sonnet 4 (Anthropic API)

Round 2: Cross-validation
  └── Check if all prices are within ±30% of average

Round 3: Debate (if disagreement > 30%)
  └── Send all results to LLM arbiter → final price
```

### 8.2 API Calls

**Gemini (Primary)**:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_AI_API_KEY}
Content-Type: application/json
Body: { contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1000, responseMimeType: "application/json" } }
```
Fallback: Manus Forge `invokeLLM` with vision content.

**GPT-4o**:
```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer {OPENAI_API_KEY}
Body: { model: "gpt-4o", messages: [...], max_tokens: 1000, temperature: 0.3 }
```

**Claude**:
```
POST https://api.anthropic.com/v1/messages
x-api-key: {ANTHROPIC_API_KEY}
anthropic-version: 2023-06-01
Body: { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type, data } }, { type: "text", text: prompt }] }] }
```

### 8.3 Shared Evaluation Prompt

All three agents receive the same prompt with brand-tier price reference tables:

```
ช่วงราคาอ้างอิงตลาดมือสองไทย (สภาพดี):
• ไม่มีแบรนด์/แบรนด์ไม่ดัง: เสื้อยืด 50-150฿, กางเกง 80-200฿
• Fast Fashion (H&M, Cotton On): เสื้อยืด 80-200฿, กางเกง 100-250฿
• Mid-tier (Uniqlo, Muji, GAP): เสื้อยืด 120-300฿, กางเกง 180-450฿
• High Street (Zara, Mango): เสื้อยืด 150-400฿, กางเกง 250-600฿
• Sport/Streetwear (Nike, Adidas, Levi's): เสื้อยืด 200-500฿, กางเกง 350-800฿
• Premium (Charles & Keith, COS): เสื้อยืด 300-800฿, กางเกง 400-1200฿
• Luxury (Coach, Kate Spade): เสื้อยืด 500-2000฿, กางเกง 800-3000฿
• Designer (Gucci, LV, Chanel): เสื้อยืด 2000-8000฿, กางเกง 3000-15000฿
```

### 8.4 Consensus Logic

Each agent returns: `{ category, brand, color, material, condition, conditionScore, defects, estimatedRetailPrice, estimatedResalePrice, estimatedResalePriceUSD, confidence, reasoning }`

**Agreement Check**: All prices must be within ±30% of the average across agents.

**If Agreed (Unanimous)**:
- Final price = confidence-weighted average of all agent prices
- Consensus level = "unanimous"
- Confidence bonus = +15

**If Disagreed**:
- Run debate: Send all agent results to LLM arbiter
- Arbiter returns `{ finalResalePrice, finalResalePriceUSD, reasoning }`
- If 2 of 3 agents are within 25% of each other → "majority" (+5 confidence)
- Otherwise → "debated" (-10 confidence)
- Fallback if debate fails: use median price

**Categorical Fields**: Majority vote for category, brand, color, material, condition. Defects are merged (union of all unique defects).

**Overall Confidence Calculation**:
```
overallConfidence = min(100, max(0, avgAgentConfidence + consensusBonus))
```

---

## 9. Market Data Integration (`retailed.ts`)

### 9.1 Retailed.io API

Base URL: `https://app.retailed.io/api/v1`
Auth: `x-api-key` header with `RETAILED_API_KEY`
Timeout: 15 seconds per request

### 9.2 Supported Platforms & Endpoints

| Platform | Search Endpoint | Price Endpoint |
|----------|----------------|----------------|
| StockX | `/scraper/stockx/search?query=` | `/scraper/stockx/product?query={slug}` |
| Goat | `/scraper/goat/search?query=` | `/scraper/goat/prices?query={id}` |
| Vestiaire Collective | `/scraper/vestiaire/search?query=` | `/scraper/vestiaire/product?query={id}` |
| Depop | `/scraper/depop/search?query=` | `/scraper/depop/product?query={id}` |
| Mercari | `/scraper/mercari/search?query=` | (search only) |

### 9.3 Price Aggregation Flow

1. Search all 5 platforms in parallel with `brand + category` as query
2. For each platform with results, fetch price data from first result
3. Apply Thai market discount to get `thaiMarketEstimate` (min/max/recommended)
4. Apply international discount to get `internationalEstimate` (USD)
5. Average all estimates across sources
6. Calculate confidence based on:
   - Number of sources found (+10 per source, up to +25)
   - Price agreement between sources (+20 if within 20%, +10 if within 40%)
   - Max confidence: 95

---

## 10. Frontend Pages & Components

### 10.1 Home Page (`/`) — Main Evaluation Flow

The Home page orchestrates the entire evaluation pipeline:

1. **Image Upload**: 3 slots (front, back, defect) — at least 1 required
2. **AI Auto-Detect Button**: Becomes prominent (pulse animation, gradient) when images are uploaded. Calls `ai.analyzeImage` to auto-fill form fields (category, brand, condition, defect level, color, style)
3. **Product Form**: Category, Brand (dropdown with ~150 brands + custom input), Size, Condition, Defect Level, Sell Goal, Original Price, Defect Description
4. **Evaluate Button**: Triggers the full pipeline:
   - Validate required fields (shows inline errors if missing)
   - Run `ai.getMarketPrice` + `ai.evaluateConsensus` in parallel
   - Call `evaluateItemWithMarket()` for rule-based + market blend
   - Call `blendWithAIConsensus()` to blend AI consensus with rule-based
   - Attach consensus data, blend info, international pricing
   - Auto-save to history (best-effort, uploads first image to S3)
   - Show results in PricingResultPanel

**Loading Overlay Steps**: uploading → analyzing → consensus ("AI 3 ตัวกำลังถกกัน...") → pricing → done

### 10.2 PricingResultPanel Component

Displays the complete pricing result with these sections:

1. **Multi-Agent Consensus Badge**: Shows agent count, consensus level (color-coded), confidence %
2. **Per-Agent Breakdown** (collapsible): Each AI agent's individual assessment (category, brand, condition, Thai price, USD price, confidence, reasoning)
3. **Market Data Badge**: Number of platforms, confidence level
4. **International Price Panel**: USD price for eBay/Amazon with "Create Listing" CTA link
5. **Market Range Card**: Visual min/recommended/max
6. **Three Price Tier Cards**: Fast Sale (82%), Recommended (100%), High Value (120%) — clickable to switch
7. **Blend Info Badge**: Visual bar showing Rule-based vs AI weight percentages
8. **Manual Override Slider**: User adjusts price, system recalculates sellability and days-to-sell
9. **Sellability Gauge**: SVG semicircle gauge (0–100) with color bands

### 10.3 History Page (`/history`)

- Auth-gated (shows login CTA if not authenticated)
- Fetches `history.list` with limit 50
- Responsive grid of cards showing: image thumbnail, brand/category/size/condition, color badge, AI consensus badge, recommended price, market range, sellability score, creation date, USD price (if available)
- Delete action with confirmation toast

### 10.4 Listing Generator Page (`/listing`)

- Receives product info + USD price via URL query params from PricingResultPanel
- Form: category, brand, size, condition, color, style, material, defects, USD price
- Two tabs: eBay and Amazon
- Calls `listing.generateEbay` or `listing.generateAmazon`
- Displays structured listing content with copy-to-clipboard per section:
  - **eBay**: title, subtitle, description, condition note, item specifics, suggested prices (Buy It Now, Auction Start, Best Offer), tags, shipping note
  - **Amazon**: title, 5 bullet points, description, condition grade/note, backend keywords, suggested price, category path

### 10.5 SharePanel Component

- Auto-opens after evaluation completes
- Auto-generates AI caption (no button press needed) via `ai.generateCaption`
- Three caption lengths: short (Twitter), medium (Instagram/LINE), long (Facebook)
- Copy-to-clipboard button
- Social share buttons: Facebook, LINE, X/Twitter
- Regenerate button for new caption

---

## 11. Sellability Score Calculation

```typescript
sellability = 
    priceScore(selectedPrice, recommendedPrice) × 0.30 +
    brandScore(brand) × 0.20 +
    conditionScore(condition) × 0.20 +
    categoryDemandScore × 0.10 +
    sizeDemandScore × 0.10 +
    imageQualityScore × 0.10
```

**Price Score** (how competitive the selected price is):
- ≤ 85% of recommended → 94
- ≤ 100% → 84
- ≤ 115% → 70
- ≤ 130% → 56
- > 130% → 40

**Days to Sell Estimate**:
- Score ≥ 85 → "3–7 วัน"
- Score ≥ 70 → "7–14 วัน"
- Score ≥ 50 → "15–30 วัน"
- Score < 50 → "มากกว่า 30 วัน"

---

## 12. Authentication Flow

1. Frontend calls `getLoginUrl()` which builds Manus OAuth portal URL with `redirectUri = origin + '/api/oauth/callback'` encoded in base64 state
2. User authenticates on Manus portal
3. Callback hits `GET /api/oauth/callback?code=...&state=...`
4. Server exchanges code for token via `sdk.exchangeCodeForToken()`
5. Server fetches user info via `sdk.getUserInfo()`
6. Server upserts user into database
7. Server creates JWT session token, sets `app_session_id` cookie
8. Redirects to `/`
9. Frontend `useAuth()` hook calls `trpc.auth.me` to get current user
10. On 401 errors, frontend auto-redirects to login

---

## 13. Storage

- **Image uploads**: `storagePut(key, buffer, mimeType)` → uploads to Manus Forge S3
- **Image serving**: `/manus-storage/{key}` → server proxies to presigned S3 URL (307 redirect)
- **History images**: Stored at `pricing-history/{timestamp}-{random}.{ext}`

---

## 14. Testing

27 tests passing across these test files:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `server/auth.logout.test.ts` | Auth logout flow | Session cookie clearing |
| `server/history.test.ts` | History CRUD | Save, list, delete procedures |
| `server/retailed.test.ts` | Retailed.io integration | 402 quota handling, graceful fallback |
| `server/pricing-blend.test.ts` | Blend logic (9 tests) | All edge cases of `blendWithAIConsensus()` |

Run tests: `pnpm test`
TypeScript check: `npx tsc --noEmit`

---

## 15. Completed Features Summary

- Multi-agent AI consensus (Gemini + GPT-4o + Claude) with debate
- Rule-based pricing engine with ~150 brands across 4 tiers
- AI + Rule-based price blending with deviation penalty and 50% floor
- Retailed.io market data (StockX, Goat, Vestiaire, Depop, Mercari)
- Thai market discount matrix + international pricing (USD)
- Collab/limited edition detection
- History dashboard with auto-save and S3 image storage
- AI listing generator (eBay + Amazon structured content)
- AI auto-detect from images (brand, category, condition, color, style)
- AI social media caption generator (auto-generates on panel open)
- Per-agent breakdown UI (collapsible)
- Blend info badge (visual weight bar)
- Manual price override slider with real-time sellability recalculation
- Dynamic sell-goal switching on results page
- Sellability gauge meter
- Share panel with Facebook/LINE/X integration
- Auto-detect button UX (pulse animation when images uploaded)
- Validation feedback (inline errors without blocking)
- Loading overlay with multi-step progress

---

## 16. Known Limitations

1. **Currency rate hardcoded**: `USD_TO_THB = 35.5` — should be fetched dynamically
2. **History pagination**: Currently loads 50 items max, no infinite scroll
3. **Brand dropdown**: 150+ brands in a single dropdown — needs search/filter
4. **No real marketplace integration**: eBay/Amazon listings are text-only (no actual API posting)
5. **Image quality score**: Hardcoded at 75 (not actually computed from images)
6. **Single image to AI**: Only first image is sent to multi-agent consensus
7. **No price history tracking**: Cannot track price changes over time for same item
8. **Guest history**: Guests can save but cannot retrieve (requires login)
9. **No batch evaluation**: One item at a time only
10. **Retailed.io quota**: API has usage limits; 402 errors are handled gracefully but data may be unavailable

---

## 17. Suggested Next Steps (Priority Order)

### High Priority
1. **Search/filter in brand dropdown** — 150+ brands need a searchable combobox
2. **AI auto-tier for unknown brands** — When user types a brand not in the database, use AI to classify its tier
3. **Save manual override price to history** — Currently only the system-calculated price is saved
4. **Pagination/infinite scroll in history** — Currently limited to 50 items

### Medium Priority
5. **Real eBay API integration** — Use eBay Browse API + Sell API for actual listing posting
6. **Real Amazon SP-API integration** — Seller Central API for product listing
7. **Analytics dashboard** — Total evaluations, average price, popular brands, price trend charts
8. **Platform comparison chart** — Bar chart comparing prices across StockX/Goat/Vestiaire
9. **Camera capture on mobile** — Direct camera access (currently uses file picker)
10. **Popular brands quick-select** — Top 5-8 most evaluated brands as quick buttons

### Future / Ambitious
11. **Virtual Try-On (VTON)** — GPT-Image-1/2 for virtual try-on (~$0.05-0.21/image)
12. **Price change alerts** — Notify users when market price changes for previously evaluated items
13. **Dynamic currency rates** — Fetch real-time USD/THB rate
14. **Batch evaluation** — Upload multiple items at once
15. **AI image quality scoring** — Actually compute image quality from uploaded photos
16. **Multi-image consensus** — Send all 3 images (not just first) to AI agents

---

## 18. Commands Reference

```bash
# Development
pnpm dev              # Start dev server (Vite + Express, auto-port)
pnpm test             # Run all 27 vitest tests
npx tsc --noEmit      # TypeScript type check

# Database
pnpm db:push          # Generate + run Drizzle migrations

# Build
pnpm build            # Vite build + esbuild server bundle
```

---

## 19. Important Design Decisions & Rationale

1. **Why blend AI with rule-based?** — AI models can hallucinate unrealistic prices (e.g., Levi's jeans at ฿100). The rule-based engine provides a stable anchor, and the blend formula ensures AI can only influence within reasonable bounds.

2. **Why 50% floor?** — Even with maximum deviation penalty, we never want the final price below half of what the rule-based system calculates. This prevents catastrophic underpricing.

3. **Why 3 different AI models?** — Each model has different strengths. Cross-validation catches individual model errors. The debate mechanism resolves genuine disagreements.

4. **Why Thai market discount is so steep (14-55%)?** — Thai second-hand market prices are genuinely much lower than international resale due to purchasing power differences. A $25 H&M shirt on Depop sells for ~125 THB (~$3.50) in Thai second-hand apps.

5. **Why `publicProcedure` for most routes?** — The app is designed to work for guests (no login required to evaluate). History viewing requires login, but saving works for guests (userId = null).

6. **Why Gemini has a fallback?** — Google AI API can have regional availability issues. Manus Forge provides a reliable fallback that uses the same model family.

---

## 20. Brand Database Reference

The complete brand database is in `client/src/lib/pricing-engine.ts` under `BRAND_TIERS` (for pricing) and `BRANDS` (for dropdown UI). Key brand groups:

**Thai Brands**: Jaspal, CPS Chaps, Greyhound, Sretsis, Disaya, Kloset, Issue, Flynow, Theatre, Asava, Tawn C., Gentlewoman, Milin, Poem, Senada, Carnival, Hooks, ESP, Lyn, Naraya, Mahanakhon, Dry Clean Only

**Streetwear/Hype**: Supreme, Stüssy, Off-White, BAPE, Palace, Fear of God, Essentials, Kith, Human Made, Neighborhood, WTAPS, Undercover, CDG, Visvim, Kapital, Needles, Stone Island, CP Company, Acne Studios, AMI Paris, Thom Browne, Sacai, Issey Miyake, Yohji Yamamoto, Rick Owens, Vetements, AMBUSH, Mastermind, ASSC, Golf Wang, Brain Dead, Noah, Aimé Leon Dore, Jordan, Yeezy, Travis Scott

**Luxury/Designer**: Gucci, Louis Vuitton, Prada, Dior, Chanel, Hermès, Balenciaga, Bottega Veneta, Saint Laurent, Celine, Loewe, Valentino, Fendi, Givenchy, Miu Miu, Versace, Dolce & Gabbana, Alexander McQueen, Burberry, Vivienne Westwood

**Premium/Accessible Luxury**: Coach, Michael Kors, Kate Spade, Ralph Lauren, Marc Jacobs, Tory Burch, Furla, Longchamp, MCM, Ted Baker, Sandro, Maje, Theory, Hugo Boss, Emporio Armani, Moschino, Kenzo, Diesel, DSQuared2

**Sports/Outdoor**: Nike, Adidas, New Balance, Puma, Asics, Under Armour, The North Face, Patagonia, Columbia, Arc'teryx, Mammut, Carhartt WIP, Fjällräven, Timberland, Dr. Martens, Birkenstock

**Fast Fashion/Mid**: Uniqlo, H&M, Zara, Mango, Gap, Muji, COS, & Other Stories, Converse, Vans, Pull&Bear, Bershka, ASOS, Banana Republic, American Eagle, Hollister, Abercrombie & Fitch

**Budget**: Cotton On, Factorie, Giordano, Bossini, Baleno, Penshoppe, Old Navy

---

*Document generated: May 20, 2026*
*Latest checkpoint: `777050cd` (auto-detect button UX)*
*Project ID: `GwDrSXj4QupwGSfc3T6ULw`*
