/**
 * Lucky color analysis derived from birth date.
 * The mapping blends Thai day-of-the-week color tradition with seasonal palette
 * cues to produce a small, taste-forward color guide for a given user.
 */

export type LuckyColorResult = {
  birthDayName: string;
  zodiacSign: string;
  primary: { name: string; hex: string };
  supporting: { name: string; hex: string }[];
  avoid: { name: string; hex: string };
  rationale: string;
};

const DAY_PALETTE: Record<
  number,
  { name: string; primary: { name: string; hex: string }; supporting: { name: string; hex: string }[]; avoid: { name: string; hex: string } }
> = {
  0: {
    name: "Sunday",
    primary: { name: "Ruby Red", hex: "#B0202E" },
    supporting: [
      { name: "Champagne Gold", hex: "#C9A24A" },
      { name: "Ivory", hex: "#F5EFE2" },
    ],
    avoid: { name: "Cobalt Blue", hex: "#1E3A8A" },
  },
  1: {
    name: "Monday",
    primary: { name: "Soft Cream", hex: "#F4ECDC" },
    supporting: [
      { name: "Pearl White", hex: "#F8F5EF" },
      { name: "Pale Sage", hex: "#C8D5BE" },
    ],
    avoid: { name: "Ruby Red", hex: "#B0202E" },
  },
  2: {
    name: "Tuesday",
    primary: { name: "Dusty Rose", hex: "#C68B86" },
    supporting: [
      { name: "Terracotta", hex: "#A45A3F" },
      { name: "Stone", hex: "#A89C8E" },
    ],
    avoid: { name: "Lemon Yellow", hex: "#EFD96B" },
  },
  3: {
    name: "Wednesday",
    primary: { name: "Forest Green", hex: "#2F5D45" },
    supporting: [
      { name: "Olive", hex: "#7C8550" },
      { name: "Camel", hex: "#B68A5C" },
    ],
    avoid: { name: "Dusty Rose", hex: "#C68B86" },
  },
  4: {
    name: "Thursday",
    primary: { name: "Saffron Orange", hex: "#D58936" },
    supporting: [
      { name: "Burnt Sienna", hex: "#9A4A2A" },
      { name: "Warm Bronze", hex: "#7C4A2A" },
    ],
    avoid: { name: "Lavender", hex: "#A892C9" },
  },
  5: {
    name: "Friday",
    primary: { name: "Sky Blue", hex: "#7FA8C9" },
    supporting: [
      { name: "Powder Blue", hex: "#B8D2DF" },
      { name: "Soft Silver", hex: "#C7CCD1" },
    ],
    avoid: { name: "Charcoal", hex: "#2C2A28" },
  },
  6: {
    name: "Saturday",
    primary: { name: "Royal Purple", hex: "#5B3A89" },
    supporting: [
      { name: "Plum", hex: "#7A3E65" },
      { name: "Onyx Black", hex: "#1A1A1C" },
    ],
    avoid: { name: "Pearl White", hex: "#F8F5EF" },
  },
};

const ZODIAC: { name: string; from: [number, number]; to: [number, number] }[] = [
  { name: "Capricorn", from: [12, 22], to: [1, 19] },
  { name: "Aquarius", from: [1, 20], to: [2, 18] },
  { name: "Pisces", from: [2, 19], to: [3, 20] },
  { name: "Aries", from: [3, 21], to: [4, 19] },
  { name: "Taurus", from: [4, 20], to: [5, 20] },
  { name: "Gemini", from: [5, 21], to: [6, 20] },
  { name: "Cancer", from: [6, 21], to: [7, 22] },
  { name: "Leo", from: [7, 23], to: [8, 22] },
  { name: "Virgo", from: [8, 23], to: [9, 22] },
  { name: "Libra", from: [9, 23], to: [10, 22] },
  { name: "Scorpio", from: [10, 23], to: [11, 21] },
  { name: "Sagittarius", from: [11, 22], to: [12, 21] },
];

function zodiacFor(month: number, day: number): string {
  for (const sign of ZODIAC) {
    const [fm, fd] = sign.from;
    const [tm, td] = sign.to;
    if (
      (month === fm && day >= fd) ||
      (month === tm && day <= td) ||
      (fm > tm && (month === fm || month === tm))
    ) {
      return sign.name;
    }
  }
  return "Capricorn";
}

export function analyzeLuckyColors(birthDate: string | null | undefined): LuckyColorResult | null {
  if (!birthDate) return null;
  const date = new Date(birthDate + "T00:00:00Z");
  if (isNaN(date.getTime())) return null;

  const dow = date.getUTCDay();
  const palette = DAY_PALETTE[dow] ?? DAY_PALETTE[0];
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const sign = zodiacFor(month, day);

  return {
    birthDayName: palette.name,
    zodiacSign: sign,
    primary: palette.primary,
    supporting: palette.supporting,
    avoid: palette.avoid,
    rationale: `Born on a ${palette.name} under ${sign}, you carry a natural affinity for ${palette.primary.name.toLowerCase()}. Anchor key looks with this hue, layer ${palette.supporting.map(s => s.name.toLowerCase()).join(" and ")} for nuance, and let ${palette.avoid.name.toLowerCase()} stay an accent rather than the lead.`,
  };
}

// ─── Per-day lucky color (สีมงคลประจำวัน) ───
// Unlike analyzeLuckyColors() which keys off the user's BIRTH weekday, this
// returns the lucky palette for a SPECIFIC calendar date's weekday — used by
// the outfit calendar so each day carries a Thai day-color suggestion.
const THAI_DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export type DayLuckyColor = {
  weekday: number; // 0=Sunday
  dayNameTh: string;
  dayNameEn: string;
  primary: { name: string; hex: string };
  supporting: { name: string; hex: string }[];
  avoid: { name: string; hex: string };
};

export function luckyColorForDate(isoDate: string): DayLuckyColor | null {
  const date = new Date(isoDate + "T00:00:00+07:00");
  if (isNaN(date.getTime())) return null;
  // Use Bangkok-local weekday.
  const weekday = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  ).getDay();
  const palette = DAY_PALETTE[weekday] ?? DAY_PALETTE[0];
  return {
    weekday,
    dayNameTh: THAI_DAY_NAMES[weekday],
    dayNameEn: palette.name,
    primary: palette.primary,
    supporting: palette.supporting,
    avoid: palette.avoid,
  };
}

/** Short Thai one-liner for the calendar / LINE card. */
export function luckyNoteForDate(isoDate: string): string | null {
  const lc = luckyColorForDate(isoDate);
  if (!lc) return null;
  return `สีมงคลวัน${lc.dayNameTh}: ${lc.primary.name} · เลี่ยง ${lc.avoid.name}`;
}
