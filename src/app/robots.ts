import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/growth", "/api/"],
    },
    sitemap: "https://www.workfusionapp.com/sitemap.xml",
  };
}
