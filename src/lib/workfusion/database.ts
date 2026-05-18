import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl() {
  const value =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    "";
  return value && !value.includes("your_") ? value : "";
}

export function databaseConfigured() {
  return Boolean(databaseUrl());
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return pool;
}

export async function ensureWorkfusionSchema() {
  const db = getPool();
  if (!db) return false;
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await db.connect();
      try {
        await client.query("begin");
        await client.query("select pg_advisory_xact_lock(hashtext('workfusion_schema_v1')::bigint)");
        await client.query(`
      create table if not exists wf_users (
        id text primary key,
        email text unique not null,
        role text not null default 'user',
        plan text not null default 'free',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        last_login_at timestamptz
      );

      create table if not exists wf_subscriptions (
        id text primary key,
        user_id text references wf_users(id) on delete set null,
        email text not null,
        plan text not null,
        status text not null,
        provider text not null,
        provider_ref text,
        activated_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create unique index if not exists wf_subscriptions_email_active_idx
        on wf_subscriptions(email)
        where status in ('active', 'trialing', 'past_due');

      create table if not exists wf_projects (
        id text primary key,
        owner_id text not null,
        title text not null,
        market text not null,
        platform text not null,
        idea text not null,
        prop_mode boolean not null default false,
        risk_score integer not null default 0,
        compliance integer not null default 0,
        code text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists wf_projects_owner_updated_idx
        on wf_projects(owner_id, updated_at desc);

      create table if not exists wf_usage_events (
        id bigserial primary key,
        user_id text,
        email text,
        event_type text not null,
        feature text,
        plan text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists wf_usage_events_created_idx
        on wf_usage_events(created_at desc);

      create table if not exists wf_page_events (
        id bigserial primary key,
        user_id text,
        email text,
        path text not null,
        referrer text,
        user_agent text,
        created_at timestamptz not null default now()
      );
    `);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        schemaReady = null;
        throw error;
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
  return true;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = getPool();
  if (!db) return null;
  await ensureWorkfusionSchema();
  return db.query<T>(sql, params);
}
