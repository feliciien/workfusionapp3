import { readFile } from "fs/promises";
import { join } from "path";
import { databaseConfigured, ensureWorkfusionSchema, query } from "./database";
import { resourceGuideSlugs } from "./resource-guides";

export type GrowthLead = {
  id: string;
  email: string;
  persona: string | null;
  source: string | null;
  status: string;
  stage: string;
  score: number;
  notes: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastContactedAt: string | null;
};

export type GrowthSnapshot = {
  storage: "postgres" | "local-json";
  counts: Record<string, number>;
  leads: GrowthLead[];
  support: Array<{
    id: string;
    email: string | null;
    category: string | null;
    severity: string | null;
    subject: string | null;
    status: string;
    createdAt: string;
  }>;
  segments: Array<{ persona: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
  pages: Array<{ path: string; visits: number }>;
  channelTracker: GrowthChannelTrackerRow[];
  tasks: Array<{ priority: string; title: string; detail: string }>;
  outreachDrafts: Array<{ channel: string; title: string; body: string }>;
};

export type GrowthChannelTrackerRow = {
  date: string;
  channel: string;
  sourceTag: string;
  targetPersona: string;
  assetOrThread: string;
  action: string;
  cta: string;
  owner: string;
  status: string;
  result: string;
  notes: string;
};

type LeadRow = {
  id: string;
  email: string;
  persona: string | null;
  source: string | null;
  status: string;
  stage: string;
  score: number;
  notes: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_contacted_at: Date | null;
};

const allowedStages = new Set(["new", "researching", "contacted", "trial", "customer", "nurture", "closed"]);

export async function growthSnapshot(): Promise<GrowthSnapshot> {
  await ensureWorkfusionSchema();
  const counts = await query<Record<string, string>>(`
    select
      (select count(*) from wf_marketing_leads)::text as leads,
      (select count(*) from wf_marketing_leads where stage = 'new')::text as new_leads,
      (select count(*) from wf_marketing_leads where stage = 'contacted')::text as contacted,
      (select count(*) from wf_marketing_leads where stage = 'trial')::text as trials,
      (select count(*) from wf_marketing_leads where stage = 'customer')::text as customers,
      (select count(*) from wf_support_messages where status = 'open')::text as open_support,
      (select count(*) from wf_page_events where created_at > now() - interval '7 days')::text as visits_7d,
      (select count(*) from wf_usage_events where created_at > now() - interval '7 days')::text as usage_7d
  `);

  const leads = await query<LeadRow>(`
    select id, email, persona, source, status, stage, score, notes, metadata, created_at, updated_at, last_contacted_at
    from wf_marketing_leads
    order by
      case stage
        when 'new' then 1
        when 'researching' then 2
        when 'contacted' then 3
        when 'trial' then 4
        when 'customer' then 5
        when 'nurture' then 6
        else 7
      end,
      updated_at desc
    limit 100
  `);

  const support = await query<{
    id: string;
    email: string | null;
    category: string | null;
    severity: string | null;
    subject: string | null;
    status: string;
    created_at: Date;
  }>(`
    select id, email, category, severity, subject, status, created_at
    from wf_support_messages
    order by created_at desc
    limit 20
  `);

  const segments = await query<{ persona: string | null; count: string }>(`
    select coalesce(persona, 'unknown') as persona, count(*)::text as count
    from wf_marketing_leads
    group by 1
    order by count(*) desc, persona
    limit 12
  `);

  const sources = await query<{ source: string | null; count: string }>(`
    select coalesce(source, 'unknown') as source, count(*)::text as count
    from wf_marketing_leads
    group by 1
    order by count(*) desc, source
    limit 12
  `);

  const pages = await query<{ path: string; visits: string }>(`
    select path, count(*)::text as visits
    from wf_page_events
    where created_at > now() - interval '30 days'
    group by path
    order by count(*) desc
    limit 12
  `);

  const countMap = normalizeCounts(counts?.rows[0] || {});
  return {
    storage: databaseConfigured() ? "postgres" : "local-json",
    counts: countMap,
    leads: (leads?.rows || []).map(mapLead),
    support: (support?.rows || []).map((row) => ({
      id: row.id,
      email: row.email,
      category: row.category,
      severity: row.severity,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    segments: (segments?.rows || []).map((row) => ({ persona: row.persona || "unknown", count: Number(row.count || 0) })),
    sources: (sources?.rows || []).map((row) => ({ source: row.source || "unknown", count: Number(row.count || 0) })),
    pages: (pages?.rows || []).map((row) => ({ path: row.path, visits: Number(row.visits || 0) })),
    channelTracker: await loadChannelTracker(),
    tasks: buildTasks(countMap),
    outreachDrafts: buildOutreachDrafts(),
  };
}

export async function updateGrowthLead(input: {
  id: string;
  stage?: string;
  score?: number;
  notes?: string;
  contacted?: boolean;
}) {
  await ensureWorkfusionSchema();
  const stage = input.stage && allowedStages.has(input.stage) ? input.stage : undefined;
  const score = Number.isFinite(Number(input.score)) ? Math.max(0, Math.min(100, Math.round(Number(input.score)))) : undefined;
  const notes = input.notes === undefined ? undefined : String(input.notes || "").slice(0, 2000);
  const result = await query<LeadRow>(
    `
    update wf_marketing_leads
    set
      stage = coalesce($2, stage),
      score = coalesce($3, score),
      notes = coalesce($4, notes),
      last_contacted_at = case when $5::boolean then now() else last_contacted_at end,
      updated_at = now()
    where id = $1
    returning id, email, persona, source, status, stage, score, notes, metadata, created_at, updated_at, last_contacted_at
    `,
    [input.id, stage || null, score ?? null, notes ?? null, Boolean(input.contacted)],
  );
  const row = result?.rows[0];
  if (!row) return null;
  return mapLead(row);
}

function mapLead(row: LeadRow): GrowthLead {
  return {
    id: row.id,
    email: row.email,
    persona: row.persona,
    source: row.source,
    status: row.status,
    stage: row.stage || "new",
    score: Number(row.score || 0),
    notes: row.notes || "",
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastContactedAt: row.last_contacted_at ? row.last_contacted_at.toISOString() : null,
  };
}

function normalizeCounts(row: Record<string, string>) {
  return Object.entries(row).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = Number(value || 0);
    return acc;
  }, {});
}

async function loadChannelTracker(): Promise<GrowthChannelTrackerRow[]> {
  try {
    const text = await readFile(join(process.cwd(), "reports/growth/workfusion_channel_tracker.csv"), "utf8");
    const [, ...rows] = text.trim().split(/\r?\n/);
    return rows
      .map((row) => row.split(","))
      .filter((columns) => columns.length >= 11)
      .slice(-20)
      .reverse()
      .map((columns) => ({
        date: columns[0] || "",
        channel: columns[1] || "",
        sourceTag: columns[2] || "",
        targetPersona: columns[3] || "",
        assetOrThread: columns[4] || "",
        action: columns[5] || "",
        cta: columns[6] || "",
        owner: columns[7] || "",
        status: columns[8] || "",
        result: columns[9] || "",
        notes: columns.slice(10).join(",") || "",
      }));
  } catch {
    return [];
  }
}

function buildTasks(counts: Record<string, number>) {
  const tasks = [
    {
      priority: "P0",
      title: "Reply to open support",
      detail: `${counts.open_support || 0} open support items can reveal conversion blockers.`,
    },
    {
      priority: "P1",
      title: "Move new leads into contacted",
      detail: `${counts.new_leads || 0} opt-in leads are waiting for first human review.`,
    },
    {
      priority: "P1",
      title: "Find three high-intent EA questions",
      detail: "Look for public MT4/MT5 compiler, EA generator, invalid stops, and no-trades-in-tester questions. Answer the fix first.",
    },
    {
      priority: "P1",
      title: "Promote one resource guide ethically",
      detail: `${resourceGuideSlugs.length} SEO guides are live; share one helpful answer and link only when the guide directly helps.`,
    },
    {
      priority: "P2",
      title: "Keep BoltIQ and Workfusion separate",
      detail: "Do not pitch BoltIQ partner candidates as Workfusion customers unless they explicitly opt into the product discussion.",
    },
    {
      priority: "P2",
      title: "Review landing page traffic",
      detail: `${counts.visits_7d || 0} visits in 7 days; compare by SEO page before writing new pages.`,
    },
  ];
  return tasks;
}

function buildOutreachDrafts() {
  return [
    {
      channel: "LinkedIn",
      title: "MQL5 compiler error post",
      body:
        "If your MT5 EA fails with undeclared identifier, invalid stops, or missing trade object errors, paste the compiler output into Workfusion. It returns a full fixed draft, risk checks it, and can compile through MetaEditor when the worker is online.",
    },
    {
      channel: "X",
      title: "EA builder CTA",
      body:
        "Building an MT4/MT5 Expert Advisor? Workfusion turns the idea into MQL, fixes compiler errors, risk-scores the draft, and packages the output. Software tool only, no profit promises.",
    },
    {
      channel: "MQL community",
      title: "Helpful debug angle",
      body:
        "I built a small assistant for EA builders: generate MQL drafts, debug MetaEditor errors, and run a readiness check before manual backtesting. Looking for feedback from serious MQL4/MQL5 developers.",
    },
    {
      channel: "MQL freelancer",
      title: "Partner-friendly angle",
      body:
        "Workfusion is not replacing MQL freelancers. It can help produce cleaner first drafts, compiler diagnostics, and risk/readiness notes before a developer takes over the serious review.",
    },
    {
      channel: "Forum answer",
      title: "No-spam support answer",
      body:
        "If someone asks about a specific compiler error, answer the fix first. Add one relevant Workfusion guide only when it helps them continue the debugging path.",
    },
  ];
}
