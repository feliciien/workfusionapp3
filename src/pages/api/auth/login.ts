import type { NextApiRequest, NextApiResponse } from "next";
import { getPersistentSubscription, upsertUser } from "@/lib/workfusion/account-store";
import { createSessionCookie, isValidEmail, normalizeEmail, PLAN_LIMITS } from "@/lib/workfusion/session";
import { envOwnerPremium, getSubscription } from "@/lib/workfusion/subscription-store";
import type { WorkfusionPlan } from "@/lib/workfusion/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = normalizeEmail(req.body?.email);
  const ownerEmail = normalizeEmail(process.env.WORKFUSION_OWNER_EMAIL);
  const ownerToken = String(req.body?.ownerToken || "");

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "valid_email_required", message: "Enter a valid email address." });
  }

  const isOwnerEmail = ownerEmail && email === ownerEmail;
  if (isOwnerEmail && ownerToken !== process.env.WORKFUSION_ADMIN_TOKEN) {
    return res.status(401).json({
      error: "owner_token_required",
      message: "Owner email requires the private owner token before premium access is unlocked.",
    });
  }

  const subscription = (await getPersistentSubscription(email)) || getSubscription(email);
  const premium = subscription?.status === "active" || envOwnerPremium(email);
  const plan: WorkfusionPlan = premium ? subscription?.plan || "pro" : "free";
  const persisted = await upsertUser({ email, role: isOwnerEmail ? "owner" : "user", plan, lastLogin: true });
  res.setHeader("Set-Cookie", createSessionCookie(email, isOwnerEmail ? "owner" : "user", plan));
  return res.status(200).json({
    status: "signed_in",
    user: {
      email,
      role: isOwnerEmail ? "owner" : "user",
      authenticated: true,
    },
    access: {
      status: premium ? "premium" : "free",
      plan,
      subscription,
      limits: PLAN_LIMITS[plan],
      storage: persisted.storage,
      session: {
        id: persisted.id,
        email,
        role: isOwnerEmail ? "owner" : "user",
        plan,
        authenticated: true,
      },
    },
  });
}
