/**
 * Credit / quota alert — pushes a LINE message to the shop owner when an LLM
 * call fails because the API credit or rate quota looks exhausted. Throttled so
 * a burst of failures only sends one alert per cooldown window.
 *
 * Owner LINE id is resolved from OWNER_OPEN_ID (stored as `line:<id>` at login,
 * or a raw `U...` LINE userId). No-op if token or owner id is missing.
 */
import { ENV } from "./env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // at most one alert / 6h
let lastAlertAt = 0;

function ownerLineId(): string | null {
  const raw = ENV.ownerOpenId || "";
  const m = /^line:(.+)$/.exec(raw);
  if (m) return m[1];
  if (/^U[0-9a-f]{32}$/i.test(raw)) return raw;
  return null;
}

/** Heuristic: does this error text indicate exhausted credit / quota / rate limit? */
export function looksLikeCreditError(msg: string): boolean {
  const s = (msg || "").toLowerCase();
  return (
    /\b(429|402)\b/.test(s) ||
    s.includes("quota") ||
    s.includes("exceeded") ||
    s.includes("insufficient") ||
    s.includes("billing") ||
    s.includes("credit") ||
    s.includes("resource_exhausted") ||
    s.includes("rate limit") ||
    s.includes("too many requests")
  );
}

/** Fire-and-forget LINE alert to the owner. Throttled; never throws. */
export async function notifyCreditExhausted(detail: string): Promise<void> {
  if (!ENV.lineMessagingToken) return;
  const to = ownerLineId();
  if (!to) return;
  if (Date.now() - lastAlertAt < COOLDOWN_MS) return;
  lastAlertAt = Date.now();
  const text =
    "⚠️ SHEOWA แจ้งเตือน: เครดิต/โควต้า API อาจหมดหรือถูกจำกัด\n" +
    "ระบบ AI (บอทตอบแชต / จัดลุค) อาจใช้งานไม่ได้ชั่วคราว กรุณาเช็กยอดเครดิตหรือเปลี่ยนคีย์\n" +
    `รายละเอียด: ${(detail || "").slice(0, 300)}`;
  try {
    await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineMessagingToken}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
  } catch {
    /* never throw from an alert path */
  }
}
