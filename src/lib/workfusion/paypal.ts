function paypalBase() {
  return (process.env.PAYPAL_API_BASE || "https://api-m.paypal.com").trim().replace(/\/$/, "");
}

export async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials missing");

  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "PayPal OAuth failed");
  return data.access_token as string;
}

export function paypalPlanId(plan: string) {
  if (plan === "starter") return process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID;
  if (plan === "pro") return process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID;
  return process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID;
}

export async function createPaypalSubscription(input: {
  plan: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const planId = paypalPlanId(input.plan);
  if (!planId) throw new Error("PayPal plan ID missing");

  const token = await getPaypalAccessToken();
  const response = await fetch(`${paypalBase()}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: input.email || "workfusion-customer",
      subscriber: input.email
        ? {
            email_address: input.email,
          }
        : undefined,
      application_context: {
        brand_name: "Workfusion Trading AI",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.name || "PayPal subscription create failed");
  return data;
}

export async function getPaypalSubscription(subscriptionId: string) {
  const token = await getPaypalAccessToken();
  const response = await fetch(`${paypalBase()}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.name || "PayPal subscription lookup failed");
  return data;
}
