import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/workfusion/session";
import { listProjectsPersistent, saveProjectPersistent } from "@/lib/workfusion/project-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSession(req);

  if (req.method === "GET") {
    const result = session.authenticated
      ? await listProjectsPersistent(session.id)
      : { storage: "none" as const, projects: [] };
    return res.status(200).json({
      storage: result.storage,
      authenticated: session.authenticated,
      authRequired: !session.authenticated,
      productionNote: result.storage === "postgres" ? "Postgres persistence active." : "Use Postgres for multi-user/serverless production.",
      projects: result.projects,
    });
  }

  if (req.method === "POST") {
    if (!session.authenticated) {
      return res.status(401).json({
        error: "login_required",
        message: "Sign in before saving projects so they stay attached to your account.",
      });
    }

    const result = await saveProjectPersistent({
      ownerId: session.id,
      title: String(req.body?.title || "Untitled EA project"),
      market: String(req.body?.market || "XAUUSD"),
      platform: req.body?.platform === "mt4" ? "mt4" : "mt5",
      idea: String(req.body?.idea || ""),
      propMode: Boolean(req.body?.propMode),
      riskScore: Number(req.body?.riskScore || 0),
      compliance: Number(req.body?.compliance || 0),
      code: String(req.body?.code || ""),
    });
    return res.status(200).json({ storage: result.storage, project: result.project });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
