import type { Metadata } from "next";
import { GrowthCommandCenter } from "@/components/workfusion/GrowthCommandCenter";

export const metadata: Metadata = {
  title: "Workfusion Growth Command Center",
  description: "Owner-only CRM and growth command center for Workfusion EA builder leads, support, and SEO acquisition.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GrowthPage() {
  return <GrowthCommandCenter />;
}
