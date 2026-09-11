import type { NextApiRequest, NextApiResponse } from "next";
import { growthSnapshot, updateGrowthLead } from "@/lib/workfusion/growth-store";
import { getSession } from "@/lib/workfusion/session";

function ownerAllowed(req: NextApiRequest) {
  const session = getSession(req);
  const token = String(req.headers["x-workfusion-admin-token"] || "");
  return (session.authenticated && session.role === "owner") || Boolean(process.env.WORKFUSION_ADMIN_TOKEN && token === process.env.WORKFUSION_ADMIN_TOKEN);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ownerAllowed(req)) return res.status(401).json({ error: "owner_auth_required" });

  if (req.method === "GET") {
    try {
      const snapshot = await growthSnapshot();
      return res.status(200).json(snapshot);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "growth_snapshot_failed" });
    }
  }

  if (req.method === "PATCH") {
    const lead = await updateGrowthLead({
      id: String(req.body?.id || ""),
      stage: req.body?.stage ? String(req.body.stage) : undefined,
      score: req.body?.score,
      notes: req.body?.notes === undefined ? undefined : String(req.body.notes),
      contacted: req.body?.contacted === true,
    });
    if (!lead) return res.status(404).json({ error: "lead_not_found" });
    return res.status(200).json({ ok: true, lead });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
