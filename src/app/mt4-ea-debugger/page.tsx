import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/workfusion/SeoLandingPage";
import { seoLandings } from "@/lib/workfusion/seo-pages";

const page = seoLandings["mt4-ea-debugger"];

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.description,
  alternates: { canonical: `/${page.slug}` },
};

export default function Mt4EaDebuggerPage() {
  return <SeoLandingPage page={page} />;
}
