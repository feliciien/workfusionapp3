import type { NextApiRequest, NextApiResponse } from "next";
import { getPersistentAccess } from "@/lib/workfusion/account-store";
import { workfusionModel } from "@/lib/workfusion/openai";
import { getSession } from "@/lib/workfusion/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const access = await getPersistentAccess(getSession(req));

  return res.status(200).json({
    storage: access.storage,
    status: access.status,
    plan: access.plan,
    authenticated: access.session.authenticated,
    user: {
      email: access.session.email,
      role: access.session.role,
      authenticated: access.session.authenticated,
    },
    subscription: access.subscription,
    limits: access.limits,
    billing: {
      mode: process.env.WORKFUSION_BILLING_MODE === "live" ? "live" : "safe_preview",
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO),
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    },
    ai: {
      provider: "openai",
      model: workfusionModel(),
      configured: Boolean(process.env.OPENAI_API_KEY),
      api: "responses",
    },
    message: "PayPal checkout is the active billing path. Stripe remains parked until valid live price IDs and a working key are available.",
  });
}
