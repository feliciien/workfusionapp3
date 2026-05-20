import type { NextApiRequest, NextApiResponse } from "next";
import { featureAllowance, getPersistentAccess, limitReachedPayload, limitsAfterRun, recordUsageEvent } from "@/lib/workfusion/account-store";
import { aiMeta, askWorkfusionAi, stringArrayField, stringField } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";
import { compileCheck } from "@/lib/workfusion/worker";
import { fixedMql } from "./_engine";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  const allowance = await featureAllowance(access, "debug");
  if (!allowance.allowed) return res.status(402).json(limitReachedPayload(access, allowance));

  const payload = req.body || {};
  const errorText = `${String(payload.errors || "")} ${String(payload.code || "")}`;
  const invalidStopsContext = /invalid stops|retcode\s*=?\s*10016|error\s*130|stop loss|stoploss/iu.test(errorText);
  const fallbackCode = fixedMql(payload);
  const fallbackIssues = invalidStopsContext
    ? [
      "Invalid stops are execution validation failures, not normal compiler errors.",
      "The EA must validate SL/TP against live Bid/Ask, current spread, stop level, and freeze level before sending the request.",
      "A small XAUUSD stop can be inside the spread even when a manual or pending-order test appears to work.",
    ]
    : ["Missing declarations or platform-specific lifecycle issues may exist in the original code"];
  const fallbackFixes = invalidStopsContext
    ? [
      "Add SYMBOL_TRADE_STOPS_LEVEL and SYMBOL_TRADE_FREEZE_LEVEL validation.",
      "For buy orders, validate SL below Bid and TP above Ask by enough points.",
      "For sell orders, validate SL above Ask and TP below Bid by enough points.",
      "Log Bid, Ask, spread, SL, TP, minimum distance, retcode, and retcode description for every failed request.",
    ]
    : ["Use strict mode", "Declare account state once", "Keep entry logic inside OnTick"];
  const fallbackSummary = invalidStopsContext
    ? "The debugger detected an MT5 invalid-stops pattern and produced a replacement EA draft with spread, stop-level, freeze-level, and retcode diagnostics."
    : "The debugger produced a complete compile-aware EA replacement with risk gates and execution logic.";
  const ai = await askWorkfusionAi({
    task: "debug",
    payload,
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
  const aiFixedCode = stringField(parsed.fixedCode, "");
  const aiCheck = compileCheck(aiFixedCode);
  const fallbackCheck = compileCheck(fallbackCode);
  const useAiCode = aiFixedCode.trim().length > 0 && aiCheck.status === "pass";
  const fixedCode = useAiCode ? aiFixedCode : fallbackCode;
  const compile = useAiCode ? aiCheck : fallbackCheck;
  const page = String(req.body?.page || req.headers.referer || "/");
  const referrer = String(req.body?.referrer || req.headers.referer || "");
  const url = String(req.body?.url || req.headers.referer || "");
  const attribution = attributionFrom({
    referrer,
    url,
    path: page,
    intent: "compiler_error",
    sourceTag: String(req.body?.sourceTag || ""),
    conversionPath: String(req.body?.conversionPath || ""),
  });
  await recordUsageEvent({
    session: access.session,
    eventType: "first_useful_output",
    feature: "debug",
    plan: access.plan,
    metadata: {
      ...attribution,
      page,
      referrer,
      url,
      platform: String(req.body?.platform || ""),
      hasErrors: Boolean(String(req.body?.errors || "").trim()),
      eventSource: "debug_api",
    },
  });

  return res.status(200).json({
    status: "Fixed draft generated",
    summary: stringField(parsed.summary, fallbackSummary),
    fixedCode,
    compile,
    issues: stringArrayField(parsed.issues, fallbackIssues),
    fixes: stringArrayField(parsed.fixes, fallbackFixes),
    feature: "debug",
    plan: access.plan,
    remaining: limitsAfterRun(access, "debug", allowance),
    ai: { ...aiMeta(ai), fixedCodeAccepted: useAiCode, fixedCodeDiagnostics: aiCheck.diagnostics },
    storage: access.storage,
  });
}
