import type { NextApiRequest } from "next";
import { createHmac, timingSafeEqual } from "crypto";
import type { WorkfusionPlan } from "./types";
import { envOwnerPremium, getSubscription } from "./subscription-store";

export type WorkfusionFeature = "generate" | "optimize" | "debrief" | "debug" | "download";

export const PLAN_LIMITS: Record<WorkfusionPlan, Record<WorkfusionFeature, number>> = {
  free: { generate: 3, optimize: 1, debrief: 1, debug: 1, download: 1 },
  starter: { generate: 30, optimize: 8, debrief: 10, debug: 20, download: 20 },
  pro: { generate: 150, optimize: 50, debrief: 50, debug: 150, download: 150 },
  studio: { generate: 500, optimize: 200, debrief: 200, debug: 500, download: 500 },
};

const SESSION_COOKIE = "wf_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type WorkfusionSession = {
  id: string;
  email: string;
  role: "anonymous" | "user" | "owner";
  plan: WorkfusionPlan;
  authenticated: boolean;
};

function sessionSecret() {
  return (
    process.env.WORKFUSION_SESSION_SECRET ||
    process.env.WORKFUSION_ADMIN_TOKEN ||
    process.env.WORKFUSION_OWNER_EMAIL ||
    "workfusion-local-dev-session-secret"
  );
}

export function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCookies(req: NextApiRequest) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
    return cookies;
  }, {});
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionId(email: string) {
  return `user_${createHmac("sha256", sessionSecret()).update(email).digest("hex").slice(0, 18)}`;
}

function normalizePlan(plan: unknown): WorkfusionPlan {
  const value = String(plan || "free").toLowerCase();
  return value === "starter" || value === "pro" || value === "studio" ? value : "free";
}

export function createSessionCookie(emailInput: string, role: "user" | "owner" = "user", plan: WorkfusionPlan = "free") {
  const email = normalizeEmail(emailInput);
  const payload = Buffer.from(
    JSON.stringify({
      email,
      id: sessionId(email),
      role,
      plan,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const value = `${payload}.${signPayload(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function sessionFromCookie(req: NextApiRequest): WorkfusionSession | null {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      id?: string;
      role?: string;
      plan?: string;
      iat?: number;
    };
    const email = normalizeEmail(parsed.email);
    const age = Math.floor(Date.now() / 1000) - Number(parsed.iat || 0);
    if (!isValidEmail(email) || age > SESSION_MAX_AGE_SECONDS) return null;
    return {
      id: parsed.id || sessionId(email),
      email,
      role: parsed.role === "owner" ? "owner" : "user",
      plan: normalizePlan(parsed.plan),
      authenticated: true,
    };
  } catch {
    return null;
  }
}

function anonymousSession(req?: NextApiRequest): WorkfusionSession {
  const rawGuestId = Array.isArray(req?.headers["x-workfusion-guest-id"])
    ? req?.headers["x-workfusion-guest-id"][0]
    : req?.headers["x-workfusion-guest-id"] || req?.headers["x-anon-id"] || req?.headers["user-agent"] || "anonymous";
  const guestId = String(rawGuestId || "anonymous").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120) || "anonymous";
  return {
    id: `guest_${createHmac("sha256", sessionSecret()).update(guestId).digest("hex").slice(0, 18)}`,
    email: "",
    role: "anonymous",
    plan: "free",
    authenticated: false,
  };
}

export function getSession(req: NextApiRequest): WorkfusionSession {
  const cookieSession = sessionFromCookie(req);
  if (cookieSession) return cookieSession;

  const trustHeaders = process.env.NODE_ENV !== "production" || process.env.WORKFUSION_TRUST_PROXY_HEADERS === "true";
  if (!trustHeaders) return anonymousSession(req);

  const headerEmail = req.headers["x-user-email"];
  const headerId = req.headers["x-user-id"];
  const email = normalizeEmail(Array.isArray(headerEmail) ? headerEmail[0] : headerEmail);
  const id = Array.isArray(headerId) ? headerId[0] : headerId;
  if (!isValidEmail(email)) return anonymousSession(req);

  return {
    id: id || sessionId(email),
    email,
    role: "user",
    plan: "free",
    authenticated: true,
  };
}

export function getAccess(req: NextApiRequest) {
  const session = getSession(req);
  const stored = session.authenticated ? getSubscription(session.email) : null;
  const ownerPremium = envOwnerPremium(session.email);
  const premium = session.authenticated && (stored?.status === "active" || ownerPremium);
  const plan: WorkfusionPlan = premium ? stored?.plan || (ownerPremium ? "pro" : "free") : "free";

  return {
    session,
    status: premium ? "premium" : "free",
    plan,
    subscription: stored || null,
    limits: PLAN_LIMITS[plan],
  };
}
