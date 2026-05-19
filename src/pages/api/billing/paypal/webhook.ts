import type { NextApiRequest, NextApiResponse } from "next";
import {
  getPersistentSubscriptionByProviderRef,
  recordBillingEvent,
  upsertPersistentSubscription,
} from "@/lib/workfusion/account-store";
import { getPaypalSubscription, verifyPaypalWebhookSignature, workfusionPlanFromPaypalPlanId } from "@/lib/workfusion/paypal";
import { upsertSubscription } from "@/lib/workfusion/subscription-store";
import type { WorkfusionPlan } from "@/lib/workfusion/types";

type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const event = (req.body || {}) as PaypalWebhookEvent;
  const eventType = String(event.event_type || "");
  const resource = asRecord(event.resource);
  if (!eventType) return res.status(400).json({ error: "missing_event_type" });

  const adminTest = Boolean(
    process.env.WORKFUSION_ADMIN_TOKEN &&
      req.headers["x-workfusion-admin-token"] === process.env.WORKFUSION_ADMIN_TOKEN &&
      req.headers["x-workfusion-test-webhook"] === "true",
  );

  if (!adminTest) {
    const verified = await verifyPaypalWebhookSignature({
      transmissionId: header(req, "paypal-transmission-id"),
      transmissionTime: header(req, "paypal-transmission-time"),
      certUrl: header(req, "paypal-cert-url"),
      authAlgo: header(req, "paypal-auth-algo"),
      transmissionSig: header(req, "paypal-transmission-sig"),
      webhookEvent: event as Record<string, unknown>,
    });
    if (!verified) return res.status(401).json({ error: "paypal_webhook_signature_failed" });
  }

  const providerRef = extractSubscriptionId(resource, eventType);
  const existing = providerRef ? await getPersistentSubscriptionByProviderRef("paypal", providerRef) : null;
  const paypal = providerRef && shouldHydrateSubscription(eventType) ? await safePaypalLookup(providerRef) : null;
  const hydrated = asRecord(paypal);
  const effectiveResource = Object.keys(hydrated).length ? hydrated : resource;
  const email = extractEmail(effectiveResource) || existing?.email || "";
  const plan = (workfusionPlanFromPaypalPlanId(effectiveResource.plan_id) || existing?.plan || "pro") as WorkfusionPlan;
  const status = statusFromEvent(eventType);
  const amount = extractAmount(resource);
  const currency = extractCurrency(resource);
  const currentPeriodEnd = String(effectiveResource.billing_info && asRecord(effectiveResource.billing_info).next_billing_time || "");

  await recordBillingEvent({
    provider: "paypal",
    eventId: event.id,
    eventType,
    providerRef,
    email,
    plan,
    amount,
    currency,
    status: status || undefined,
    raw: event as Record<string, unknown>,
  });

  if (email && providerRef && status) {
    upsertSubscription({
      email,
      plan,
      provider: "paypal",
      providerRef,
      status,
    });
    await upsertPersistentSubscription({
      email,
      plan,
      provider: "paypal",
      providerRef,
      status,
      currentPeriodEnd: currentPeriodEnd || undefined,
      metadata: {
        lastPaypalEvent: eventType,
        lastPaypalEventId: event.id,
        lastPaymentAmount: amount,
        lastPaymentCurrency: currency,
      },
    });
  }

  return res.status(200).json({
    ok: true,
    verified: !adminTest,
    testMode: adminTest,
    eventType,
    providerRef,
    emailAttached: Boolean(email),
    subscriptionUpdated: Boolean(email && providerRef && status),
    status,
    amount,
    currency,
  });
}

function header(req: NextApiRequest, name: string) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function extractSubscriptionId(resource: Record<string, unknown>, eventType: string) {
  if (eventType.startsWith("BILLING.SUBSCRIPTION.")) return String(resource.id || "");
  return String(resource.billing_agreement_id || resource.billing_agreement_id__c || resource.subscription_id || "");
}

function shouldHydrateSubscription(eventType: string) {
  return eventType.startsWith("BILLING.SUBSCRIPTION.") || eventType === "PAYMENT.SALE.COMPLETED";
}

async function safePaypalLookup(subscriptionId: string) {
  try {
    return await getPaypalSubscription(subscriptionId);
  } catch {
    return null;
  }
}

function extractEmail(resource: Record<string, unknown>) {
  const subscriber = asRecord(resource.subscriber);
  const payer = asRecord(resource.payer);
  const payerInfo = asRecord(payer.payer_info);
  return String(resource.custom_id || subscriber.email_address || payer.email_address || payerInfo.email || "");
}

function statusFromEvent(eventType: string) {
  if (
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.RE-ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.UPDATED" ||
    eventType === "PAYMENT.SALE.COMPLETED"
  ) {
    return "active" as const;
  }
  if (
    eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
    eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ||
    eventType === "PAYMENT.SALE.DENIED"
  ) {
    return "past_due" as const;
  }
  if (
    eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
    eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
    eventType === "PAYMENT.SALE.REFUNDED" ||
    eventType === "PAYMENT.SALE.REVERSED"
  ) {
    return "cancelled" as const;
  }
  return null;
}

function extractAmount(resource: Record<string, unknown>) {
  const amount = asRecord(resource.amount);
  const total = Number(amount.total || amount.value || resource.amount_total);
  return Number.isFinite(total) ? total : undefined;
}

function extractCurrency(resource: Record<string, unknown>) {
  const amount = asRecord(resource.amount);
  return String(amount.currency || amount.currency_code || resource.currency || "");
}
