import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { upsertUser, getUserByOpenId } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// DEV-ONLY local login bypass. Enable by setting DEV_LOGIN=1 in .env.
// Lets you test protected features (wardrobe save, matching, lookbook) locally
// WITHOUT Manus OAuth. Auto-creates a single fake user in the DB.
// This branch never runs when NODE_ENV=production.
const DEV_OPEN_ID = "dev-local";

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1") {
    try {
      await upsertUser({ openId: DEV_OPEN_ID, name: "Dev User", loginMethod: "dev" });
      user = (await getUserByOpenId(DEV_OPEN_ID)) ?? null;
    } catch (error) {
      console.warn("[Auth] dev-login bypass failed:", error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
