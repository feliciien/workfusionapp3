import type { NextApiRequest, NextApiResponse } from "next";
import { recordPageEvent } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const path = String(req.body?.path || "/").slice(0, 500);
  const referrer = String(req.body?.referrer || "").slice(0, 500);
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  const ok = await recordPageEvent({ session: getSession(req), path, referrer, userAgent });

  return res.status(200).json({
    ok,
    storage: ok ? "postgres" : "local-json",
  });
}
