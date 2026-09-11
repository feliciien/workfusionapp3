
import type { NextApiRequest, NextApiResponse } from "next";
import { getAccountEngine, AccountEngine } from "@/lib/workfusion/prop-firm/account-engine";
import { getSession } from "@/lib/workfusion/session";
import { createChallengeCheckoutSession } from "@/lib/workfusion/stripe";
import { challengeConfigurations } from "./challenges";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { challengeId, email, mt5Login, mt5Server, provider } = req.body;

  if (!challengeId || !email) {
    return res.status(400).json({ error: "challengeId and email are required" });
  }

  const config = challengeConfigurations.find((c) => c.id === challengeId);
  if (!config) {
    return res.status(404).json({ error: "Challenge not found" });
  }

  if (!config.isActive) {
    return res.status(400).json({ error: "Challenge is not active" });
  }

  const paymentProvider = provider || "stripe";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (paymentProvider === "stripe") {
    const stripeSession = await createChallengeCheckoutSession({
      challengeId: config.id,
      challengeName: config.name,
      amount: config.price * 100,
      email,
      successUrl: `${appUrl}/prop-firm/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/prop-firm/checkout/cancel`,
      metadata: {
        challengeId: config.id,
        tier: config.tier,
        type: "challenge_purchase",
        mt5Login: String(mt5Login || ""),
        mt5Server: mt5Server || "",
      },
    });

    return res.status(200).json({
      provider: "stripe",
      url: stripeSession.url,
      sessionId: stripeSession.id,
      message: "Stripe checkout session created",
    });
  }

  if (paymentProvider === "paypal") {
    return res.status(501).json({ error: "PayPal not yet implemented for challenge purchases" });
  }

  return res.status(400).json({ error: "Unsupported payment provider" });
}

