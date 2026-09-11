import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { compileMql } from "@/lib/workfusion/mql-compiler";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.body?.code || "");
  const page = String(req.body?.page || req.headers.referer || "/");
  const referrer = String(req.body?.referrer || req.headers.referer || "");
  const url = String(req.body?.url || req.headers.referer || "");
  const result = await compileMql({
    code,
    filename: String(req.body?.filename || ""),
    platform: String(req.body?.platform || ""),
  });
  const attribution = attributionFrom({
    referrer,
    url,
    path: page,
    intent: "compiler_error",
    sourceTag: String(req.body?.sourceTag || ""),
    conversionPath: String(req.body?.conversionPath || ""),
  });
  await recordUsageEvent({
    session: getSession(req),
    eventType: "compile_check_completed",
    feature: "compile_check",
    metadata: {
      ...attribution,
      page,
      referrer,
      url,
      platform: String(req.body?.platform || ""),
      filename: String(req.body?.filename || ""),
      compiled: result.compiled,
      status: result.status,
      worker: result.worker,
      compilerMode: result.compiler.mode,
      eventSource: "compile_api",
    },
  });
  return res.status(200).json(result);
}
