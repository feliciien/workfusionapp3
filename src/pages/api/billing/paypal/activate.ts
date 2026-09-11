import type { NextApiRequest, NextApiResponse } from "next";
import { recordBillingEvent, upsertPersistentSubscription } from "@/lib/workfusion/account-store";
import { createSessionCookie, getSession, normalizeEmail } from "@/lib/workfusion/session";
import { getPaypalSubscription } from "@/lib/workfusion/paypal";
import { queueActivationEmail } from "@/lib/workfusion/outbox";
import { upsertSubscription } from "@/lib/workfusion/subscription-store";
import type { WorkfusionPlan } from "@/lib/workfusion/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = getSession(req);
  const subscriptionId = String(req.body?.subscriptionId || "");
  const plan = (String(req.body?.plan || "pro").toLowerCase() as WorkfusionPlan) || "pro";
  if (!subscriptionId) return res.status(400).json({ error: "subscriptionId required" });

  try {
    const paypal = await getPaypalSubscription(subscriptionId);
    if (paypal.status !== "ACTIVE") {
      return res.status(409).json({
        error: "PayPal subscription is not ACTIVE yet.",
        providerStatus: paypal.status,
      });
    }

    const email = paypal.subscriber?.email_address || (session.authenticated ? session.email : "");
    if (!email) {
      return res.status(401).json({
        error: "login_required",
        message: "PayPal did not return an email. Sign in before activation so the subscription can be attached.",
      });
    }

    const subscription = upsertSubscription({
      email,
      plan,
      provider: "paypal",
      providerRef: subscriptionId,
      status: "active",
    });
    const persistent = await upsertPersistentSubscription({
      email,
      plan,
      provider: "paypal",
      providerRef: subscriptionId,
      status: "active",
      currentPeriodEnd: paypal.billing_info?.next_billing_time,
      metadata: {
        paypalStatus: paypal.status,
        paypalPlanId: paypal.plan_id,
      },
    });
    await recordBillingEvent({
      provider: "paypal",
      eventId: `manual_activate_${subscriptionId}`,
      eventType: "WORKFUSION.PAYPAL.ACTIVATED",
      providerRef: subscriptionId,
      email,
      plan,
      status: "active",
      raw: paypal,
    });
    const ownerEmail = normalizeEmail(process.env.WORKFUSION_OWNER_EMAIL);
    const role = ownerEmail && normalizeEmail(email) === ownerEmail ? "owner" : "user";
    res.setHeader("Set-Cookie", createSessionCookie(subscription.email, role, subscription.plan));
    const activationEmail = queueActivationEmail(subscription.email, subscription.plan, "paypal");
    return res.status(200).json({
      status: "premium_active",
      storage: persistent.storage,
      subscription: persistent.storage === "postgres" ? persistent : subscription,
      emailQueued: activationEmail.mode,
    });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "PayPal activation failed" });
  }
}
