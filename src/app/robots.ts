import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Client galleries, the admin area and checkout pages are private, so crawlers
// are kept to the public site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/proofs", "/photos", "/booking"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
