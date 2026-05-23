import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { aiRouter } from "./routers/ai";
import { historyRouter } from "./routers/history";
import { listingRouter } from "./routers/listing";
import { wardrobeRouter } from "./routers/wardrobe";
// ─── Matching / lookbook (ported from ai_digital_wardrobe) ───
import { matchingRouter, profileRouter, outfitsRouter } from "./routers/matching";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ai: aiRouter,
  history: historyRouter,
  listing: listingRouter,
  wardrobe: wardrobeRouter,
  // ─── New: outfit matching / lookbook / style profile ───
  profile: profileRouter,
  matching: matchingRouter,
  outfits: outfitsRouter,
});

export type AppRouter = typeof appRouter;
