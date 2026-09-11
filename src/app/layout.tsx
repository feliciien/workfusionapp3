import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workfusion Trading AI | Build, Debug and Govern MT4/MT5 EAs",
  description:
    "Build, debug, and govern MT4/MT5 Expert Advisors with compiler support, prop-firm payout readiness, drawdown buffers, and PDF governance reports.",
  applicationName: "Workfusion Trading AI",
  keywords: [
    "MT4 EA generator",
    "MT5 EA generator",
    "MQL5 debugger",
    "Expert Advisor builder",
    "FTMO risk checker",
    "prop firm trading tools",
  ],
  metadataBase: new URL("https://www.workfusionapp.com"),
  openGraph: {
    title: "Workfusion Trading AI",
    description: "Build, debug, and govern MT4/MT5 Expert Advisors with payout readiness and risk reporting.",
    url: "https://www.workfusionapp.com",
    siteName: "Workfusion Trading AI",
    type: "website",
    images: ["/brand/workfusion-og.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workfusion Trading AI",
    description: "Build, debug, and govern MT4/MT5 automation with a risk desk built in.",
    images: ["/brand/workfusion-og.svg"],
  },
  icons: {
    icon: "/brand/workfusion-mark.svg",
    apple: "/brand/workfusion-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
