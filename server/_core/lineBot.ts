/**
 * LINE AI chat bot — answers customer chats in the Official Account and guides
 * them toward using the app / closing a sale.
 * --------------------------------------------------------------------------
 * Flow:  LINE → POST /line/webhook → verify x-line-signature (HMAC SHA256 with
 * the Messaging-API channel secret) → for each text message, ask the LLM with a
 * brand/sales system prompt + short per-user memory → reply via the LINE reply
 * API with quick-reply buttons (open app / talk to a human).
 *
 * Cost note: replying to incoming messages is free on LINE; the only cost is
 * the LLM call (cheap Flash-tier via invokeLLM). No secrets are hard-coded —
 * token + secret come from ENV only. If they are missing the webhook still
 * returns 200 so LINE's verify succeeds, but logs a warning.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { invokeLLM, type Message } from "./llm";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const APP_URL = "https://app.sheowa.com";

// ── Brand / sales knowledge (expand this from your real FAQ over time) ──
const SYSTEM_PROMPT = `คุณคือ "ผู้ช่วยร้าน SHEOWA" แชตกับลูกค้าผู้หญิงไทย (Gen Y–Z) ทางไลน์
บุคลิก: เป็นกันเอง สุภาพ อบอุ่น กระชับ ไม่ขายของแบบยัดเยียด ตอบสั้นเหมาะกับแชตมือถือ (2–4 ประโยค)

SHEOWA คือแอปแฟชั่นสำหรับผู้หญิง ทำได้ 4 อย่าง:
1) แมตช์ลุค — ถ่ายรูปตัวเอง ให้สไตลิสต์จัดลุคที่ใช่ให้  (ลิงก์: ${APP_URL}/lookbook)
2) ขายเสื้อผ้า — ถ่ายรูปเสื้อผ้า รู้ราคาที่ขายได้จริง แล้วลงขายได้  (ลิงก์: ${APP_URL}/sell)
3) ช็อปเสื้อผ้า — เลือกซื้อจากตู้คนอื่นในราคาดี  (ลิงก์: ${APP_URL}/shop)
4) ปฏิทินแต่งตัว + สีมงคลรายวัน ส่งลุคเข้าไลน์ทุกเช้า  (ลิงก์: ${APP_URL}/calendar)
เข้าใช้ผ่านไลน์ได้เลย กดเข้าสู่ระบบด้วย LINE ไม่ต้องสมัครใหม่ — ฟรี

หน้าที่ของคุณ: ทักทาย ตอบคำถาม สอนวิธีใช้ แนะนำฟีเจอร์ที่ตรงกับสิ่งที่ลูกค้าอยากได้ และชวนให้กดเข้าแอปไปทำต่อ (ขาย/ซื้อ/แมตช์ลุค) = ปิดการขาย

กฎสำคัญ (ห้ามฝ่าฝืน):
- ห้าม "เดา" หรือกุราคา/สต็อก/โปรโมชันเป็นตัวเลขเด็ดขาด ราคาสินค้ามือสองต่างกันทุกชิ้น → ให้บอกว่าราคาดูได้จริงในแอป แล้วส่งลิงก์ ${APP_URL}/shop หรือให้กดประเมินราคาที่ ${APP_URL}/sell
- ถ้าไม่รู้คำตอบ หรือเป็นเรื่องเงิน/ปัญหาออเดอร์/เคลม → อย่ามั่ว ให้เสนอ "คุยกับแอดมิน"
- ไม่ขอข้อมูลบัตรเครดิต/รหัสผ่านจากลูกค้าในแชต
- ตอบเป็นภาษาไทยเสมอ แทรกลิงก์ได้แต่อย่ายาวเกินไป`;

const WELCOME =
  "สวัสดีค่ะ 👋 SHEOWA ยินดีต้อนรับ\nเราช่วยจัดลุค ขายเสื้อผ้าให้รู้ราคาจริง และช็อปมือสองได้เลย อยากเริ่มตรงไหนดีคะ?";

// ── tiny per-user memory (ephemeral, resets on redeploy) ──
type Turn = { role: "user" | "assistant"; content: string };
const MEM = new Map<string, { turns: Turn[]; exp: number }>();
const MEM_TTL_MS = 30 * 60 * 1000;
const MAX_TURNS = 6;

function getMem(uid: string): Turn[] {
  const m = MEM.get(uid);
  if (!m || m.exp < Date.now()) return [];
  return m.turns;
}
function pushMem(uid: string, turn: Turn) {
  const turns = [...getMem(uid), turn].slice(-MAX_TURNS);
  MEM.set(uid, { turns, exp: Date.now() + MEM_TTL_MS });
}

function verifySignature(req: Request): boolean {
  const secret = ENV.lineMessagingSecret;
  if (!secret) {
    console.warn("[LINE bot] LINE_MESSAGING_SECRET not set — skipping signature check");
    return true; // don't break verify during setup; set the secret in prod
  }
  const sig = req.header("x-line-signature") || "";
  const raw: Buffer | undefined = (req as any).rawBody;
  if (!raw) return false;
  const hash = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  try {
    return sig.length === hash.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hash));
  } catch {
    return false;
  }
}

function quickReply() {
  const items: any[] = [
    { type: "action", action: { type: "uri", label: "เปิดแอป", uri: APP_URL } },
    { type: "action", action: { type: "uri", label: "แมตช์ลุค", uri: `${APP_URL}/lookbook` } },
    { type: "action", action: { type: "uri", label: "ขายเสื้อผ้า", uri: `${APP_URL}/sell` } },
    { type: "action", action: { type: "uri", label: "ช็อป", uri: `${APP_URL}/shop` } },
  ];
  if (ENV.lineAdminUrl) {
    items.push({ type: "action", action: { type: "uri", label: "คุยกับแอดมิน", uri: ENV.lineAdminUrl } });
  }
  return { items };
}

async function replyToLine(replyToken: string, text: string): Promise<void> {
  if (!ENV.lineMessagingToken) {
    console.warn("[LINE bot] LINE_MESSAGING_TOKEN not set — cannot reply");
    return;
  }
  const message = { type: "text", text: text.slice(0, 1900), quickReply: quickReply() };
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineMessagingToken}`,
      },
      body: JSON.stringify({ replyToken, messages: [message] }),
    });
    if (!res.ok) console.warn("[LINE bot] reply failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.warn("[LINE bot] reply error", (e as Error)?.message ?? e);
  }
}

async function askBot(uid: string, userText: string): Promise<string> {
  const history = getMem(uid);
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(t => ({ role: t.role, content: t.content }) as Message),
    { role: "user", content: userText },
  ];
  try {
    const r = await invokeLLM({ messages, maxTokens: 600 });
    const out = r.choices?.[0]?.message?.content;
    const text = typeof out === "string" ? out : Array.isArray(out) ? out.map((p: any) => p.text ?? "").join(" ") : "";
    const reply = (text || "").trim();
    if (!reply) throw new Error("empty reply");
    pushMem(uid, { role: "user", content: userText });
    pushMem(uid, { role: "assistant", content: reply });
    return reply;
  } catch (e) {
    console.warn("[LINE bot] LLM error", (e as Error)?.message ?? e);
    return "ขอโทษค่ะ ระบบขัดข้องชั่วคราว 🙏 ลองพิมพ์ใหม่อีกครั้ง หรือกด \"คุยกับแอดมิน\" ได้เลยค่ะ";
  }
}

async function handleEvent(ev: any): Promise<void> {
  if (!ev || !ev.replyToken) return;
  const uid: string = ev.source?.userId ?? "anon";

  if (ev.type === "follow") {
    await replyToLine(ev.replyToken, WELCOME);
    return;
  }
  if (ev.type === "message") {
    if (ev.message?.type === "text") {
      const text = String(ev.message.text || "").trim();
      if (!text) return;
      const reply = await askBot(uid, text);
      await replyToLine(ev.replyToken, reply);
    } else {
      await replyToLine(
        ev.replyToken,
        "ตอนนี้แชตนี้รับเป็นข้อความตัวอักษรนะคะ 🙏 ถ้าจะถ่ายรูปเสื้อผ้า/ตัวเองเพื่อประเมินราคาหรือจัดลุค กดเปิดแอปด้านล่างได้เลยค่ะ",
      );
    }
  }
}

export function registerLineBot(app: Express): void {
  app.post("/line/webhook", async (req: Request, res: Response) => {
    if (!verifySignature(req)) {
      console.warn("[LINE bot] invalid signature");
      res.status(401).end();
      return;
    }
    // Respond 200 immediately so LINE doesn't retry; process events after.
    res.status(200).end();
    const events: any[] = Array.isArray(req.body?.events) ? req.body.events : [];
    for (const ev of events) {
      handleEvent(ev).catch(e => console.warn("[LINE bot] handle error", (e as Error)?.message ?? e));
    }
  });

  // Friendly GET so you can confirm the route is live in a browser.
  app.get("/line/webhook", (_req, res) => {
    res.status(200).json({ ok: true, bot: "sheowa-line", configured: Boolean(ENV.lineMessagingToken) });
  });
}
