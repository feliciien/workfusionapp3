import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";
import { backtestEstimate } from "@/lib/workfusion/worker";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.body?.code || "");
  const idea = String(req.body?.idea || "");
  const page = String(req.body?.page || req.headers.referer || "/");
  const referrer = String(req.body?.referrer || req.headers.referer || "");
  const url = String(req.body?.url || req.headers.referer || "");
  const estimate = backtestEstimate(code, idea);
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
    eventType: "backtest_estimate_completed",
    feature: "backtest_estimate",
    metadata: {
      ...attribution,
      page,
      referrer,
      url,
      status: estimate.status,
      trades: estimate.trades,
      profitFactor: estimate.profitFactor,
      maxDrawdown: estimate.maxDrawdown,
      fundingReadiness: estimate.fundingReadiness,
      eventSource: "backtest_api",
    },
  });
  return res.status(200).json({
    worker: "backtest-estimator",
    ...estimate,
  });
}
