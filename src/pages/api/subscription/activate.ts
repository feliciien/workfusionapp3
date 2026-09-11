import type { NextApiRequest, NextApiResponse } from "next";
import { upsertPersistentSubscription } from "@/lib/workfusion/account-store";
import { queueActivationEmail } from "@/lib/workfusion/outbox";
import { upsertSubscription } from "@/lib/workfusion/subscription-store";
import type { WorkfusionPlan } from "@/lib/workfusion/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.headers["x-workfusion-admin-token"] || req.body?.token || "");
  if (!process.env.WORKFUSION_ADMIN_TOKEN || token !== process.env.WORKFUSION_ADMIN_TOKEN) {
    return res.status(401).json({ error: "Admin activation token required" });
  }

  const email = String(req.body?.email || process.env.WORKFUSION_OWNER_EMAIL || "").toLowerCase();
  const plan = (String(req.body?.plan || "pro").toLowerCase() as WorkfusionPlan) || "pro";
  const provider = req.body?.provider === "paypal" ? "paypal" : req.body?.provider === "stripe" ? "stripe" : "manual";
  if (!email) return res.status(400).json({ error: "email required" });

  const subscription = upsertSubscription({
    email,
    plan,
    provider,
    providerRef: String(req.body?.providerRef || "manual-activation"),
    status: "active",
  });
  const persistent = await upsertPersistentSubscription({
    email,
    plan,
    provider,
    providerRef: String(req.body?.providerRef || "manual-activation"),
    status: "active",
  });
  const emailRecord = queueActivationEmail(email, plan, provider);

  return res.status(200).json({
    status: "premium_active",
    subscription: persistent.storage === "postgres" ? persistent : subscription,
    storage: persistent.storage,
    emailQueued: emailRecord.mode,
  });
}
