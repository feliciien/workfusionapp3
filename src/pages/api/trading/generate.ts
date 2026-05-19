import type { NextApiRequest, NextApiResponse } from "next";
import { featureAllowance, getPersistentAccess, limitReachedPayload, limitsAfterRun, recordUsageEvent } from "@/lib/workfusion/account-store";
import { aiMeta, askWorkfusionAi, numberField, stringField } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";
import { compileCheck } from "@/lib/workfusion/worker";
import { buildRecommendation, buildSummary, generateMql, scoreIdea } from "./_engine";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  const allowance = await featureAllowance(access, "generate");
  if (!allowance.allowed) return res.status(402).json(limitReachedPayload(access, allowance));

  const score = scoreIdea(req.body || {});
  const summary = buildSummary(req.body || {});
  const recommendation = buildRecommendation(req.body || {}, score);
  const fallbackCode = generateMql(req.body || {}, score);
  const ai = await askWorkfusionAi({
    task: "generate",
    payload: req.body || {},
    localBaseline: { ...score, summary, recommendation, mql5Code: fallbackCode },
    schema: {
      riskScore: "number 1-100",
      compliance: "number 1-100",
      fundingReadiness: "number 1-100",
      summary: "one concise product-ready sentence",
      recommendation: "one concise risk-first next step",
      mql5Code: "complete MT4/MT5 draft as a string",
    },
  });
  const parsed = ai.parsed || {};
  const aiCode = stringField(parsed.mql5Code, "");
  const aiCheck = compileCheck(aiCode);
  const fallbackCheck = compileCheck(fallbackCode);
  const useAiCode = aiCode.trim().length > 0 && aiCheck.status === "pass";
  const selectedCode = useAiCode ? aiCode : fallbackCode;
  const selectedCheck = useAiCode ? aiCheck : fallbackCheck;
  await recordUsageEvent({ session: access.session, eventType: "feature_run", feature: "generate", plan: access.plan });

  return res.status(200).json({
    riskScore: numberField(parsed.riskScore, score.riskScore),
    compliance: numberField(parsed.compliance, score.compliance),
    fundingReadiness: numberField(parsed.fundingReadiness, score.fundingReadiness),
    summary: stringField(parsed.summary, summary),
    recommendation: stringField(parsed.recommendation, recommendation),
    mql5Code: selectedCode,
    compile: selectedCheck,
    feature: "generate",
    plan: access.plan,
    remaining: limitsAfterRun(access, "generate", allowance),
    ai: { ...aiMeta(ai), generatedCodeAccepted: useAiCode, generatedCodeDiagnostics: aiCheck.diagnostics },
    storage: access.storage,
  });
}
