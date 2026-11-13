// The address search engines should list. Production always uses the custom
// domain, so the copy on bmarvld.vercel.app points Google back here instead of
// competing with it. Previews and local dev use their own address.
export const SITE_URL =
  process.env.VERCEL_ENV === "production"
    ? "https://bmarvld.com"
    : (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
