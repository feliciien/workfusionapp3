import type { NextApiRequest, NextApiResponse } from "next";
import { featureAllowance, getPersistentAccess, limitReachedPayload, limitsAfterRun, recordUsageEvent } from "@/lib/workfusion/account-store";
import { aiMeta, askWorkfusionAi, numberField, recordField, stringField } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";
import { optimize } from "./_engine";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  const allowance = await featureAllowance(access, "optimize");
  if (!allowance.allowed) return res.status(402).json(limitReachedPayload(access, allowance));

  const result = optimize(req.body || {});
  const fallbackSummary = "Optimized the draft for lower drawdown and clearer prop-firm constraints.";
  const fallbackRecommendation = "Validate the optimized settings in demo and reject the variant if drawdown worsens.";
  const ai = await askWorkfusionAi({
    task: "optimize",
    payload: req.body || {},
    localBaseline: { ...result, summary: fallbackSummary, recommendation: fallbackRecommendation },
    schema: {
      riskScore: "number 1-100",
      compliance: "number 1-100",
      fundingReadiness: "number 1-100",
      summary: "one concise optimization summary",
      recommendation: "one concise validation next step",
      params: "object of optimized EA parameters",
    },
  });
  const parsed = ai.parsed || {};
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
    session: access.session,
    eventType: "feature_run",
    feature: "optimize",
    plan: access.plan,
    metadata: {
      ...attribution,
      page,
      referrer,
      url,
      eventSource: "optimize_api",
    },
  });

  return res.status(200).json({
    riskScore: numberField(parsed.riskScore, result.riskScore),
    compliance: numberField(parsed.compliance, result.compliance),
    fundingReadiness: numberField(parsed.fundingReadiness, result.fundingReadiness),
    params: recordField(parsed.params, result.params),
    summary: stringField(parsed.summary, fallbackSummary),
    recommendation: stringField(parsed.recommendation, fallbackRecommendation),
    feature: "optimize",
    plan: access.plan,
    remaining: limitsAfterRun(access, "optimize", allowance),
    ai: aiMeta(ai),
    storage: access.storage,
  });
}
