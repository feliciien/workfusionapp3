import type { NextApiRequest, NextApiResponse } from "next";
import { getPersistentAccess } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));
  return res.status(200).json({
    user: access.session,
    access,
    auth: {
      mode: "signed_cookie",
      productionReady: true,
    },
  });
}
