/**
 * Where this app lives. Invitation links and metadata must use the canonical
 * domain even when the code is running on a preview deployment, so this is a
 * configured value rather than window.location.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_ENV === "production"
    ? "https://calendar.docmaker.studio"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "CouplesCalendar";
