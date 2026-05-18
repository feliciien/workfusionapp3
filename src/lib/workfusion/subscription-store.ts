import fs from "fs";
import path from "path";
import type { WorkfusionPlan } from "./types";

export type SubscriptionRecord = {
  email: string;
  plan: WorkfusionPlan;
  status: "active" | "trialing" | "past_due" | "cancelled";
  provider: "manual" | "stripe" | "paypal";
  providerRef?: string;
  activatedAt: string;
  updatedAt: string;
};

const dataDir = process.env.VERCEL ? path.join("/tmp", "workfusion") : path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "workfusion-subscriptions.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ subscriptions: [] }, null, 2));
}

function readStore(): { subscriptions: SubscriptionRecord[] } {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return { subscriptions: [] };
  }
}

function writeStore(store: { subscriptions: SubscriptionRecord[] }) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

export function getSubscription(email: string) {
  const normalized = email.toLowerCase();
  const store = readStore();
  return store.subscriptions.find((item) => item.email.toLowerCase() === normalized);
}

export function upsertSubscription(input: {
  email: string;
  plan: WorkfusionPlan;
  status?: SubscriptionRecord["status"];
  provider: SubscriptionRecord["provider"];
  providerRef?: string;
}) {
  const store = readStore();
  const now = new Date().toISOString();
  const normalized = input.email.toLowerCase();
  const index = store.subscriptions.findIndex((item) => item.email.toLowerCase() === normalized);
  const next: SubscriptionRecord = {
    email: normalized,
    plan: input.plan,
    status: input.status || "active",
    provider: input.provider,
    providerRef: input.providerRef,
    activatedAt: index >= 0 ? store.subscriptions[index].activatedAt : now,
    updatedAt: now,
  };

  if (index >= 0) store.subscriptions[index] = next;
  else store.subscriptions.push(next);
  writeStore(store);
  return next;
}

export function envOwnerPremium(email: string) {
  const ownerEmail = (process.env.WORKFUSION_OWNER_EMAIL || "").toLowerCase();
  return Boolean(process.env.WORKFUSION_OWNER_PREMIUM === "true" && ownerEmail && ownerEmail === email.toLowerCase());
}
