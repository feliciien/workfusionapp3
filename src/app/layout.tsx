import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkFusionApp | Proprietary Trading Evaluation & Funding",
  description:
    "WorkFusionApp is an AI-powered proprietary trading evaluation and funding firm. Sell trading evaluations, fund proven traders, and discover quantitative talent for BoltIQ Capital.",
  applicationName: "WorkFusionApp",
  keywords: [
    "proprietary trading firm",
    "trading challenge",
    "prop firm evaluation",
    "funded trader program",
    "quantitative talent discovery",
    "trading evaluation platform",
    "BoltIQ Capital",
    "trading assessment",
    "funded accounts",
    "trading profit share"
  ],
  metadataBase: new URL("https://www.workfusionapp.com"),
  openGraph: {
    title: "WorkFusionApp | Proprietary Trading Evaluation & Funding",
    description: "WorkFusionApp is an AI-powered proprietary trading evaluation and funding firm built to identify disciplined traders, fund proven performance, and develop quantitative trading talent.",
    url: "https://www.workfusionapp.com",
    siteName: "WorkFusionApp",
    type: "website",
    images: ["/brand/workfusion-mark.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkFusionApp | Proprietary Trading Evaluation & Funding",
    description: "WorkFusionApp evaluates traders through structured challenges, funds proven performers, and identifies elite talent for quantitative opportunities.",
    images: ["/brand/workfusion-mark.svg"],
  },
  icons: {
    icon: "/brand/workfusion-mark.svg",
    apple: "/brand/workfusion-mark.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
