import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/workfusion/SeoLandingPage";
import { seoLandings } from "@/lib/workfusion/seo-pages";

const page = seoLandings["prop-firm-ea-risk-checker"];

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.description,
  alternates: { canonical: `/${page.slug}` },
};

export default function PropFirmEaRiskCheckerPage() {
  return <SeoLandingPage page={page} />;
}
