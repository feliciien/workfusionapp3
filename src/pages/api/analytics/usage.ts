import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";
import type { WorkfusionPlan } from "@/lib/workfusion/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const eventType = String(req.body?.eventType || "").trim().slice(0, 120);
  const feature = String(req.body?.feature || "").trim().slice(0, 120);
  const plan = String(req.body?.plan || "free").trim().slice(0, 40);
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
    ? req.body.metadata as Record<string, unknown>
    : {};

  if (!eventType) return res.status(400).json({ error: "event_type_required" });

  const ok = await recordUsageEvent({
    session: getSession(req),
    eventType,
    feature: feature || undefined,
    plan: plan as WorkfusionPlan,
    metadata: {
      ...metadata,
      page: String(req.body?.page || req.headers.referer || "").slice(0, 500),
    },
  });

  return res.status(200).json({
    ok,
    storage: ok ? "postgres" : "local-json",
  });
}
