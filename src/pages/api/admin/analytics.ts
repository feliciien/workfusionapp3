import type { NextApiRequest, NextApiResponse } from "next";
import { analyticsSnapshot } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";

function maskEmail(email: string) {
  return email.replace(/^(.).*(@.*)$/u, "$1***$2");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = getSession(req);
  const token = String(req.headers["x-workfusion-admin-token"] || "");
  const ownerAllowed = session.authenticated && session.role === "owner";
  const tokenAllowed = Boolean(process.env.WORKFUSION_ADMIN_TOKEN && token === process.env.WORKFUSION_ADMIN_TOKEN);
  if (!ownerAllowed && !tokenAllowed) {
    return res.status(401).json({ error: "owner_auth_required" });
  }

  try {
    const snapshot = await analyticsSnapshot();
    return res.status(200).json({
      storage: snapshot.storage,
      counts: snapshot.counts,
      emailsMasked: snapshot.emails.map(maskEmail),
      emailsReturned: snapshot.emails.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "analytics_failed" });
  }
}
