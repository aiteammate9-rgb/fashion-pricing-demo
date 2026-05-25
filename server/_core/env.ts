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
  // LINE Messaging API (push flex cards / order notifications).
  // Set LINE_MESSAGING_TOKEN in the environment (never commit it).
  lineMessagingToken: process.env.LINE_MESSAGING_TOKEN ?? "",
  // Shared cookie domain so login works across sheowa.com + app.sheowa.com.
  // Set COOKIE_DOMAIN=.sheowa.com in production; leave empty for localhost.
  cookieDomain: process.env.COOKIE_DOMAIN ?? "",
};
