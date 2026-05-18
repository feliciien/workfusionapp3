import { createHmac } from "crypto";
import { databaseConfigured, ensureWorkfusionSchema, query } from "./database";
import { envOwnerPremium, getSubscription, type SubscriptionRecord } from "./subscription-store";
import { PLAN_LIMITS, type WorkfusionFeature, type WorkfusionSession } from "./session";
import type { WorkfusionPlan } from "./types";

export type PersistentSubscription = SubscriptionRecord & {
  id?: string;
  userId?: string;
};

function secret() {
  return process.env.WORKFUSION_SESSION_SECRET || process.env.WORKFUSION_ADMIN_TOKEN || "workfusion-db";
}

export function stableUserId(email: string) {
  return `user_${createHmac("sha256", secret()).update(email.toLowerCase()).digest("hex").slice(0, 18)}`;
}

export function validPlan(value: unknown): WorkfusionPlan {
  const plan = String(value || "free").toLowerCase();
  return plan === "starter" || plan === "pro" || plan === "studio" ? plan : "free";
}

export async function upsertUser(input: { email: string; role?: string; plan?: WorkfusionPlan; lastLogin?: boolean }) {
  const email = input.email.toLowerCase();
  const id = stableUserId(email);
  if (!databaseConfigured()) return { id, storage: "local-json" as const };

  try {
    await query(
      `
      insert into wf_users (id, email, role, plan, last_login_at)
      values ($1, $2, $3, $4, ${input.lastLogin ? "now()" : "null"})
      on conflict (email) do update set
        role = excluded.role,
        plan = excluded.plan,
        updated_at = now(),
        last_login_at = ${input.lastLogin ? "now()" : "wf_users.last_login_at"}
      `,
      [id, email, input.role || "user", input.plan || "free"],
    );
    return { id, storage: "postgres" as const };
  } catch {
    return { id, storage: "local-json" as const };
  }
}

export async function getPersistentSubscription(email: string): Promise<PersistentSubscription | null> {
  const normalized = email.toLowerCase();
  if (databaseConfigured()) {
    try {
      const result = await query<{
        id: string;
        user_id: string | null;
        email: string;
        plan: WorkfusionPlan;
        status: SubscriptionRecord["status"];
        provider: SubscriptionRecord["provider"];
        provider_ref: string | null;
        activated_at: Date;
        updated_at: Date;
      }>(
        `
        select id, user_id, email, plan, status, provider, provider_ref, activated_at, updated_at
        from wf_subscriptions
        where lower(email) = lower($1)
        order by updated_at desc
        limit 1
        `,
        [normalized],
      );
      const row = result?.rows[0];
      if (row) {
        return {
          id: row.id,
          userId: row.user_id || undefined,
          email: row.email,
          plan: validPlan(row.plan),
          status: row.status,
          provider: row.provider,
          providerRef: row.provider_ref || undefined,
          activatedAt: row.activated_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        };
      }
    } catch {
      // Fall back to local file store below.
    }
  }
  return getSubscription(normalized) || null;
}

export async function upsertPersistentSubscription(input: {
  email: string;
  plan: WorkfusionPlan;
  status?: SubscriptionRecord["status"];
  provider: SubscriptionRecord["provider"];
  providerRef?: string;
}) {
  const normalized = input.email.toLowerCase();
  const user = await upsertUser({ email: normalized, plan: input.plan });
  const now = new Date().toISOString();
  const record: PersistentSubscription = {
    email: normalized,
    plan: input.plan,
    status: input.status || "active",
    provider: input.provider,
    providerRef: input.providerRef,
    activatedAt: now,
    updatedAt: now,
    userId: user.id,
  };

  if (databaseConfigured()) {
    try {
      const id = input.providerRef ? `${input.provider}_${input.providerRef}` : `manual_${stableUserId(normalized)}`;
      await query(
        `
        insert into wf_subscriptions (id, user_id, email, plan, status, provider, provider_ref, activated_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, now(), now())
        on conflict (id) do update set
          user_id = excluded.user_id,
          email = excluded.email,
          plan = excluded.plan,
          status = excluded.status,
          provider = excluded.provider,
          provider_ref = excluded.provider_ref,
          updated_at = now()
        `,
        [id, user.id, normalized, input.plan, record.status, input.provider, input.providerRef || null],
      );
      return { ...record, id, storage: "postgres" as const };
    } catch {
      return { ...record, storage: "local-json" as const };
    }
  }

  return { ...record, storage: "local-json" as const };
}

export async function getPersistentAccess(session: WorkfusionSession) {
  if (!session.authenticated) {
    return {
      session,
      status: "free",
      plan: "free" as WorkfusionPlan,
      subscription: null,
      limits: PLAN_LIMITS.free,
      storage: databaseConfigured() ? "postgres" : "local-json",
    };
  }

  const subscription = await getPersistentSubscription(session.email);
  const ownerPremium = envOwnerPremium(session.email);
  const premium = subscription?.status === "active" || ownerPremium;
  const plan = premium ? subscription?.plan || (ownerPremium ? "pro" : "free") : "free";
  await upsertUser({ email: session.email, role: session.role, plan, lastLogin: false });

  return {
    session,
    status: premium ? "premium" : "free",
    plan,
    subscription,
    limits: PLAN_LIMITS[plan],
    storage: databaseConfigured() ? "postgres" : "local-json",
  };
}

export async function recordUsageEvent(input: {
  session: WorkfusionSession;
  eventType: string;
  feature?: string;
  plan?: WorkfusionPlan;
  metadata?: Record<string, unknown>;
}) {
  if (!databaseConfigured()) return false;
  try {
    await query(
      `
      insert into wf_usage_events (user_id, email, event_type, feature, plan, metadata)
      values ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.session.id,
        input.session.authenticated ? input.session.email : null,
        input.eventType,
        input.feature || null,
        input.plan || input.session.plan || "free",
        JSON.stringify(input.metadata || {}),
      ],
    );
    return true;
  } catch {
    return false;
  }
}

function currentUsagePeriodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

export async function featureAllowance(
  access: Awaited<ReturnType<typeof getPersistentAccess>>,
  feature: WorkfusionFeature,
) {
  const limit = access.limits[feature];
  if (!databaseConfigured()) {
    return { allowed: true, feature, limit, used: 0, remaining: limit, periodStart: currentUsagePeriodStart() };
  }

  try {
    const periodStart = currentUsagePeriodStart();
    const result = await query<{ used: string }>(
      `
      select count(*)::text as used
      from wf_usage_events
      where user_id = $1
        and feature = $2
        and event_type = 'feature_run'
        and created_at >= $3::timestamptz
      `,
      [access.session.id, feature, periodStart],
    );
    const used = Number(result?.rows[0]?.used || 0);
    const remaining = Math.max(0, limit - used);
    return { allowed: used < limit, feature, limit, used, remaining, periodStart };
  } catch {
    return { allowed: true, feature, limit, used: 0, remaining: limit, periodStart: currentUsagePeriodStart() };
  }
}

export function limitsAfterRun(
  access: Awaited<ReturnType<typeof getPersistentAccess>>,
  feature: WorkfusionFeature,
  allowance: Awaited<ReturnType<typeof featureAllowance>>,
) {
  return {
    ...access.limits,
    [feature]: Math.max(0, allowance.remaining - 1),
  };
}

export function limitReachedPayload(
  access: Awaited<ReturnType<typeof getPersistentAccess>>,
  allowance: Awaited<ReturnType<typeof featureAllowance>>,
) {
  return {
    error: "limit_reached",
    message: `Monthly ${allowance.feature} limit reached for the ${access.plan} plan.`,
    feature: allowance.feature,
    plan: access.plan,
    limit: allowance.limit,
    used: allowance.used,
    remaining: {
      ...access.limits,
      [allowance.feature]: 0,
    },
    upgradeRequired: access.plan === "free",
  };
}

export async function analyticsSnapshot() {
  await ensureWorkfusionSchema();
  const result = await query<{
    users: string;
    subscriptions: string;
    active_subscriptions: string;
    projects: string;
    usage_events: string;
    unique_emails: string;
  }>(`
    select
      (select count(*) from wf_users)::text as users,
      (select count(*) from wf_subscriptions)::text as subscriptions,
      (select count(*) from wf_subscriptions where status = 'active')::text as active_subscriptions,
      (select count(*) from wf_projects)::text as projects,
      (select count(*) from wf_usage_events)::text as usage_events,
      (select count(*) from wf_page_events)::text as page_events,
      (select count(distinct email) from (
        select email from wf_users
        union all
        select email from wf_subscriptions
        union all
        select email from wf_usage_events where email is not null
      ) emails)::text as unique_emails
  `);

  const emails = await query<{ email: string }>(`
    select distinct email from (
      select email from wf_users
      union all
      select email from wf_subscriptions
      union all
      select email from wf_usage_events where email is not null
    ) emails
    order by email
    limit 100
  `);

  return {
    storage: databaseConfigured() ? "postgres" : "local-json",
    counts: result?.rows[0] || null,
    emails: emails?.rows.map((row) => row.email) || [],
  };
}

export async function recordPageEvent(input: {
  session: WorkfusionSession;
  path: string;
  referrer?: string;
  userAgent?: string;
}) {
  if (!databaseConfigured()) return false;
  try {
    await query(
      `
      insert into wf_page_events (user_id, email, path, referrer, user_agent)
      values ($1, $2, $3, $4, $5)
      `,
      [
        input.session.id,
        input.session.authenticated ? input.session.email : null,
        input.path || "/",
        input.referrer || null,
        input.userAgent || null,
      ],
    );
    return true;
  } catch {
    return false;
  }
}
