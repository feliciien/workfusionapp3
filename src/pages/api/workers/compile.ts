import type { NextApiRequest, NextApiResponse } from "next";
import { compileCheck } from "@/lib/workfusion/worker";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.body?.code || "");
  return res.status(200).json({
    worker: "static-mql-precheck",
    ...compileCheck(code),
  });
}
