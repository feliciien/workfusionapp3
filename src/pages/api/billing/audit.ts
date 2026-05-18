import type { NextApiRequest, NextApiResponse } from "next";
import { getPaypalAccessToken } from "@/lib/workfusion/paypal";
import { getSession } from "@/lib/workfusion/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = getSession(req);
  const token = String(req.headers["x-workfusion-admin-token"] || "");
  const ownerAllowed = session.authenticated && session.role === "owner";
  const tokenAllowed = Boolean(process.env.WORKFUSION_ADMIN_TOKEN && token === process.env.WORKFUSION_ADMIN_TOKEN);
  if (!ownerAllowed && !tokenAllowed) {
    return res.status(401).json({ error: "owner_auth_required" });
  }

  const checks: Record<string, unknown> = {
    mode: process.env.WORKFUSION_BILLING_MODE === "live" ? "live" : "safe_preview",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    stripe: {
      secretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      secretMode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : process.env.STRIPE_SECRET_KEY ? "test_or_unknown" : "missing",
      ready: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STARTER && process.env.STRIPE_PRICE_PRO && process.env.STRIPE_PRICE_STUDIO),
      prices: {
        starter: Boolean(process.env.STRIPE_PRICE_STARTER),
        pro: Boolean(process.env.STRIPE_PRICE_PRO),
        studio: Boolean(process.env.STRIPE_PRICE_STUDIO),
      },
    },
    paypal: {
      clientConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      apiBase: (process.env.PAYPAL_API_BASE || "").replace(/\/$/, ""),
      monthlyPlanConfigured: Boolean(process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID),
      yearlyPlanConfigured: Boolean(process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID),
      oauth: "not_checked",
    },
  };

  if (req.query.deep === "1" && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    try {
      await getPaypalAccessToken();
      (checks.paypal as { oauth: string }).oauth = "pass";
    } catch (error) {
      (checks.paypal as { oauth: string; oauthError?: string }).oauth = "fail";
      (checks.paypal as { oauth: string; oauthError?: string }).oauthError =
        error instanceof Error ? error.message : "unknown";
    }
  }

  return res.status(200).json(checks);
}
