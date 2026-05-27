export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  retailedApiKey: process.env.RETAILED_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
  // Cloudinary storage (replaces Manus Forge storage)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  // LINE Login
  lineChannelId: process.env.LINE_CHANNEL_ID ?? "",
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
  lineCallbackUrl: process.env.LINE_CALLBACK_URL ?? "",
  // LINE Messaging API (push flex cards / order notifications + AI chat bot).
  // Set LINE_MESSAGING_TOKEN in the environment (never commit it).
  lineMessagingToken: process.env.LINE_MESSAGING_TOKEN ?? "",
  // Channel secret of the **Messaging API** channel — used to verify the
  // x-line-signature header on the /line/webhook bot endpoint. (Separate from
  // the LINE Login channel secret above.) Set LINE_MESSAGING_SECRET in Render.
  lineMessagingSecret: process.env.LINE_MESSAGING_SECRET ?? "",
  // Human-handoff contact shown when the bot escalates ("คุยกับแอดมิน").
  // e.g. https://line.me/R/ti/p/@sheowa  — set LINE_ADMIN_URL in Render.
  lineAdminUrl: process.env.LINE_ADMIN_URL ?? "",
  // Shared cookie domain so login works across sheowa.com + app.sheowa.com.
  // Set COOKIE_DOMAIN=.sheowa.com in production; leave empty for localhost.
  cookieDomain: process.env.COOKIE_DOMAIN ?? "",
  // Secret guarding the daily outfit-calendar cron endpoint
  // (/api/cron/daily-outfit?key=...). Set CRON_SECRET in Render; the external
  // scheduler (e.g. cron-job.org) must send the same value.
  cronSecret: process.env.CRON_SECRET ?? "",
};
