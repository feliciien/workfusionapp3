import type { MetadataRoute } from "next";
import { seoSlugs } from "@/lib/workfusion/seo-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.workfusionapp.com";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/legal`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ...seoSlugs.map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
