import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { evaluatePayoutGovernance } from "@/lib/workfusion/governance";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const result = evaluatePayoutGovernance(req.body || {});
  const page = String(req.body?.page || req.headers.referer || "/");
  const referrer = String(req.body?.referrer || req.headers.referer || "");
  const url = String(req.body?.url || req.headers.referer || "");
  const attribution = attributionFrom({
    referrer,
    url,
    path: page,
    intent: "risk_check",
    sourceTag: String(req.body?.sourceTag || ""),
    conversionPath: String(req.body?.conversionPath || ""),
  });

  await recordUsageEvent({
    session: getSession(req),
    eventType: "governance_check_completed",
    feature: "governance",
    metadata: {
      ...attribution,
      page,
      referrer,
      url,
      firm: result.firm,
      status: result.status,
      targetRemaining: result.metrics.targetRemaining,
      dailyLossRemainingPct: result.metrics.dailyLossRemainingPct,
      totalLossRemainingPct: result.metrics.totalLossRemainingPct,
      eventSource: "governance_api",
    },
  });

  return res.status(200).json({
    worker: "workfusion-govern",
    ...result,
  });
}
