#!/usr/bin/env node
import fs from "fs";

const command = process.argv[2] || "preflight";
const env = { ...loadEnv(".env.local"), ...process.env };
const base = String(env.PAYPAL_API_BASE || "").replace(/\/$/, "");
const monthlyPlan = env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID || "";
const yearlyPlan = env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID || monthlyPlan;

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, "utf8").split(/\r?\n/u).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const index = trimmed.indexOf("=");
    if (index === -1) return acc;
    acc[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/gu, "");
    return acc;
  }, {});
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function paypal(path, options = {}) {
  const token = options.token || await accessToken();
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.name || data.error_description || data.error || `PayPal ${response.status}`);
  return data;
}

async function accessToken() {
  assert(base.includes("sandbox.paypal.com"), `Not sandbox: PAYPAL_API_BASE is ${base || "missing"}`);
  assert(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET, "Missing PayPal sandbox credentials.");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "PayPal OAuth failed");
  return data.access_token;
}

async function preflight() {
  const token = await accessToken();
  const monthly = monthlyPlan ? await paypal(`/v1/billing/plans/${monthlyPlan}`, { token }) : null;
  const yearly = yearlyPlan && yearlyPlan !== monthlyPlan ? await paypal(`/v1/billing/plans/${yearlyPlan}`, { token }) : null;
  return {
    sandbox: true,
    apiBase: base,
    oauth: "pass",
    plans: {
      starter: monthly ? { id: mask(monthly.id), status: monthly.status, frequency: monthly.billing_cycles?.[0]?.frequency } : "missing",
      pro: yearly ? { id: mask(yearly.id), status: yearly.status, frequency: yearly.billing_cycles?.[0]?.frequency } : monthly ? "same_as_starter" : "missing",
    },
  };
}

async function createSubscription() {
  const email = process.argv[3];
  const plan = process.argv[4] || "starter";
  assert(email && email.includes("@"), "Usage: node scripts/paypal_sandbox_check.mjs create buyer@example.com starter|pro");
  const planId = plan === "starter" ? monthlyPlan : yearlyPlan;
  assert(planId, `Missing PayPal plan id for ${plan}.`);
  const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const data = await paypal("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      custom_id: email,
      subscriber: { email_address: email },
      application_context: {
        brand_name: "Workfusion Trading AI Sandbox",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${appUrl}/pricing?paypal=success&plan=${plan}`,
        cancel_url: `${appUrl}/pricing?paypal=cancelled&plan=${plan}`,
      },
    },
  });
  return {
    id: data.id,
    status: data.status,
    approveUrl: data.links?.find((link) => link.rel === "approve")?.href || null,
    nextStep: "Open approveUrl with a PayPal sandbox buyer account, then run: node scripts/paypal_sandbox_check.mjs verify <subscription_id>",
  };
}

async function verifySubscription() {
  const id = process.argv[3];
  assert(id, "Usage: node scripts/paypal_sandbox_check.mjs verify <subscription_id>");
  const data = await paypal(`/v1/billing/subscriptions/${id}`);
  return {
    id: data.id,
    status: data.status,
    subscriber: data.subscriber?.email_address || data.custom_id || null,
    planId: mask(data.plan_id),
    nextBillingTime: data.billing_info?.next_billing_time || null,
    lastPayment: data.billing_info?.last_payment || null,
  };
}

function mask(value) {
  const text = String(value || "");
  return text.length > 10 ? `${text.slice(0, 4)}...${text.slice(-4)}` : text;
}

try {
  const result =
    command === "create" ? await createSubscription() :
    command === "verify" ? await verifySubscription() :
    await preflight();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "unknown" }, null, 2));
  process.exit(1);
}
