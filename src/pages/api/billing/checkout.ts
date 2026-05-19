import type { NextApiRequest, NextApiResponse } from "next";
import { upsertUser } from "@/lib/workfusion/account-store";
import { getSession } from "@/lib/workfusion/session";
import { createSessionCookie, isValidEmail, normalizeEmail } from "@/lib/workfusion/session";
import { createPaypalSubscription } from "@/lib/workfusion/paypal";

const priceEnv: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  studio: process.env.STRIPE_PRICE_STUDIO,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const plan = String(req.body?.plan || "starter").toLowerCase();
  const provider = String(req.body?.provider || "paypal").toLowerCase();
  const liveEnabled = process.env.WORKFUSION_BILLING_MODE === "live";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.workfusionapp.com";
  const session = getSession(req);
  const email = session.authenticated ? session.email : normalizeEmail(req.body?.email);
  const paidPlans = new Set(["starter", "pro", "studio"]);

  if (plan === "free") {
    return res.status(200).json({
      provider,
      plan,
      message: "Free plan is active without checkout.",
    });
  }

  if (!paidPlans.has(plan)) {
    return res.status(400).json({ error: "invalid_plan", message: "Choose starter, pro, or studio." });
  }

  if (!session.authenticated && !isValidEmail(email)) {
    return res.status(400).json({
      error: "email_required",
      message: "Enter a valid email so the subscription can be attached to your Workfusion account.",
    });
  }

  if (!session.authenticated) {
    const ownerEmail = normalizeEmail(process.env.WORKFUSION_OWNER_EMAIL);
    const ownerToken = String(req.body?.ownerToken || "");
    const role = ownerEmail && email === ownerEmail && ownerToken === process.env.WORKFUSION_ADMIN_TOKEN ? "owner" : "user";
    await upsertUser({ email, role, plan: "free", lastLogin: true });
    res.setHeader("Set-Cookie", createSessionCookie(email, role, "free"));
  }

  if (!liveEnabled) {
    return res.status(200).json({
      mode: "safe_preview",
      provider,
      plan,
      sessionAttached: true,
      configured: {
        stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO),
        paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      },
      message: "Billing endpoint is wired in safe mode. Enable live billing plus provider plan IDs to create real checkout sessions.",
    });
  }

  if (provider === "paypal") {
    try {
      const paypal = await createPaypalSubscription({
        plan,
        email,
        successUrl: `${appUrl}/pricing?paypal=success&plan=${plan}`,
        cancelUrl: `${appUrl}/pricing?paypal=cancelled&plan=${plan}`,
      });
      const approval = paypal.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href;
      return res.status(200).json({
        provider: "paypal",
        plan,
        id: paypal.id,
        status: paypal.status,
        url: approval,
        sessionAttached: true,
        message: approval ? "PayPal subscription approval URL created." : "PayPal subscription created without approval URL.",
      });
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "PayPal checkout failed" });
    }
  }

  if (provider !== "stripe") {
    return res.status(400).json({
      error: "Unsupported provider.",
    });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = priceEnv[plan];
  if (!secret || !price) {
    return res.status(400).json({ error: "Stripe secret or plan price ID missing." });
  }

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    customer_email: email,
    client_reference_id: session.authenticated ? session.id : `checkout_${Buffer.from(email).toString("base64url").slice(0, 48)}`,
    success_url: `${appUrl}/pricing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    "metadata[plan]": plan,
    "metadata[email]": email,
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  return res.status(200).json({ url: data.url, id: data.id, provider: "stripe", plan });
}
