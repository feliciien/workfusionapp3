import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie } from "@/lib/workfusion/session";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({
    status: "signed_out",
    message: "Session cleared.",
  });
}
