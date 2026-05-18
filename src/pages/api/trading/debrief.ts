import type { NextApiRequest, NextApiResponse } from "next";
import { featureAllowance, getPersistentAccess, limitReachedPayload, limitsAfterRun, recordUsageEvent } from "@/lib/workfusion/account-store";
import { aiMeta, askWorkfusionAi, numberField, stringArrayField, stringField } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";
import { debrief, scoreIdea } from "./_engine";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  const allowance = await featureAllowance(access, "debrief");
  if (!allowance.allowed) return res.status(402).json(limitReachedPayload(access, allowance));

  const score = scoreIdea(req.body || {});
  const review = debrief(req.body || {});
  const fallbackSummary = "Debrief complete. The report needs explicit risk, spread, and event-control evidence before live use.";
  const ai = await askWorkfusionAi({
    task: "debrief",
    payload: req.body || {},
    localBaseline: { ...score, ...review, summary: fallbackSummary },
    schema: {
      riskScore: "number 1-100",
      compliance: "number 1-100",
      fundingReadiness: "number 1-100",
      summary: "one concise report debrief summary",
      issues: "array of risk/evidence issues",
      fixes: "array of concrete fixes",
    },
  });
  const parsed = ai.parsed || {};
  await recordUsageEvent({ session: access.session, eventType: "feature_run", feature: "debrief", plan: access.plan });

  return res.status(200).json({
    riskScore: numberField(parsed.riskScore, score.riskScore),
    compliance: numberField(parsed.compliance, score.compliance),
    fundingReadiness: numberField(parsed.fundingReadiness, score.fundingReadiness),
    summary: stringField(parsed.summary, fallbackSummary),
    issues: stringArrayField(parsed.issues, review.issues),
    fixes: stringArrayField(parsed.fixes, review.fixes),
    feature: "debrief",
    plan: access.plan,
    remaining: limitsAfterRun(access, "debrief", allowance),
    ai: aiMeta(ai),
    storage: access.storage,
  });
}
