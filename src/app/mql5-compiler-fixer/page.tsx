import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/workfusion/SeoLandingPage";
import { seoLandings } from "@/lib/workfusion/seo-pages";

const page = seoLandings["mql5-compiler-fixer"];

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.description,
  alternates: { canonical: `/${page.slug}` },
};

export default function Mql5CompilerFixerPage() {
  return <SeoLandingPage page={page} />;
}
