import type { NextApiRequest, NextApiResponse } from "next";
import { backtestEstimate } from "@/lib/workfusion/worker";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.body?.code || "");
  const idea = String(req.body?.idea || "");
  return res.status(200).json({
    worker: "backtest-estimator",
    ...backtestEstimate(code, idea),
  });
}
