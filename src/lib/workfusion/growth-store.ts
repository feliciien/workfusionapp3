import { readFile, readdir } from "fs/promises";
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
    plan: string | null;
    category: string | null;
    severity: string | null;
    subject: string | null;
    message: string;
    page: string | null;
    ai: {
      summary: string | null;
      category: string | null;
      priority: string | null;
      suggestedAction: string | null;
      ownerBrief: string | null;
    };
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  segments: Array<{ persona: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
  pages: Array<{ path: string; visits: number }>;
  channelTracker: GrowthChannelTrackerRow[];
  manualPostQueue: GrowthManualPost[];
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

export type GrowthManualPost = {
  channel: string;
  title: string;
  url: string;
  shareUrl: string;
  websiteUrl: string;
  linkPolicy: string;
  status: string;
  body: string;
};

export type GrowthIntelligenceTelemetry = {
  snapshot: GrowthSnapshot;
  funnel: {
    visits7d: number;
    leads7d: number;
    totalLeads: number;
    trials: number;
    customers: number;
    usage7d: number;
    visitorToLeadRate7dPct: number;
    leadToTrialRatePct: number;
    trialToCustomerRatePct: number;
  };
  usageByFeature30d: Array<{ feature: string; count: number }>;
  usageByDay14d: Array<{ day: string; events: number }>;
  visitsByDay14d: Array<{ day: string; visits: number }>;
  topReferrers30d: Array<{ referrer: string; visits: number }>;
  supportByCategory30d: Array<{ category: string; count: number }>;
  researchPrinciples: string[];
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
    plan: string | null;
    category: string | null;
    severity: string | null;
    subject: string | null;
    message: string;
    page: string | null;
    ai_summary: string | null;
    ai_category: string | null;
    ai_priority: string | null;
    ai_suggested_action: string | null;
    ai_owner_brief: string | null;
    status: string;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(`
    select id, email, plan, category, severity, subject, message, page,
      ai_summary, ai_category, ai_priority, ai_suggested_action, ai_owner_brief, status, metadata, created_at
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
      plan: row.plan,
      category: row.category,
      severity: row.severity,
      subject: row.subject,
      message: row.message,
      page: row.page,
      ai: {
        summary: row.ai_summary,
        category: row.ai_category,
        priority: row.ai_priority,
        suggestedAction: row.ai_suggested_action,
        ownerBrief: row.ai_owner_brief,
      },
      status: row.status,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    })),
    segments: (segments?.rows || []).map((row) => ({ persona: row.persona || "unknown", count: Number(row.count || 0) })),
    sources: (sources?.rows || []).map((row) => ({ source: row.source || "unknown", count: Number(row.count || 0) })),
    pages: (pages?.rows || []).map((row) => ({ path: row.path, visits: Number(row.visits || 0) })),
    channelTracker: await loadChannelTracker(),
    manualPostQueue: await loadManualPostQueue(),
    tasks: buildTasks(countMap),
    outreachDrafts: buildOutreachDrafts(),
  };
}

export async function growthIntelligenceTelemetry(): Promise<GrowthIntelligenceTelemetry> {
  const snapshot = await growthSnapshot();
  const leads7d = await query<{ count: string }>(`
    select count(*)::text as count
    from wf_marketing_leads
    where created_at > now() - interval '7 days'
  `);
  const usageByFeature30d = await query<{ feature: string | null; count: string }>(`
    select coalesce(nullif(feature, ''), 'unknown') as feature, count(*)::text as count
    from wf_usage_events
    where created_at > now() - interval '30 days'
    group by 1
    order by count(*) desc, feature
    limit 12
  `);
  const usageByDay14d = await query<{ day: string; events: string }>(`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::text as events
    from wf_usage_events
    where created_at > now() - interval '14 days'
    group by 1
    order by 1 asc
  `);
  const visitsByDay14d = await query<{ day: string; visits: string }>(`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::text as visits
    from wf_page_events
    where created_at > now() - interval '14 days'
    group by 1
    order by 1 asc
  `);
  const topReferrers30d = await query<{ referrer: string | null; visits: string }>(`
    select coalesce(nullif(referrer, ''), 'direct') as referrer, count(*)::text as visits
    from wf_page_events
    where created_at > now() - interval '30 days'
    group by 1
    order by count(*) desc, referrer
    limit 12
  `);
  const supportByCategory30d = await query<{ category: string | null; count: string }>(`
    select coalesce(nullif(category, ''), 'uncategorized') as category, count(*)::text as count
    from wf_support_messages
    where created_at > now() - interval '30 days'
    group by 1
    order by count(*) desc, category
    limit 12
  `);

  const recentLeads = Number(leads7d?.rows?.[0]?.count || 0);
  const totalLeads = snapshot.counts.leads || 0;
  const trials = snapshot.counts.trials || 0;
  const customers = snapshot.counts.customers || 0;
  const visits7d = snapshot.counts.visits_7d || 0;
  const usage7d = snapshot.counts.usage_7d || 0;

  return {
    snapshot,
    funnel: {
      visits7d,
      leads7d: recentLeads,
      totalLeads,
      trials,
      customers,
      usage7d,
      visitorToLeadRate7dPct: pct(recentLeads, visits7d),
      leadToTrialRatePct: pct(trials, totalLeads),
      trialToCustomerRatePct: pct(customers, trials),
    },
    usageByFeature30d: (usageByFeature30d?.rows || []).map((row) => ({ feature: row.feature || "unknown", count: Number(row.count || 0) })),
    usageByDay14d: (usageByDay14d?.rows || []).map((row) => ({ day: row.day, events: Number(row.events || 0) })),
    visitsByDay14d: (visitsByDay14d?.rows || []).map((row) => ({ day: row.day, visits: Number(row.visits || 0) })),
    topReferrers30d: (topReferrers30d?.rows || []).map((row) => ({ referrer: row.referrer || "direct", visits: Number(row.visits || 0) })),
    supportByCategory30d: (supportByCategory30d?.rows || []).map((row) => ({ category: row.category || "uncategorized", count: Number(row.count || 0) })),
    researchPrinciples: [
      "Optimize for first useful output: a visitor should reach an EA draft, compiler diagnosis, or risk/readiness result before being asked for a heavy commitment.",
      "Track the full funnel separately: visitor -> opt-in lead -> activated user -> trial -> paid customer. Do not judge acquisition only by page views.",
      "Use high-intent channels first: public MT4/MT5 compiler errors, invalid stops, no-trades-in-tester questions, and MQL freelancer feedback threads.",
      "Answer the technical fix before adding a link. Link only when the Workfusion page directly continues the debugging path.",
      "Keep Workfusionapp commercial and BoltIQ internal. Workfusion messaging is a software workflow for EA builders, not trading performance, signals, or fund promotion.",
      "Do not scrape or buy bulk email lists. Use opt-in leads, manual community help, support feedback, and partner feedback loops.",
    ],
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

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
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

async function loadManualPostQueue(): Promise<GrowthManualPost[]> {
  try {
    const dir = join(process.cwd(), "reports/growth");
    const files = (await readdir(dir))
      .filter((file) => /^workfusion_autopilot_outbox_\d{4}-\d{2}-\d{2}\.json$/u.test(file))
      .sort();
    const latest = files.at(-1);
    if (!latest) return [];
    const parsed = JSON.parse(await readFile(join(dir, latest), "utf8")) as {
      manualReviewQueue?: Array<Partial<GrowthManualPost>>;
    };
    return (parsed.manualReviewQueue || []).map((item) => ({
      channel: String(item.channel || "Manual"),
      title: String(item.title || "Untitled"),
      url: String(item.url || ""),
      shareUrl: String(item.shareUrl || ""),
      websiteUrl: String(item.websiteUrl || ""),
      linkPolicy: String(item.linkPolicy || "manual_review"),
      status: String(item.status || "manual_required"),
      body: String(item.body || ""),
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
      priority: "P1",
      title: "Ask one MQL freelancer for workflow feedback",
      detail: "Send one manual partner message to a relevant MQL freelancer. Ask for feedback, not promotion, and keep Workfusion separate from BoltIQ.",
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
      title: "Workflow feedback partner ask",
      body:
        "Hi [Name], I am building Workfusionapp, an AI EA Generator + Debugger for MT4/MT5 builders.\n\nI am not trying to replace serious MQL freelancers. The angle is to help traders create cleaner first drafts, capture compiler diagnostics, run a basic risk/readiness check, and then hand a better brief to a developer for serious review.\n\nWould you be open to giving feedback on the workflow from a freelancer perspective?\n\nWhat I would like to learn:\n1. where client EA briefs usually fail;\n2. which compiler/runtime errors waste the most time;\n3. whether a tool like this could help you receive cleaner jobs;\n4. what boundaries are needed so clients do not think AI output replaces professional review.\n\nWebsite: https://www.workfusionapp.com\n\nNo broker access, no trading credentials, no profit promises. Just product workflow feedback.",
    },
    {
      channel: "MQL freelancer",
      title: "Freelancer collaboration boundary",
      body:
        "For clarity, Workfusionapp is a software workflow tool: generate EA drafts, debug compiler errors, risk-check drafts, save projects, and download MQL outputs.\n\nIt should not be positioned as a signal service or guaranteed profitable EA generator.\n\nThe partner angle I am exploring is simple: if MQL freelancers find it useful, Workfusion could become a pre-review tool that helps clients describe jobs better before hiring a developer.\n\nI am looking for feedback first, not asking for paid promotion.",
    },
    {
      channel: "Forum answer",
      title: "No-spam support answer",
      body:
        "If someone asks about a specific compiler error, answer the fix first. Add one relevant Workfusion guide only when it helps them continue the debugging path.",
    },
  ];
}
