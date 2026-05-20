import type { NextApiRequest, NextApiResponse } from "next";
import { analyzeGrowthIntelligence } from "@/lib/workfusion/openai";
import { growthIntelligenceTelemetry } from "@/lib/workfusion/growth-store";
import { getSession } from "@/lib/workfusion/session";

function ownerAllowed(req: NextApiRequest) {
  const session = getSession(req);
  const token = String(req.headers["x-workfusion-admin-token"] || "");
  return (session.authenticated && session.role === "owner") || Boolean(process.env.WORKFUSION_ADMIN_TOKEN && token === process.env.WORKFUSION_ADMIN_TOKEN);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ownerAllowed(req)) return res.status(401).json({ error: "owner_auth_required" });
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const telemetry = await growthIntelligenceTelemetry();
    const intelligence = await analyzeGrowthIntelligence(telemetry);
    return res.status(200).json({
      ok: true,
      telemetry: {
        funnel: telemetry.funnel,
        pages: telemetry.snapshot.pages,
        usageByFeature30d: telemetry.usageByFeature30d,
        topReferrers30d: telemetry.topReferrers30d,
        sourceTags30d: telemetry.sourceTags30d,
        conversionPaths30d: telemetry.conversionPaths30d,
        funnelEvents30d: telemetry.funnelEvents30d,
        supportByCategory30d: telemetry.supportByCategory30d,
      },
      intelligence,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "growth_intelligence_failed" });
  }
}
