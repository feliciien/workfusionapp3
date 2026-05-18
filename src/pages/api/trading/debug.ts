import type { NextApiRequest, NextApiResponse } from "next";
import { featureAllowance, getPersistentAccess, limitReachedPayload, limitsAfterRun, recordUsageEvent } from "@/lib/workfusion/account-store";
import { aiMeta, askWorkfusionAi, stringArrayField, stringField } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";
import { fixedMql } from "./_engine";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  const allowance = await featureAllowance(access, "debug");
  if (!allowance.allowed) return res.status(402).json(limitReachedPayload(access, allowance));

  const fallbackCode = fixedMql(req.body || {});
  const fallbackIssues = ["Missing declarations or platform-specific lifecycle issues may exist in the original code"];
  const fallbackFixes = ["Use strict mode", "Declare account state once", "Keep entry logic inside OnTick"];
  const fallbackSummary = "The debugger produced a clean EA scaffold and highlighted where final trading logic should be merged.";
  const ai = await askWorkfusionAi({
    task: "debug",
    payload: req.body || {},
    localBaseline: {
      summary: fallbackSummary,
      fixedCode: fallbackCode,
      issues: fallbackIssues,
      fixes: fallbackFixes,
    },
    schema: {
      summary: "one concise debug summary",
      fixedCode: "clean compile-aware MQL draft as a string",
      issues: "array of concrete compiler/risk issues",
      fixes: "array of concrete fixes",
    },
  });
  const parsed = ai.parsed || {};
  await recordUsageEvent({ session: access.session, eventType: "feature_run", feature: "debug", plan: access.plan });

  return res.status(200).json({
    status: "Fixed draft generated",
    summary: stringField(parsed.summary, fallbackSummary),
    fixedCode: stringField(parsed.fixedCode, fallbackCode),
    issues: stringArrayField(parsed.issues, fallbackIssues),
    fixes: stringArrayField(parsed.fixes, fallbackFixes),
    feature: "debug",
    plan: access.plan,
    remaining: limitsAfterRun(access, "debug", allowance),
    ai: aiMeta(ai),
    storage: access.storage,
  });
}
