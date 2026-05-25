// LINE Login (OAuth 2.1) — real user auth, replaces Manus OAuth / dev-login.
// Reuses the existing session: after LINE auth we upsert the user and sign the
// SAME session JWT (sdk.signSession) that sdk.authenticateRequest already reads,
// so the tRPC context needs no change.
//
// Required env (.env):
//   LINE_CHANNEL_ID
//   LINE_CHANNEL_SECRET
//   LINE_CALLBACK_URL   (must EXACTLY match the Callback URL in the LINE console,
//                        e.g. http://localhost:3000/api/line/callback)

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { upsertUser } from "../db";

const STATE_COOKIE = "line_oauth_state";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function isConfigured() {
  return Boolean(ENV.lineChannelId && ENV.lineChannelSecret);
}

function isSecureReq(req: Request) {
  if (req.protocol === "https") return true;
  const xf = req.headers["x-forwarded-proto"];
  const list = Array.isArray(xf) ? xf : (xf ?? "").split(",");
  return list.some(p => p.trim().toLowerCase() === "https");
}

function callbackUrl(req: Request) {
  if (ENV.lineCallbackUrl) return ENV.lineCallbackUrl;
  const proto = isSecureReq(req) ? "https" : "http";
  return `${proto}://${req.get("host")}/api/line/callback`;
}

function sessionCookieOptions(req: Request) {
  const secure = isSecureReq(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
    maxAge: SESSION_MS,
    // Share the cookie across sheowa.com + app.sheowa.com when configured.
    domain: ENV.cookieDomain || undefined,
  };
}

export function registerLineRoutes(app: Express) {
  app.get("/api/line/login", (req: Request, res: Response) => {
    if (!isConfigured()) {
      res
        .status(503)
        .send("LINE login not configured. Set LINE_CHANNEL_ID and LINE_CHANNEL_SECRET in .env.");
      return;
    }
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isSecureReq(req),
      maxAge: 10 * 60 * 1000,
    });
    const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", ENV.lineChannelId);
    url.searchParams.set("redirect_uri", callbackUrl(req));
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "profile openid");
    res.redirect(url.toString());
  });

  app.get("/api/line/callback", async (req: Request, res: Response) => {
    try {
      if (!isConfigured()) {
        res.status(503).send("LINE login not configured.");
        return;
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const cookieState = (req.headers.cookie || "")
        .split(";")
        .map(s => s.trim())
        .find(s => s.startsWith(STATE_COOKIE + "="))
        ?.split("=")[1];

      if (!code || !state || !cookieState || state !== cookieState) {
        res.status(400).send("Invalid OAuth state. Please try logging in again.");
        return;
      }

      // 1) Exchange the authorization code for tokens.
      const tokenResp = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl(req),
          client_id: ENV.lineChannelId,
          client_secret: ENV.lineChannelSecret,
        }),
      });
      if (!tokenResp.ok) {
        const t = await tokenResp.text().catch(() => "");
        console.error("[LINE] token exchange failed:", tokenResp.status, t);
        res.status(502).send("LINE token exchange failed.");
        return;
      }
      const tokenJson = (await tokenResp.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        res.status(502).send("No access token returned from LINE.");
        return;
      }

      // 2) Fetch the LINE profile.
      const profResp = await fetch("https://api.line.me/v2/profile", {
        headers: { authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profResp.ok) {
        res.status(502).send("Failed to fetch LINE profile.");
        return;
      }
      const profile = (await profResp.json()) as {
        userId: string;
        displayName?: string;
      };

      const openId = `line:${profile.userId}`;
      const name = profile.displayName || "LINE User";

      // 3) Upsert the user, then sign the standard session cookie.
      await upsertUser({ openId, name, loginMethod: "line" });
      const token = await sdk.signSession(
        { openId, appId: "line-login", name },
        { expiresInMs: SESSION_MS },
      );

      res.clearCookie(STATE_COOKIE, { path: "/" });
      res.cookie(COOKIE_NAME, token, sessionCookieOptions(req));
      res.redirect("/");
    } catch (err) {
      console.error("[LINE] callback error:", err);
      res.status(500).send("LINE login error.");
    }
  });

  app.get("/api/line/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/", domain: ENV.cookieDomain || undefined });
    res.redirect("/");
  });
}
