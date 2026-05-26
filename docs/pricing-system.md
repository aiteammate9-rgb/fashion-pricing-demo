# AI Fashion Pricing System — สูตรคิดราคาเสื้อผ้ามือสองฉบับสมบูรณ์

> เอกสารนี้สรุปทุกสูตร ทุกตาราง ทุก API ที่ใช้ในระบบประเมินราคาเสื้อผ้ามือสองผู้หญิง
> ออกแบบสำหรับตลาดไทย + เตรียมขยายไป worldwide

---

## 1. ภาพรวมระบบ (System Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER UPLOADS 1-3 IMAGES                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 (2-3 วินาที) — Vision AI + Rule-Based Pricing      │
│                                                              │
│  1. GPT-4o Vision → ตรวจจับ: ประเภท, แบรนด์, สี, สภาพ,     │
│     ตำหนิ, วัสดุ, สไตล์, ลวดลาย                             │
│  2. Rule-Based Engine → คำนวณราคาทันที                       │
│  3. Thai Market Factor → ปรับราคาสำหรับตลาดไทย              │
│  4. Retailed.io API → ดึงราคาตลาดจริง (ถ้ามี)              │
│                                                              │
│  ► ส่งผลลัพธ์ให้ user ทันที (SSE stream)                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2 (8-12 วินาที) — Multi-Agent Consensus              │
│                                                              │
│  1. Agent A (Gemini 2.0 Flash) → ประเมินราคาอิสระ           │
│  2. Agent B (GPT-4o) → ประเมินราคาอิสระ                     │
│  3. Agent C (Claude 3.5 Sonnet) → ประเมินราคาอิสระ          │
│  4. Cross-validation → แต่ละ agent ดูผลของคนอื่น            │
│  5. Debate Round → ถกกันถ้าราคาต่างกันมาก                   │
│  6. Final Consensus → หาราคาสุดท้ายที่ทุก agent เห็นตรงกัน  │
│                                                              │
│  ► อัปเดตราคาที่แม่นยำขึ้น (SSE stream)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. สูตรคำนวณราคา Rule-Based (Phase 1)

### 2.1 สูตรหลัก

```
ราคาสากล = Base Price × Condition Multiplier × Defect Multiplier × Luxury Multiplier
ราคาไทย  = ราคาสากล × Thai Market Factor
```

### 2.2 ราคาที่แสดงผล

```
ราคาแนะนำ (recommended)  = ราคาไทย
ราคาขายเร็ว (fastSale)    = ราคาไทย × 0.75
ราคาสูงสุด (highValue)    = ราคาไทย × 1.35
ราคาตลาดต่ำสุด (marketMin) = ราคาไทย × 0.70
ราคาตลาดสูงสุด (marketMax) = ราคาไทย × 1.50
```

---

## 3. ตาราง Base Price ตามประเภทสินค้า (THB)

> Base Price = ราคาฐานก่อนปรับสภาพ/ตำหนิ แบ่งตาม Brand Tier

| ประเภท | Budget (low) | Mid-tier (mid) | High Street (high) | Premium |
|--------|-------------|----------------|-------------------|---------|
| **เสื้อยืด (t_shirt)** | 120 | 250 | 450 | 900 |
| **เสื้อเชิ้ต (shirt)** | 150 | 350 | 600 | 1,200 |
| **เสื้อผู้หญิง (blouse)** | 150 | 350 | 600 | 1,200 |
| **ครอปท็อป (crop_top)** | 100 | 220 | 400 | 800 |
| **สายเดี่ยว (camisole)** | 80 | 180 | 350 | 700 |
| **เสื้อกล้าม (tank_top)** | 80 | 180 | 350 | 700 |
| **ยีนส์ (jeans)** | 200 | 450 | 850 | 1,800 |
| **กางเกง (pants)** | 180 | 400 | 750 | 1,500 |
| **กางเกงขาสั้น (shorts)** | 120 | 280 | 500 | 1,000 |
| **กระโปรง (skirt)** | 180 | 380 | 700 | 1,400 |
| **เลกกิ้ง (leggings)** | 100 | 250 | 500 | 1,000 |
| **เดรส (dress)** | 250 | 500 | 900 | 1,800 |
| **จั๊มสูท (jumpsuit)** | 250 | 500 | 900 | 1,800 |
| **รอมเปอร์ (romper)** | 200 | 400 | 750 | 1,500 |
| **เบลเซอร์ (blazer)** | 350 | 700 | 1,200 | 2,500 |
| **แจ็คเก็ต (jacket)** | 350 | 700 | 1,200 | 2,500 |
| **คาร์ดิแกน (cardigan)** | 200 | 400 | 700 | 1,400 |
| **สเวตเตอร์ (sweater)** | 200 | 400 | 700 | 1,400 |
| **ฮู้ดดี้ (hoodie)** | 200 | 400 | 750 | 1,500 |
| **โค้ท (coat)** | 500 | 900 | 1,500 | 3,500 |
| **ชุดชั้นใน (bra)** | 80 | 180 | 350 | 800 |
| **กางเกงใน (underwear)** | 50 | 120 | 250 | 500 |
| **ชุดกระชับ (shapewear)** | 150 | 350 | 600 | 1,200 |
| **ชุดนอน (sleepwear)** | 120 | 280 | 500 | 1,000 |
| **สปอร์ตบรา (sports_bra)** | 100 | 250 | 500 | 1,000 |
| **กางเกงโยคะ (yoga_pants)** | 150 | 350 | 700 | 1,400 |
| **ชุดวิ่ง (running_set)** | 150 | 350 | 650 | 1,300 |
| **บิกินี่ (bikini)** | 150 | 350 | 600 | 1,200 |
| **ชุดว่ายน้ำวันพีซ** | 180 | 400 | 700 | 1,400 |
| **ชุดว่ายน้ำทูพีซ** | 150 | 350 | 600 | 1,200 |
| **ชุดชายหาด (beachwear)** | 120 | 280 | 500 | 1,000 |
| **กระเป๋า (bag)** | 200 | 500 | 1,200 | 3,000 |

---

## 4. Condition Multiplier — ตัวคูณตามสภาพสินค้า

> ใช้คูณกับ Base Price **ก่อน** หัก Thai Market Factor

| สภาพ | รหัส | Multiplier | ลดจากราคาฐาน | คำอธิบาย |
|------|------|-----------|-------------|----------|
| **ใหม่ ป้ายห้อย** | new_with_tag | 1.00 | 0% | ไม่เคยใส่ ป้ายยังอยู่ |
| **เหมือนใหม่** | like_new | 0.88 | 12% | ใส่ 1-2 ครั้ง ไม่มีร่องรอย |
| **ดีมาก** | excellent | 0.73 | 27% | ใส่ไม่กี่ครั้ง ไม่มีตำหนิ สีไม่ซีด |
| **ดี** | good | 0.58 | 42% | ใส่ปกติ มีร่องรอยเล็กน้อย แต่ยังสวย |
| **พอใช้** | fair | 0.38 | 62% | มีตำหนิเห็นชัด สีซีดบ้าง ขุยบ้าง |
| **ต้องซ่อม** | poor | 0.18 | 82% | ขาด/รู/เปื้อนถาวร ใส่ได้แต่ต้องซ่อม |
| **ชำรุด** | defective | 0.15 | 85% | ใช้งานไม่ได้ ต้องซ่อมใหญ่ |

### หลักการตั้ง Condition Multiplier:

1. **like_new (0.88)** — ลดเล็กน้อยเพราะถึงจะเหมือนใหม่ แต่ก็เป็น "มือสอง" แล้ว ผู้ซื้อคาดหวังส่วนลดอย่างน้อย 10%
2. **excellent (0.73)** — ลดประมาณ 1/4 เพราะใส่แล้วแต่ยังสภาพดีมาก ตลาดไทยยอมจ่ายในช่วงนี้สำหรับของดี
3. **good (0.58)** — ลดเกือบครึ่ง เพราะมีร่องรอยใช้งานชัดเจน ผู้ซื้อต้องการส่วนลดที่คุ้มค่า
4. **fair (0.38)** — ลดมากกว่าครึ่ง เพราะมีตำหนิที่เห็นได้ ต้องตั้งราคาต่ำเพื่อดึงดูดผู้ซื้อ
5. **poor (0.18)** — เหลือไม่ถึง 1/5 เพราะต้องซ่อม ผู้ซื้อต้องลงทุนเพิ่ม

---

## 5. Defect Multiplier — ตัวคูณตามระดับตำหนิ

> ใช้คูณ **เพิ่มเติม** จาก Condition Multiplier (แยกกัน)

| ระดับตำหนิ | รหัส | Multiplier | ลดเพิ่ม | ตัวอย่าง |
|-----------|------|-----------|---------|----------|
| **ไม่มีตำหนิ** | none | 1.00 | 0% | สมบูรณ์ |
| **เล็กน้อย** | minor | 0.88 | 12% | รอยเปื้อนเล็ก 1 จุด, ด้ายหลุด 1 เส้น |
| **ปานกลาง** | moderate/medium | 0.75 | 25% | รอยเปื้อน 2-3 จุด, สีซีดบางส่วน, ขุยเล็กน้อย |
| **มาก** | major | 0.55 | 45% | รูเล็ก, ซิปพัง, รอยขาด, เปื้อนถาวร |

### ความสัมพันธ์ระหว่าง Condition กับ Defect:

- **Condition** = สภาพโดยรวม (ความเก่า, การใช้งาน, ความสดใส)
- **Defect** = ตำหนิเฉพาะจุด (รอยเปื้อน, รู, ขาด, ซิปพัง)
- ทั้งสองคูณกัน: `ราคา = Base × Condition × Defect`
- ตัวอย่าง: สภาพ "ดี" + ตำหนิ "เล็กน้อย" = 0.58 × 0.88 = **0.51** (ลดรวม 49%)

---

## 6. Thai Market Factor — ปรับราคาสำหรับตลาดไทย

### 6.1 หลักการ

ราคาตลาดมือสองไทยต่ำกว่าตลาดสากล (ยุโรป/อเมริกา) เนื่องจาก:
- กำลังซื้อต่ำกว่า
- Supply สูง (คนไทยซื้อ fast fashion เยอะ)
- ไม่มี authentication culture เท่าตะวันตก (ทำให้ luxury ลดน้อยกว่า)

### 6.2 ตาราง Thai Market Factor (10 Tiers)

| Tier | ชื่อ | Factor | ลดจากสากล | % ของราคาปลีกที่ขายได้ | ตัวอย่างแบรนด์ |
|------|------|--------|-----------|----------------------|---------------|
| 1 | **Ultra Luxury** | 0.85 | 15% | 50-75% | Hermès, Chanel, Birkin |
| 2 | **Luxury** | 0.80 | 20% | 35-60% | Louis Vuitton, Gucci, Prada, Dior, Balenciaga |
| 3 | **Premium Accessible** | 0.75 | 25% | 25-45% | Coach, Kate Spade, Michael Kors, Longchamp |
| 4 | **Streetwear / Hype** | 0.80 | 20% | 30-55% | Supreme, Off-White, BAPE, Stussy, Palace |
| 5 | **Sport Premium** | 0.75 | 25% | 25-45% | Nike, Adidas, Lululemon, Arc'teryx, The North Face |
| 6 | **High Street** | 0.70 | 30% | 20-35% | Zara, Mango, COS, Massimo Dutti, Levi's |
| 7 | **Thai Premium** | 1.00 | 0% | 25-40% | Jaspal, CPS, Greyhound, Sretsis, Asava |
| 8 | **Thai Mid-tier** | 1.00 | 0% | 15-30% | Pomelo, CC Double O, Hooks, Sabina |
| 9 | **Mid-tier / Fast Fashion** | 0.65 | 35% | 15-30% | Uniqlo, GAP, Muji, H&M, Cotton On |
| 10 | **Budget / No Brand** | 0.60 | 40% | 10-20% | No Brand, SHEIN, Giordano, AIIZ |

### 6.3 เหตุผลของแต่ละ Tier:

- **Ultra Luxury (ลด 15%):** Hermès/Chanel รักษามูลค่าดีมากทั่วโลก ตลาดไทยก็ demand สูง ลดน้อย
- **Luxury (ลด 20%):** ยังมี demand แต่ตลาดไทยเล็กกว่า ราคาจึงต่ำกว่าเล็กน้อย
- **Streetwear/Hype (ลด 20%):** คนไทย Gen Z ตามเทรนด์ demand ยังสูง
- **Sport Premium (ลด 25%):** Nike/Adidas มีร้านในไทยเยอะ supply สูง ราคาจึงลดมากขึ้น
- **High Street (ลด 30%):** Zara/Mango มีสาขาในไทย ซื้อใหม่ไม่แพง มือสองจึงลดเยอะ
- **Thai brands (ไม่ลด):** ราคาเป็นราคาไทยอยู่แล้ว ไม่ต้องปรับ
- **Fast Fashion (ลด 35%):** Supply ล้นตลาด ของใหม่ก็ถูก มือสองต้องถูกมาก
- **Budget (ลด 40%):** ไม่มีแบรนด์ = ไม่มี resale value มาก ขายได้แค่ราคาวัสดุ+สภาพ

### 6.4 Brand Mapping (145+ แบรนด์)

```typescript
// Ultra Luxury
"hermes", "hermès", "chanel" → ultra_luxury

// Luxury  
"louis vuitton", "lv", "gucci", "prada", "dior", "balenciaga",
"bottega veneta", "saint laurent", "ysl", "celine", "loewe",
"valentino", "fendi", "givenchy", "miu miu", "versace",
"dolce & gabbana", "burberry" → luxury

// Premium Accessible
"coach", "michael kors", "kate spade", "ralph lauren",
"marc jacobs", "tory burch", "furla", "longchamp", "mcm",
"hugo boss", "sandro", "maje" → premium_accessible

// Streetwear / Hype
"supreme", "stussy", "off-white", "bape", "palace",
"fear of god", "kith", "comme des garcons", "stone island",
"acne studios", "issey miyake", "yohji yamamoto", "rick owens" → streetwear_hype

// Sport Premium
"nike", "adidas", "new balance", "the north face", "patagonia",
"lululemon", "arc'teryx", "salomon", "hoka", "on running" → sport_premium

// High Street
"zara", "mango", "cos", "& other stories", "massimo dutti",
"levi's", "tommy hilfiger", "calvin klein", "lacoste",
"fred perry", "carhartt wip", "dr. martens" → high_street

// Thai Premium
"jaspal", "cps", "greyhound", "sretsis", "disaya", "kloset",
"asava", "vatanika", "tawn c.", "milin", "patinya", "flynow",
"theatre", "gentlewoman", "issue", "senada", "poem", "carnival" → thai_premium

// Thai Mid
"pomelo", "cc double o", "hooks", "sabina", "mc jeans",
"body glove", "esp", "lyn", "tango", "naraya", "dapper", "soda" → thai_mid

// Mid-tier / Fast Fashion
"uniqlo", "h&m", "gap", "muji", "cotton on", "forever 21",
"topshop", "pull&bear", "bershka", "converse", "vans",
"puma", "champion", "fila" → mid_tier

// Budget
"no brand", "unknown", "shein", "giordano", "bossini",
"aiiz", "old navy", "factorie" → budget
```

---

## 7. Luxury Multiplier — ตัวคูณพิเศษสำหรับ Luxury

> ถ้าแบรนด์อยู่ใน LUXURY_BRANDS set → คูณ Base Price ด้วย **2.5** ก่อนคำนวณอื่น

```typescript
const LUXURY_BRANDS = [
  "gucci", "prada", "chanel", "louis_vuitton", "hermes", "balenciaga", "dior",
  "saint_laurent", "bottega_veneta", "celine", "fendi", "valentino", "givenchy",
  "burberry", "versace", "alexander_mcqueen", "loewe", "miu_miu"
];

// ถ้าแบรนด์อยู่ใน set นี้:
base = base × 2.5
```

---

## 8. ตัวอย่างการคำนวณจริง

### ตัวอย่าง 1: เสื้อยืด Uniqlo สภาพดี ไม่มีตำหนิ

```
Category: t_shirt
Brand Tier: mid → Base Price = 250 THB
Condition: good → × 0.58 = 145 THB
Defect: none → × 1.00 = 145 THB
Luxury: ไม่ใช่ → × 1.0

ราคาสากล = 145 THB
Thai Market Factor: mid_tier → × 0.65
ราคาไทย = 145 × 0.65 = 94 THB

ราคาแนะนำ = 94 THB
ราคาขายเร็ว = 94 × 0.75 = 71 THB
ราคาสูงสุด = 94 × 1.35 = 127 THB
```

### ตัวอย่าง 2: เดรส Zara สภาพดีมาก ตำหนิเล็กน้อย

```
Category: dress
Brand Tier: high → Base Price = 900 THB
Condition: excellent → × 0.73 = 657 THB
Defect: minor → × 0.88 = 578 THB
Luxury: ไม่ใช่ → × 1.0

ราคาสากล = 578 THB
Thai Market Factor: high_street → × 0.70
ราคาไทย = 578 × 0.70 = 405 THB

ราคาแนะนำ = 405 THB
ราคาขายเร็ว = 405 × 0.75 = 304 THB
ราคาสูงสุด = 405 × 1.35 = 547 THB
```

### ตัวอย่าง 3: กระเป๋า Gucci สภาพเหมือนใหม่ ไม่มีตำหนิ

```
Category: bag
Brand Tier: premium → Base Price = 3,000 THB
Luxury Multiplier: × 2.5 = 7,500 THB
Condition: like_new → × 0.88 = 6,600 THB
Defect: none → × 1.00 = 6,600 THB

ราคาสากล = 6,600 THB
Thai Market Factor: luxury → × 0.80
ราคาไทย = 6,600 × 0.80 = 5,280 THB

ราคาแนะนำ = 5,280 THB
ราคาขายเร็ว = 5,280 × 0.75 = 3,960 THB
ราคาสูงสุด = 5,280 × 1.35 = 7,128 THB
```

### ตัวอย่าง 4: แจ็คเก็ต Jaspal สภาพพอใช้ ตำหนิปานกลาง

```
Category: jacket
Brand Tier: high → Base Price = 1,200 THB
Condition: fair → × 0.38 = 456 THB
Defect: moderate → × 0.75 = 342 THB
Luxury: ไม่ใช่ → × 1.0

ราคาสากล = 342 THB
Thai Market Factor: thai_premium → × 1.00 (แบรนด์ไทย ไม่ลด)
ราคาไทย = 342 THB

ราคาแนะนำ = 342 THB
ราคาขายเร็ว = 342 × 0.75 = 257 THB
ราคาสูงสุด = 342 × 1.35 = 462 THB
```

### ตัวอย่าง 5: กางเกงยีนส์ Levi's สภาพดี ตำหนิเล็กน้อย

```
Category: jeans
Brand Tier: premium → Base Price = 1,800 THB
Condition: good → × 0.58 = 1,044 THB
Defect: minor → × 0.88 = 919 THB
Luxury: ไม่ใช่ → × 1.0

ราคาสากล = 919 THB
Thai Market Factor: high_street → × 0.70
ราคาไทย = 919 × 0.70 = 643 THB

ราคาแนะนำ = 643 THB
ราคาขายเร็ว = 643 × 0.75 = 482 THB
ราคาสูงสุด = 643 × 1.35 = 868 THB
```

---

## 9. Sellability Score — คะแนนความน่าจะขายออก

```
Sellability = (Price Score × 30%) + (Brand Score × 20%) + (Condition Score × 20%)
            + (Category Demand × 10%) + (Size Demand × 10%) + (Image Quality × 10%)
```

### ปัจจัยเสริม:
- สภาพ new_with_tag หรือ like_new → +15 คะแนน
- Brand tier premium หรือ high → +10 คะแนน
- ไม่มีตำหนิ → +5 คะแนน
- ตำหนิมาก → -20 คะแนน
- ช่วง: 20-95 คะแนน

### แปลงเป็นจำนวนวัน:
- 85+ → "1-3 วัน"
- 70-84 → "3-7 วัน"
- 55-69 → "1-2 สัปดาห์"
- 40-54 → "2-4 สัปดาห์"
- ต่ำกว่า 40 → "มากกว่า 1 เดือน"

---

## 10. Retailed.io API Integration

### 10.1 API Endpoints ที่ใช้

```
Base URL: https://app.retailed.io/api/v1

GET /stockx/search?query={brand+category}
GET /goat/search?query={brand+category}
GET /vestiaire/search?query={brand+category}
GET /depop/search?query={brand+category}
GET /mercari/search?query={brand+category}

Header: x-api-key: {RETAILED_API_KEY}
```

### 10.2 Thai Discount Matrix สำหรับ Market Data

> เมื่อได้ราคาจาก Retailed.io (ราคาสากล USD) → แปลงเป็น THB → ปรับลดตาม tier

| Brand Tier | Thai Discount | เหตุผล |
|-----------|--------------|--------|
| ultra_luxury | 10% | Demand สูงในไทย |
| luxury | 15% | ยังมี demand แต่ตลาดเล็กกว่า |
| streetwear_hype | 15% | Gen Z ไทยตามเทรนด์ |
| sport_premium | 20% | มีร้านในไทยเยอะ supply สูง |
| high_street | 25% | ซื้อใหม่ไม่แพง |
| mid_tier | 30% | Supply ล้น |
| budget | 35% | ไม่มี brand value |

### 10.3 Aggregation Logic

```typescript
// 1. ดึงราคาจากทุก marketplace
// 2. เอา median ของ lowest prices จากแต่ละ source
// 3. ปรับลดด้วย Thai Discount Matrix
// 4. ถ้า market data สูงกว่า rule-based มาก → cap ไว้ที่ 150% ของ rule-based
// 5. ถ้า market data ต่ำกว่า rule-based มาก → floor ไว้ที่ 50% ของ rule-based
```

---

## 11. Multi-Agent Consensus (Phase 2)

### 11.1 AI Models ที่ใช้

| Agent | Model | บทบาท |
|-------|-------|--------|
| Agent A | Gemini 2.0 Flash | ประเมินราคาจากมุมมอง data-driven |
| Agent B | GPT-4o | ประเมินราคาจากมุมมอง market knowledge |
| Agent C | Claude 3.5 Sonnet | ประเมินราคาจากมุมมอง brand expertise |

### 11.2 กระบวนการ 3 Rounds

**Round 1 — Independent Evaluation:**
- แต่ละ agent ได้รับข้อมูลเดียวกัน: detection results, rule-based price, market data, Thai Market Factor
- ประเมินราคาอิสระ ไม่เห็นผลของ agent อื่น

**Round 2 — Cross-Validation:**
- แต่ละ agent เห็นผลของ agent อื่น 2 ตัว
- ปรับราคาของตัวเองถ้าเห็นว่าเหตุผลของคนอื่นดีกว่า

**Round 3 — Debate (ถ้าจำเป็น):**
- ถ้าราคาต่างกันมากกว่า 30% → เข้า debate round
- แต่ละ agent ให้เหตุผลว่าทำไมราคาของตัวเองถูก
- หาจุดกลางที่ทุกคนยอมรับ

### 11.3 Consensus Level

```
High (สูง):    ราคาต่างกันไม่เกิน 15% → ใช้ค่าเฉลี่ย
Medium (กลาง): ราคาต่างกัน 15-30% → ใช้ median
Low (ต่ำ):     ราคาต่างกันมากกว่า 30% → ใช้ค่ากลางหลัง debate
```

### 11.4 Prompt ที่ส่งให้ AI (สรุป)

```
คุณเป็นผู้เชี่ยวชาญตีราคาเสื้อผ้ามือสองในตลาดไทย

ข้อมูลที่ได้รับ:
- ประเภท: {category}
- แบรนด์: {brand} (Tier: {tier})
- สภาพ: {condition}
- ตำหนิ: {defects}
- ราคา Rule-based: {ruleBasedPrice} THB
- ราคาตลาด (ถ้ามี): {marketPrice} THB
- Thai Market Factor: ลด {discountPercent}% จากสากล

Thai Market Price Ranges:
- Ultra Luxury: ลด 15% จากสากล
- Luxury: ลด 20%
- Streetwear/Hype: ลด 20%
- Sport Premium: ลด 25%
- High Street: ลด 30%
- Mid-tier: ลด 35%
- Budget: ลด 40%
- Thai brands: ใช้ราคาไทยโดยตรง

กรุณาประเมิน:
1. ราคาแนะนำสำหรับตลาดไทย (THB)
2. ราคาแนะนำสำหรับตลาดสากล (USD)
3. ระดับความมั่นใจ (0-100)
4. เหตุผลสั้นๆ
```

---

## 12. Price Blending — ผสมราคาจากหลายแหล่ง

### 12.1 สูตร Blend

```typescript
// เมื่อได้ consensus price จาก Phase 2:
function blendWithAIConsensus(ruleBasedPrice, consensusPrice, confidence) {
  // confidence สูง → เชื่อ AI มากขึ้น
  const aiWeight = Math.min(0.7, confidence / 100);
  const ruleWeight = 1 - aiWeight;
  
  let blended = (ruleBasedPrice * ruleWeight) + (consensusPrice * aiWeight);
  
  // Guardrails: ไม่ให้ AI ลากราคาไปไกลเกิน
  const maxDeviation = 0.5; // ไม่เกิน 50% จาก rule-based
  const floor = ruleBasedPrice * (1 - maxDeviation);
  const ceiling = ruleBasedPrice * (1 + maxDeviation);
  
  blended = Math.max(floor, Math.min(ceiling, blended));
  
  return {
    recommendedPrice: Math.round(blended),
    fastSalePrice: Math.round(blended * 0.75),
    highValuePrice: Math.round(blended * 1.35),
    marketMin: Math.round(blended * 0.70),
    marketMax: Math.round(blended * 1.50),
  };
}
```

### 12.2 Guardrails

- AI ไม่สามารถเปลี่ยนราคาเกิน ±50% จาก rule-based
- ถ้า consensus level = "low" → ลด AI weight ลง 50%
- ถ้า market data มี → ให้ market data มีน้ำหนัก 30% เพิ่มเติม
- `fastSalePrice < recommendedPrice < highValuePrice` เสมอ
- `marketMin < recommendedPrice < marketMax` เสมอ

---

## 13. SSE API Contract

### 13.1 Single Item Evaluation

```
POST /api/evaluate-stream
Content-Type: application/json

{
  "images": [
    { "base64": "...", "mimeType": "image/jpeg", "label": "ด้านหน้า" },
    { "base64": "...", "mimeType": "image/jpeg", "label": "ด้านหลัง" },
    { "base64": "...", "mimeType": "image/jpeg", "label": "ตำหนิ" }
  ],
  "itemIndex": 0
}

Response: SSE Stream
event: phase1
data: {
  "phase": "phase1",
  "itemIndex": 0,
  "detection": {
    "category": "dress",
    "brand": "Zara",
    "primaryColor": "black",
    "secondaryColor": "white",
    "condition": "excellent",
    "defects": [],
    "defectLevel": "none",
    "material": "polyester",
    "style": "casual",
    "pattern": "solid",
    "confidence": 85
  },
  "ruleBasedPrice": {
    "recommendedPrice": 405,
    "fastSalePrice": 304,
    "highValuePrice": 547,
    "marketMin": 284,
    "marketMax": 608,
    "sellabilityScore": 72,
    "thaiMarketInfo": {
      "internationalPrice": 578,
      "thaiPrice": 405,
      "thaiMarketTier": "high_street",
      "thaiMarketLabel": "High Street / Contemporary",
      "discountPercent": 30,
      "explanation": "High Street — ราคาไทยต่ำกว่าสากล 30% เพราะ supply สูง + กำลังซื้อต่ำ"
    }
  },
  "marketData": {
    "found": true,
    "bestEstimate": 450,
    "sources": [...]
  }
}

event: phase2
data: {
  "phase": "phase2",
  "itemIndex": 0,
  "consensus": {
    "confidence": 78,
    "consensusLevel": "high",
    "estimatedResaleThaiPrice": 420,
    "estimatedResaleIntlPriceUSD": 18,
    "reasoning": "Zara dress in excellent condition..."
  }
}

event: done
data: {}
```

### 13.2 Batch Evaluation (5 items)

```
POST /api/evaluate-batch
Content-Type: application/json

{
  "items": [
    { "images": [...], "itemIndex": 0 },
    { "images": [...], "itemIndex": 1 },
    ...
  ]
}

Response: SSE Stream (interleaved phase1/phase2 events for each item)
```

---

## 14. Vision AI Detection Prompt

```
คุณเป็นผู้เชี่ยวชาญด้านแฟชั่นและเสื้อผ้ามือสอง วิเคราะห์ภาพเสื้อผ้าที่ให้มา

ตอบเป็น JSON format:
{
  "category": "ประเภทสินค้า (t_shirt, shirt, blouse, crop_top, camisole, tank_top, jeans, pants, shorts, skirt, leggings, dress, jumpsuit, romper, blazer, jacket, cardigan, sweater, hoodie, coat, bra, underwear, shapewear, sleepwear, sports_bra, yoga_pants, running_set, bikini, one_piece_swim, two_piece_swim, beachwear, bag)",
  "brand": "ชื่อแบรนด์ (ถ้าไม่เห็นให้ใส่ 'ไม่ระบุ')",
  "primaryColor": "สีหลัก",
  "secondaryColor": "สีรอง (ถ้ามี)",
  "condition": "สภาพ (new_with_tag, like_new, excellent, good, fair, poor)",
  "defects": ["รายการตำหนิที่เห็น"],
  "defectLevel": "ระดับตำหนิ (none, minor, moderate, major)",
  "material": "วัสดุที่คาดว่าเป็น",
  "style": "สไตล์ (casual, formal, streetwear, vintage, sporty, bohemian, minimalist)",
  "pattern": "ลวดลาย (solid, striped, plaid, floral, graphic, animal_print)",
  "confidence": "ความมั่นใจ 0-100"
}
```

---

## 15. Database Schema — ตารางที่เกี่ยวข้อง

### 15.1 pricing_history (ประวัติการประเมินราคา)

```sql
CREATE TABLE pricing_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  
  -- Detection results
  category VARCHAR(100),
  brand VARCHAR(255),
  condition_level VARCHAR(50),
  defect_level VARCHAR(50),
  
  -- Pricing results
  recommended_price INT,
  fast_sale_price INT,
  high_value_price INT,
  market_min INT,
  market_max INT,
  
  -- Thai Market Factor
  thai_market_tier VARCHAR(50),
  thai_market_factor DECIMAL(3,2),
  international_price INT,
  
  -- Consensus
  consensus_price INT,
  consensus_confidence INT,
  consensus_level VARCHAR(20),
  
  -- Sale outcome tracking
  actual_sold_price INT,
  sold_date TIMESTAMP,
  sold_platform VARCHAR(100),
  days_to_sell INT,
  
  -- Metadata
  image_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 15.2 wardrobe (ตู้เสื้อผ้า)

```sql
CREATE TABLE wardrobe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  
  -- Item info
  category VARCHAR(100),
  brand VARCHAR(255),
  color VARCHAR(100),
  size VARCHAR(20),
  condition_level VARCHAR(50),
  
  -- Pricing
  recommended_price INT,
  fast_sale_price INT,
  high_value_price INT,
  thai_market_tier VARCHAR(50),
  thai_market_factor DECIMAL(3,2),
  
  -- Status tracking
  status ENUM('in_wardrobe', 'listed', 'sold') DEFAULT 'in_wardrobe',
  listed_price INT,
  actual_sold_price INT,
  sold_date TIMESTAMP,
  sold_platform VARCHAR(100),
  days_to_sell INT,
  
  -- Images
  image_url TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 16. Environment Variables ที่ต้องใช้

| Variable | ใช้ทำอะไร | ตัวอย่าง |
|----------|----------|----------|
| `OPENAI_API_KEY` | GPT-4o Vision + Phase 2 Agent B | sk-... |
| `GOOGLE_AI_API_KEY` | Gemini 2.0 Flash (Agent A) | AIza... |
| `ANTHROPIC_API_KEY` | Claude 3.5 Sonnet (Agent C) | sk-ant-... |
| `RETAILED_API_KEY` | Retailed.io market data | ret_... |
| `DATABASE_URL` | MySQL/TiDB connection | mysql://... |
| `JWT_SECRET` | Session cookie signing | random-string |
| `BUILT_IN_FORGE_API_URL` | Manus internal APIs | https://... |
| `BUILT_IN_FORGE_API_KEY` | Manus API auth | Bearer token |

---

## 17. สรุปสูตรรวม (Quick Reference)

```
┌─────────────────────────────────────────────────────────────┐
│  FINAL PRICE = blend(Rule-Based, AI Consensus, Market Data) │
└─────────────────────────────────────────────────────────────┘

Rule-Based Price:
  = CATEGORY_BASE[category][brandTier]
    × LUXURY_MULT (2.5 ถ้าเป็น luxury)
    × CONDITION_MULT[condition]
    × DEFECT_MULT[defectLevel]
    × THAI_MARKET_FACTOR[tier]

Condition Multiplier:
  new_with_tag=1.00, like_new=0.88, excellent=0.73,
  good=0.58, fair=0.38, poor=0.18, defective=0.15

Defect Multiplier:
  none=1.00, minor=0.88, moderate=0.75, major=0.55

Thai Market Factor:
  ultra_luxury=0.85, luxury=0.80, premium_accessible=0.75,
  streetwear_hype=0.80, sport_premium=0.75, high_street=0.70,
  thai_premium=1.00, thai_mid=1.00, mid_tier=0.65, budget=0.60

Price Variants:
  fastSale = recommended × 0.75
  highValue = recommended × 1.35
  marketMin = recommended × 0.70
  marketMax = recommended × 1.50

Blend Guardrails:
  AI weight = min(0.7, confidence/100)
  Max deviation = ±50% from rule-based
  Always: fastSale < recommended < highValue
  Always: marketMin < recommended < marketMax
```

---

## 18. การต่อยอดในอนาคต

1. **Pricing Accuracy Feedback Loop:** เก็บราคาขายจริง → เปรียบเทียบกับราคาแนะนำ → ปรับ multiplier อัตโนมัติ
2. **Dynamic Thai Market Factor:** ปรับ factor ตาม supply/demand ที่เก็บได้จริง (ถ้า Uniqlo ขายออกเร็วกว่าที่คิด → ปรับ factor ขึ้น)
3. **Worldwide Expansion:** เพิ่ม Market Factor สำหรับประเทศอื่น (เช่น Japan Factor, Korea Factor)
4. **Image-Based Condition Detection:** ให้ AI ประเมินสภาพจากรูปแทนที่จะให้ user เลือกเอง
5. **Historical Price Trend:** แสดงกราฟราคาตลาดย้อนหลัง 3-6 เดือน

---

*เอกสารนี้สร้างเมื่อ: 25 พฤษภาคม 2026*
*Version: 2.0 (Updated Condition Multiplier + Thai Market Factor)*
