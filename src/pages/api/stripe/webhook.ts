
import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe, verifyWebhookSignature } from "@/lib/workfusion/stripe";
import { getAccountEngine } from "@/lib/workfusion/prop-firm/account-engine";

// Import challenge configurations - in production, these would come from a database or config service
const challengeConfigurations = [
  {
    id: "starter_10k",
    name: "Starter Challenge - $10K",
    tier: "STARTER",
    description: "Entry-level challenge for new traders. 10% profit target, 5% daily loss, 10% max drawdown.",
    accountSize: 10000,
    price: 99,
    resetPrice: 49,
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 3,
    maxPositionSizePct: 5,
    maxExposurePct: 20,
    maxLeverage: 30,
    allowedInstruments: ["FOREX", "INDICES", "COMMODITIES"],
    restrictedInstruments: [],
    newsRestrictionMinutes: 5,
    weekendHoldingAllowed: false,
    maxHoldingHours: 168,
    consistencyRule: { enabled: true, maxDailyProfitPctOfTotal: 30 },
    maxTradesPerDay: 20,
    minTradeDurationSeconds: 30,
    phaseCount: 1,
    scalingEnabled: true,
    profitSplitTraderPct: 80,
    profitSplitFirmPct: 20,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "standard_25k",
    name: "Standard Challenge - $25K",
    tier: "STANDARD",
    description: "Standard challenge for developing traders. 10% profit target, 5% daily loss, 10% max drawdown.",
    accountSize: 25000,
    price: 199,
    resetPrice: 99,
    profitTargetPct: 10,
    maxDailyLossPct: 5,
    maxTotalLossPct: 10,
    minTradingDays: 4,
    maxPositionSizePct: 5,
    maxExposurePct: 20,
    maxLeverage: 30,
    allowedInstruments: ["FOREX", "INDICES", "COMMODITIES"],
    restrictedInstruments: [],
    newsRestrictionMinutes: 5,
    weekendHoldingAllowed: false,
    maxHoldingHours: 168,
    consistencyRule: { enabled: true, maxDailyProfitPctOfTotal: 25 },
    maxTradesPerDay: 25,
    minTradeDurationSeconds: 30,
    phaseCount: 2,
    phaseConfigs: [
      { phase: 1, profitTargetPct: 10, maxDailyLossPct: 5, maxTotalLossPct: 10, minTradingDays: 3 },
      { phase: 2, profitTargetPct: 5, maxDailyLossPct: 5, maxTotalLossPct: 10, minTradingDays: 2 }
    ],
    scalingEnabled: true,
    profitSplitTraderPct: 80,
    profitSplitFirmPct: 20,
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pro_50k",
    name: "Pro Challenge - $50K",
    tier: "PRO",
    description: "Professional challenge for experienced traders. 10% profit target, 4% daily loss, 8% max drawdown.",
    accountSize: 50000,
    price: 349,
    resetPrice: 149,
    profitTargetPct: 10,
    maxDailyLossPct: 4,
    maxTotalLossPct: 8,
    minTradingDays: 5,
    maxPositionSizePct: 4,
    maxExposurePct: 15,
    maxLeverage: 20,
    allowedInstruments: ["FOREX", "INDICES", "COMMODITIES"],
    restrictedInstruments: [],
    newsRestrictionMinutes: 10,
    weekendHoldingAllowed: false,
    maxHoldingHours: 168,
    consistencyRule: { enabled: true, maxDailyProfitPctOfTotal: 20 },
    maxTradesPerDay: 30,
    minTradeDurationSeconds: 60,
    phaseCount: 2,
    phaseConfigs: [
      { phase: 1, profitTargetPct: 10, maxDailyLossPct: 4, maxTotalLossPct: 8, minTradingDays: 4 },
      { phase: 2, profitTargetPct: 5, maxDailyLossPct: 4, maxTotalLossPct: 8, minTradingDays: 3 }
    ],
    scalingEnabled: true,
    profitSplitTraderPct: 85,
    profitSplitFirmPct: 15,
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "advanced_100k",
    name: "Advanced Challenge - $100K",
    tier: "ADVANCED",
    description: "Advanced challenge for skilled traders. 8% profit target, 3% daily loss, 6% max drawdown.",
    accountSize: 100000,
    price: 599,
    resetPrice: 249,
    profitTargetPct: 8,
    maxDailyLossPct: 3,
    maxTotalLossPct: 6,
    minTradingDays: 7,
    maxPositionSizePct: 3,
    maxExposurePct: 10,
    maxLeverage: 15,
    allowedInstruments: ["FOREX", "INDICES", "COMMODITIES"],
    restrictedInstruments: [],
    newsRestrictionMinutes: 15,
    weekendHoldingAllowed: false,
    maxHoldingHours: 168,
    consistencyRule: { enabled: true, maxDailyProfitPctOfTotal: 15 },
    maxTradesPerDay: 20,
    minTradeDurationSeconds: 120,
    phaseCount: 2,
    phaseConfigs: [
      { phase: 1, profitTargetPct: 8, maxDailyLossPct: 3, maxTotalLossPct: 6, minTradingDays: 5 },
      { phase: 2, profitTargetPct: 4, maxDailyLossPct: 3, maxTotalLossPct: 6, minTradingDays: 4 }
    ],
    scalingEnabled: true,
    profitSplitTraderPct: 85,
    profitSplitFirmPct: 15,
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "elite_200k",
    name: "Elite Challenge - $200K",
    tier: "ELITE",
    description: "Elite challenge for expert traders. 6% profit target, 2.5% daily loss, 5% max drawdown.",
    accountSize: 200000,
    price: 999,
    resetPrice: 399,
    profitTargetPct: 6,
    maxDailyLossPct: 2.5,
    maxTotalLossPct: 5,
    minTradingDays: 10,
    maxPositionSizePct: 2,
    maxExposurePct: 8,
    maxLeverage: 10,
    allowedInstruments: ["FOREX", "INDICES", "COMMODITIES"],
    restrictedInstruments: [],
    newsRestrictionMinutes: 30,
    weekendHoldingAllowed: false,
    maxHoldingHours: 168,
    consistencyRule: { enabled: true, maxDailyProfitPctOfTotal: 10 },
    maxTradesPerDay: 15,
    minTradeDurationSeconds: 300,
    phaseCount: 2,
    phaseConfigs: [
      { phase: 1, profitTargetPct: 6, maxDailyLossPct: 2.5, maxTotalLossPct: 5, minTradingDays: 7 },
      { phase: 2, profitTargetPct: 3, maxDailyLossPct: 2.5, maxTotalLossPct: 5, minTradingDays: 5 }
    ],
    scalingEnabled: true,
    profitSplitTraderPct: 90,
    profitSplitFirmPct: 10,
    isActive: true,
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const signature = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: "Missing Stripe signature or webhook secret" });
  }

  const rawBody = await new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

  const event = await verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!event) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const accountEngine = getAccountEngine();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const metadata = session.metadata || {};

      if (metadata.type === "challenge_purchase") {
        const { challengeId, mt5Login, mt5Server } = metadata;
        const email = session.customer_details?.email || session.customer_email;

        if (challengeId && email && mt5Login && mt5Server) {
          const config = challengeConfigurations.find((c) => c.id === challengeId);
          if (config) {
            // Create or get trader profile
            let trader = accountEngine.getTraderProfileByEmail(email);
            if (!trader) {
              trader = accountEngine.createTraderProfile(email, "Trader", "User", "US");
            }

            // Create challenge account
            const challengeAccount = accountEngine.createChallengeAccount(
              trader.id,
              config,
              parseInt(mt5Login),
              mt5Server
            );

            console.log(`Challenge account created: ${challengeAccount?.id} for trader: ${trader?.id}`);
          }
        }
      }

      if (metadata.type === "subscription") {
        // Handle subscription events
        console.log("Subscription checkout completed:", session.id);
        
        // Update trader subscription status
        const { plan } = metadata;
        const email = session.customer_details?.email || session.customer_email;
        
        if (plan && email) {
          const trader = accountEngine.getTraderProfileByEmail(email);
          if (trader) {
            accountEngine.updateAiSubscription(
              trader.id,
              plan as "FREE" | "PRO" | "QUANT",
              "ACTIVE",
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 1 month from now
            );
          }
        }
      }
      break;
    }

    case "checkout.session.expired": {
      console.log("Checkout session expired:", event.data.object.id);
      break;
    }

    case "payment_intent.succeeded": {
      console.log("Payment succeeded:", event.data.object.id);
      break;
    }

    case "payment_intent.payment_failed": {
      console.log("Payment failed:", event.data.object.id);
      break;
    }
  }

  return res.status(200).json({ received: true });
}

