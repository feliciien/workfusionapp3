import type { NextApiRequest, NextApiResponse } from "next";
import { recordPageEvent } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const path = String(req.body?.path || "/").slice(0, 500);
  const referrer = String(req.body?.referrer || "").slice(0, 500);
  const url = String(req.body?.url || req.headers.referer || "").slice(0, 800);
  const intent = String(req.body?.intent || "").slice(0, 120);
  const explicitSourceTag = String(req.body?.sourceTag || "").slice(0, 120);
  const explicitConversionPath = String(req.body?.conversionPath || "").slice(0, 120);
  const attribution = attributionFrom({
    referrer,
    url,
    path,
    intent,
    sourceTag: explicitSourceTag,
    conversionPath: explicitConversionPath,
  });
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  const ok = await recordPageEvent({
    session: getSession(req),
    path,
    referrer,
    userAgent,
    metadata: {
      url,
      intent,
      sourceTag: attribution.sourceTag,
      conversionPath: attribution.conversionPath,
      eventSource: "page_view",
    },
  });

  return res.status(200).json({
    ok,
    storage: ok ? "postgres" : "local-json",
    sourceTag: attribution.sourceTag,
    conversionPath: attribution.conversionPath,
  });
}
