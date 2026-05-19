import type { NextApiRequest, NextApiResponse } from "next";
import { compileMql } from "@/lib/workfusion/mql-compiler";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = String(req.body?.code || "");
  const result = await compileMql({
    code,
    filename: String(req.body?.filename || ""),
    platform: String(req.body?.platform || ""),
  });
  return res.status(200).json(result);
}
