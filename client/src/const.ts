export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login now goes through LINE Login (server route /api/line/login).
// The server redirects to LINE, then back to /api/line/callback which sets the
// session cookie. Manus OAuth is no longer used.
export const getLoginUrl = () => "/api/line/login";
