/**
 * LINE Messaging API helpers — push flex cards & order notifications.
 * --------------------------------------------------------------------------
 * Token comes ONLY from the environment (ENV.lineMessagingToken /
 * LINE_MESSAGING_TOKEN) — never hard-coded. If the token is missing, every
 * push is a silent no-op so the core flows never break.
 *
 * We already store each user's LINE userId inside users.openId as
 * `line:<lineUserId>` (set at login), so push only needs that lookup +
 * the user having added the Official Account as a friend.
 */
import { eq } from "drizzle-orm";
import { ENV } from "./env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const GOLD = "#B59772";
const INK = "#3A2E25";
const MUTED = "#A6957F";
const SAGE = "#7E8A5F";

export function isLineConfigured(): boolean {
  return !!ENV.lineMessagingToken;
}

/** Resolve our internal user id → LINE userId (from users.openId `line:<id>`). */
export async function getLineUserId(internalUserId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [u] = await db.select().from(users).where(eq(users.id, internalUserId)).limit(1);
  const openId = u?.openId ?? "";
  const m = /^line:(.+)$/.exec(openId);
  return m ? m[1] : null;
}

/** Push up to 5 message objects to a user. Returns true on success. Never throws. */
export async function pushToUser(internalUserId: number, messages: any[]): Promise<boolean> {
  if (!ENV.lineMessagingToken || messages.length === 0) return false;
  const to = await getLineUserId(internalUserId);
  if (!to) return false;
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineMessagingToken}`,
      },
      body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
    });
    if (!res.ok) {
      console.warn("[LINE] push failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[LINE] push error", (e as Error)?.message ?? e);
    return false;
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** A styled outfit look card (sent to the user after AI matching). */
export function outfitMessage(opts: {
  title: string;
  occasion?: string | null;
  imageUrl?: string | null;
  commentary?: string | null;
  appUrl?: string;
}) {
  const body: any[] = [
    { type: "text", text: opts.title, weight: "bold", size: "lg", color: INK, wrap: true },
  ];
  if (opts.occasion) {
    body.push({ type: "text", text: opts.occasion, size: "xs", color: MUTED, wrap: true });
  }
  if (opts.commentary) {
    body.push({
      type: "text",
      text: opts.commentary.length > 300 ? opts.commentary.slice(0, 297) + "…" : opts.commentary,
      size: "sm",
      color: INK,
      wrap: true,
      margin: "md",
    });
  }
  const bubble: any = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
  };
  if (opts.imageUrl && /^https?:\/\//i.test(opts.imageUrl)) {
    bubble.hero = {
      type: "image",
      url: opts.imageUrl,
      size: "full",
      aspectRatio: "3:4",
      aspectMode: "cover",
    };
  }
  if (opts.appUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: GOLD,
          height: "sm",
          action: { type: "uri", label: "ดูลุคนี้", uri: opts.appUrl },
        },
      ],
    };
  }
  return { type: "flex", altText: `ลุคใหม่: ${opts.title}`, contents: bubble };
}

/**
 * A compact card whose button opens the full outfit calendar (/calendar) inside
 * LINE's in-app browser. Sent when the user fills the month and every Monday.
 */
export function calendarMessage(opts: { calendarUrl: string; title?: string; subtitle?: string }) {
  const bubble: any = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: opts.title || "ปฏิทินแต่งตัวของคุณ",
          weight: "bold",
          size: "lg",
          color: INK,
          wrap: true,
        },
        {
          type: "text",
          text: opts.subtitle || "ดูลุคทั้งเดือน + สีมงคลรายวันได้เลย",
          size: "sm",
          color: MUTED,
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: GOLD,
          height: "sm",
          action: { type: "uri", label: "เปิดปฏิทินแต่งตัว", uri: opts.calendarUrl },
        },
      ],
    },
  };
  return { type: "flex", altText: "ปฏิทินแต่งตัวของคุณ", contents: bubble };
}

/**
 * Format A — a horizontal Flex carousel of the next few days. Each bubble is one
 * day with its outfit thumbnail, title and lucky-color note, plus a button that
 * opens the full calendar. Used on "จัดชุดทั้งเดือน" and every Monday.
 */
export function weekFlexMessage(opts: {
  days: { date: string; title: string | null; imageUrl: string | null; luckyNote: string | null }[];
  calendarUrl: string;
}) {
  const fmt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("th-TH", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(iso + "T00:00:00+07:00"));
    } catch {
      return iso;
    }
  };
  const bubbles = opts.days.slice(0, 10).map(d => {
    const body: any[] = [
      { type: "text", text: fmt(d.date), weight: "bold", size: "sm", color: INK },
      {
        type: "text",
        text: d.title || "ยังไม่มีลุค",
        size: "xs",
        color: d.title ? MUTED : "#B0A89C",
        wrap: true,
      },
    ];
    if (d.luckyNote) {
      body.push({ type: "text", text: d.luckyNote, size: "xxs", color: GOLD, wrap: true });
    }
    const bubble: any = {
      type: "bubble",
      size: "kilo",
      body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: GOLD,
            height: "sm",
            action: { type: "uri", label: "เปิดปฏิทิน", uri: opts.calendarUrl },
          },
        ],
      },
    };
    if (d.imageUrl && /^https?:\/\//i.test(d.imageUrl)) {
      bubble.hero = {
        type: "image",
        url: d.imageUrl,
        size: "full",
        aspectRatio: "3:4",
        aspectMode: "cover",
      };
    }
    return bubble;
  });
  return {
    type: "flex",
    altText: "ลุคของคุณ 7 วันข้างหน้า",
    contents: { type: "carousel", contents: bubbles },
  };
}

/** Notify the SELLER that someone reserved their item. */
export function sellerOrderMessage(opts: {
  itemName: string;
  priceBaht: number;
  imageUrl?: string | null;
  pickupDate: Date;
}) {
  const body: any[] = [
    { type: "text", text: "🛍️ มีคนสนใจซื้อสินค้าของคุณ", weight: "bold", size: "md", color: SAGE, wrap: true },
    { type: "text", text: opts.itemName, size: "sm", color: INK, wrap: true, margin: "md" },
    { type: "text", text: `ราคา ฿${opts.priceBaht.toLocaleString()}`, size: "lg", weight: "bold", color: GOLD },
    {
      type: "text",
      text: `ไรเดอร์จะเข้ารับสินค้าประมาณวันที่ ${fmtDate(opts.pickupDate)} — กรุณาเตรียมสินค้าให้พร้อม`,
      size: "xs",
      color: MUTED,
      wrap: true,
      margin: "md",
    },
  ];
  const bubble: any = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
  };
  if (opts.imageUrl && /^https?:\/\//i.test(opts.imageUrl)) {
    bubble.hero = { type: "image", url: opts.imageUrl, size: "full", aspectRatio: "1:1", aspectMode: "cover" };
  }
  return { type: "flex", altText: "มีคนสนใจซื้อสินค้าของคุณ", contents: bubble };
}

/** Notify the BUYER that their purchase is confirmed, with payment + delivery info. */
export function buyerOrderMessage(opts: {
  itemName: string;
  priceBaht: number;
  imageUrl?: string | null;
  deliveryDate: Date;
  paymentNote: string;
}) {
  const body: any[] = [
    { type: "text", text: "✅ ยืนยันการซื้อแล้ว", weight: "bold", size: "md", color: SAGE, wrap: true },
    { type: "text", text: opts.itemName, size: "sm", color: INK, wrap: true, margin: "md" },
    { type: "text", text: `ยอดชำระ ฿${opts.priceBaht.toLocaleString()}`, size: "lg", weight: "bold", color: GOLD },
    { type: "text", text: opts.paymentNote, size: "xs", color: INK, wrap: true, margin: "md" },
    {
      type: "text",
      text: `คาดว่าจะได้รับสินค้าประมาณวันที่ ${fmtDate(opts.deliveryDate)}`,
      size: "xs",
      color: MUTED,
      wrap: true,
    },
  ];
  const bubble: any = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
  };
  if (opts.imageUrl && /^https?:\/\//i.test(opts.imageUrl)) {
    bubble.hero = { type: "image", url: opts.imageUrl, size: "full", aspectRatio: "1:1", aspectMode: "cover" };
  }
  return { type: "flex", altText: "ยืนยันการซื้อแล้ว", contents: bubble };
}

/** Notify the BUYER that they reserved an item (awaiting seller). */
export function buyerReservedMessage(opts: {
  itemName: string;
  priceBaht: number;
  imageUrl?: string | null;
}) {
  const body: any[] = [
    { type: "text", text: "⏳ จองสินค้าแล้ว", weight: "bold", size: "md", color: GOLD, wrap: true },
    { type: "text", text: opts.itemName, size: "sm", color: INK, wrap: true, margin: "md" },
    { type: "text", text: `฿${opts.priceBaht.toLocaleString()}`, size: "lg", weight: "bold", color: GOLD },
    { type: "text", text: "กำลังรอผู้ขายยืนยัน เราจะแจ้งคุณทันทีที่ยืนยัน", size: "xs", color: MUTED, wrap: true, margin: "md" },
  ];
  const bubble: any = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
  };
  if (opts.imageUrl && /^https?:\/\//i.test(opts.imageUrl)) {
    bubble.hero = { type: "image", url: opts.imageUrl, size: "full", aspectRatio: "1:1", aspectMode: "cover" };
  }
  return { type: "flex", altText: "จองสินค้าแล้ว", contents: bubble };
}
