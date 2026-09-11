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
        current_period_end timestamptz,
        metadata jsonb not null default '{}'::jsonb,
        activated_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      alter table wf_subscriptions
        add column if not exists current_period_end timestamptz;

      alter table wf_subscriptions
        add column if not exists metadata jsonb not null default '{}'::jsonb;

      create unique index if not exists wf_subscriptions_email_active_idx
        on wf_subscriptions(email)
        where status in ('active', 'trialing', 'past_due');

      create index if not exists wf_subscriptions_provider_ref_idx
        on wf_subscriptions(provider, provider_ref);

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
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      alter table wf_page_events
        add column if not exists metadata jsonb not null default '{}'::jsonb;

      alter table wf_usage_events
        add column if not exists metadata jsonb not null default '{}'::jsonb;

      update wf_page_events
      set metadata = metadata
        || jsonb_build_object(
          'sourceTag',
          case
            when coalesce(metadata->>'sourceTag', '') <> '' then metadata->>'sourceTag'
            when coalesce(referrer, '') = '' then 'direct'
            when lower(referrer) like '%github%' then 'github'
            when lower(referrer) like '%linkedin%' or lower(referrer) like '%lnkd.in%' then 'linkedin'
            when lower(referrer) like '%codex%' or lower(referrer) like '%chatgpt%' or lower(referrer) like '%openai%' then 'codex'
            when lower(referrer) like '%mql5.com%' then 'mql5_forum'
            when lower(referrer) like '%forexfactory.com%' then 'forex_factory'
            when lower(referrer) like '%earnforex.com%' then 'earnforex_forum'
            when lower(referrer) like '%forum%' then 'forum_reply'
            when lower(referrer) like '%google.%' or lower(referrer) like '%bing.%' or lower(referrer) like '%duckduckgo%' then 'search'
            else 'other'
          end
        )
        || jsonb_build_object(
          'conversionPath',
          case
            when coalesce(metadata->>'conversionPath', '') <> '' then metadata->>'conversionPath'
            when path = '/' then 'homepage'
            when path like '%mql5-compiler-fixer%' then 'compiler_fixer'
            when path like '%mt5-ea-generator%' then 'ea_generator'
            when path like '%mt4-ea-debugger%' then 'mt4_debugger'
            when path like '%prop-firm-ea-risk-checker%' then 'risk_checker'
            when path like '%prop-firm-payout-tracker%' then 'risk_checker'
            when path like '%mql5-code-review%' then 'code_review'
            when path = '/resources' then 'resources_hub'
            when path like '/resources/%' then 'resource_guide'
            when path like '%pricing%' then 'pricing'
            when path like '%support%' then 'support'
            when path like '%updates%' then 'updates'
            else 'unknown'
          end
        )
      where coalesce(metadata->>'sourceTag', '') = ''
         or coalesce(metadata->>'conversionPath', '') = '';

      update wf_usage_events
      set metadata = metadata
        || jsonb_build_object(
          'sourceTag',
          case
            when coalesce(metadata->>'sourceTag', '') <> '' then metadata->>'sourceTag'
            when lower(coalesce(metadata->>'referrer', '')) like '%github%' then 'github'
            when lower(coalesce(metadata->>'referrer', '')) like '%linkedin%' or lower(coalesce(metadata->>'referrer', '')) like '%lnkd.in%' then 'linkedin'
            when lower(coalesce(metadata->>'referrer', '')) like '%codex%' or lower(coalesce(metadata->>'referrer', '')) like '%chatgpt%' or lower(coalesce(metadata->>'referrer', '')) like '%openai%' then 'codex'
            when lower(coalesce(metadata->>'referrer', '')) like '%mql5.com%' then 'mql5_forum'
            when lower(coalesce(metadata->>'referrer', '')) like '%forexfactory.com%' then 'forex_factory'
            when lower(coalesce(metadata->>'referrer', '')) like '%earnforex.com%' then 'earnforex_forum'
            when lower(coalesce(metadata->>'referrer', '')) like '%forum%' then 'forum_reply'
            when lower(coalesce(metadata->>'referrer', '')) like '%google.%' or lower(coalesce(metadata->>'referrer', '')) like '%bing.%' or lower(coalesce(metadata->>'referrer', '')) like '%duckduckgo%' then 'search'
            else 'direct'
          end
        )
        || jsonb_build_object(
          'conversionPath',
          case
            when coalesce(metadata->>'conversionPath', '') <> '' then metadata->>'conversionPath'
            when coalesce(metadata->>'page', '') = '/' then 'homepage'
            when coalesce(metadata->>'page', '') like '%mql5-compiler-fixer%' then 'compiler_fixer'
            when coalesce(metadata->>'page', '') like '%mt5-ea-generator%' then 'ea_generator'
            when coalesce(metadata->>'page', '') like '%mt4-ea-debugger%' then 'mt4_debugger'
            when coalesce(metadata->>'page', '') like '%prop-firm-ea-risk-checker%' then 'risk_checker'
            when coalesce(metadata->>'page', '') like '%prop-firm-payout-tracker%' then 'risk_checker'
            when coalesce(metadata->>'page', '') like '%mql5-code-review%' then 'code_review'
            when coalesce(metadata->>'page', '') = '/resources' then 'resources_hub'
            when coalesce(metadata->>'page', '') like '/resources/%' then 'resource_guide'
            when coalesce(metadata->>'page', '') like '%pricing%' then 'pricing'
            when coalesce(metadata->>'page', '') like '%support%' then 'support'
            when coalesce(metadata->>'page', '') like '%updates%' then 'updates'
            when feature = 'generate' then 'ea_generator'
            when feature in ('debug', 'compile_check') then 'compiler_fixer'
            when feature in ('optimize', 'debrief', 'backtest_estimate') then 'risk_checker'
            when feature = 'download' then 'ea_generator'
            when feature = 'checkout' then 'pricing'
            when feature = 'support' then 'support'
            else 'unknown'
          end
        )
      where coalesce(metadata->>'sourceTag', '') = ''
         or coalesce(metadata->>'conversionPath', '') = '';

      create table if not exists wf_billing_events (
        id bigserial primary key,
        provider text not null,
        event_id text unique,
        event_type text not null,
        provider_ref text,
        email text,
        plan text,
        amount numeric,
        currency text,
        status text,
        raw jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists wf_billing_events_created_idx
        on wf_billing_events(created_at desc);

      create index if not exists wf_billing_events_provider_ref_idx
        on wf_billing_events(provider, provider_ref);

      create table if not exists wf_marketing_leads (
        id text primary key,
        email text unique not null,
        persona text,
        source text,
        consent boolean not null default false,
        consent_text text,
        status text not null default 'subscribed',
        stage text not null default 'new',
        score integer not null default 0,
        notes text not null default '',
        last_contacted_at timestamptz,
        user_agent text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      alter table wf_marketing_leads
        add column if not exists stage text not null default 'new';

      alter table wf_marketing_leads
        add column if not exists score integer not null default 0;

      alter table wf_marketing_leads
        add column if not exists notes text not null default '';

      alter table wf_marketing_leads
        add column if not exists last_contacted_at timestamptz;

      create index if not exists wf_marketing_leads_created_idx
        on wf_marketing_leads(created_at desc);

      create index if not exists wf_marketing_leads_stage_idx
        on wf_marketing_leads(stage, updated_at desc);

      create table if not exists wf_support_messages (
        id text primary key,
        user_id text,
        email text,
        plan text,
        category text,
        severity text,
        subject text,
        message text not null,
        page text,
        user_agent text,
        ai_summary text,
        ai_category text,
        ai_priority text,
        ai_suggested_action text,
        ai_owner_brief text,
        status text not null default 'open',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists wf_support_messages_created_idx
        on wf_support_messages(created_at desc);
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
