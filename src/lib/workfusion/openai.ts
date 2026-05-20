import OpenAI from "openai";
import type { GrowthIntelligenceTelemetry } from "./growth-store";

const DEFAULT_MODEL = "gpt-5.5";

export type WorkfusionAiResult = {
  ok: boolean;
  provider: "openai";
  model: string;
  parsed?: Record<string, unknown>;
  text?: string;
  error?: string;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

let client: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function workfusionModel() {
  return process.env.WORKFUSION_OPENAI_MODEL || DEFAULT_MODEL;
}

export function workfusionGrowthModel() {
  return process.env.WORKFUSION_GROWTH_OPENAI_MODEL || "gpt-5.4-mini";
}

export function aiMeta(result: WorkfusionAiResult) {
  return {
    provider: result.provider,
    status: result.ok ? "live" : "fallback",
    error: result.ok ? undefined : result.error,
  };
}

export async function askWorkfusionAi(input: {
  task: "generate" | "debug" | "optimize" | "debrief";
  payload: Record<string, unknown>;
  localBaseline: Record<string, JsonValue>;
  schema: Record<string, string>;
}): Promise<WorkfusionAiResult> {
  const model = workfusionModel();
  const openai = getClient();
  if (!openai) {
    return {
      ok: false,
      provider: "openai",
      model,
      error: "OPENAI_API_KEY is not configured.",
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.WORKFUSION_OPENAI_TIMEOUT_MS || 25000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await openai.responses.create({
      model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content:
            "You are Workfusion Trading AI, an EA engineering assistant for MT4/MT5 builders. Produce practical, compile-aware EA drafts and risk reviews. Preserve prop-firm discipline: no profit guarantees, no martingale promotion, no live-trading certainty. Return only valid JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: input.task,
            output_contract: input.schema,
            local_baseline: input.localBaseline,
            user_payload: input.payload,
          }),
        },
      ],
    } as Parameters<typeof openai.responses.create>[0], { signal: controller.signal } as never);

    const text = String((response as { output_text?: string }).output_text || "");
    return {
      ok: true,
      provider: "openai",
      model,
      text,
      parsed: parseJsonObject(text),
    };
  } catch (error) {
    return {
      ok: false,
      provider: "openai",
      model,
      error: error instanceof Error ? error.message : "OpenAI request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type SupportAiAnalysis = {
  ok: boolean;
  summary: string;
  category: "bug" | "billing" | "feature_request" | "compiler_error" | "account" | "feedback" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  suggestedAction: string;
  ownerBrief: string;
  error?: string;
};

export type GrowthIntelligenceResult = {
  ok: boolean;
  ai: {
    provider: "openai";
    status: "live" | "fallback";
    model: string;
    error?: string;
  };
  generatedAt: string;
  objective: string;
  headline: string;
  diagnosis: string;
  confidence: "low" | "medium" | "high";
  scorecard: {
    visits7d: number;
    leads7d: number;
    totalLeads: number;
    trials: number;
    customers: number;
    usage7d: number;
    visitorToLeadRate7dPct: number;
    leadToTrialRatePct: number;
    trialToCustomerRatePct: number;
    topPage: string;
  };
  benchmarks: Array<{
    metric: string;
    current: string;
    target: string;
    basis: string;
    whyItMatters: string;
  }>;
  priorities: Array<{
    priority: "P0" | "P1" | "P2";
    title: string;
    why: string;
    action: string;
    metric: string;
    expectedImpact: string;
    deadline: string;
  }>;
  experiments: Array<{
    name: string;
    hypothesis: string;
    setup: string;
    successMetric: string;
    stopRule: string;
  }>;
  channelPlan: Array<{
    sourceTag: string;
    channel: string;
    action: string;
    draft: string;
    linkPolicy: string;
    metric: string;
  }>;
  partnerOutreach: {
    targetProfile: string;
    qualificationQuestions: string[];
    draft: string;
    doNotSay: string[];
  };
  automationRules: Array<{
    trigger: string;
    action: string;
    guardrail: string;
  }>;
  instrumentationGaps: string[];
  risks: string[];
};

export async function analyzeGrowthIntelligence(telemetry: GrowthIntelligenceTelemetry): Promise<GrowthIntelligenceResult> {
  const fallback = localGrowthIntelligence(telemetry);
  const model = workfusionGrowthModel();
  const openai = getClient();
  if (!openai) {
    return {
      ...fallback,
      ok: false,
      ai: {
        provider: "openai",
        status: "fallback",
        model,
        error: "OPENAI_API_KEY is not configured.",
      },
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.WORKFUSION_GROWTH_OPENAI_TIMEOUT_MS || process.env.WORKFUSION_OPENAI_TIMEOUT_MS || 60000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await openai.responses.create({
      model,
      reasoning: { effort: "low" },
      text: {
        verbosity: "medium",
        format: growthIntelligenceTextFormat,
      },
      max_output_tokens: 7000,
      input: [
        {
          role: "system",
          content:
            "You are the Workfusionapp Growth Intelligence engine. Workfusionapp is a commercial software product for MT4/MT5 EA builders: EA generation, code fixing, compile checks, backtest estimates, risk/readiness scoring, projects, and downloads. Use only the supplied telemetry and research principles. Do not invent hidden data or claim results that are not in telemetry. Never recommend scraped emails, bought lists, spam, fake accounts, or guaranteed trading results. Keep Workfusionapp separate from BoltIQ, which is internal trading/fund infrastructure. Produce specific owner actions, measurable experiments, and channel drafts that can be manually reviewed before posting.",
        },
        {
          role: "user",
          content: JSON.stringify({
            objective:
              "Find the fastest ethical path to first paid Workfusionapp users using real telemetry, support blockers, SEO traction, high-intent EA communities, and opt-in CRM data.",
            output_rules: [
              "Return concrete actions, not generic marketing advice.",
              "Use exact numbers from telemetry in diagnosis and scorecard.",
              "If data volume is too small, say so and propose the next measurement step.",
              "One link per draft maximum, only if it helps the user continue a technical debugging path.",
              "No autoposting. Manual review remains required for external channels.",
            ],
            telemetry: safeGrowthTelemetry(telemetry),
          }),
        },
      ],
    } as Parameters<typeof openai.responses.create>[0], { signal: controller.signal } as never);

    const text = String((response as { output_text?: string }).output_text || "");
    return normalizeGrowthIntelligence(parseJsonObject(text), fallback, model);
  } catch (error) {
    return {
      ...fallback,
      ok: false,
      ai: {
        provider: "openai",
        status: "fallback",
        model,
        error: error instanceof Error ? error.message : "OpenAI growth intelligence failed.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeSupportMessage(input: {
  email?: string;
  category?: string;
  subject?: string;
  message: string;
  page?: string;
  plan?: string;
}): Promise<SupportAiAnalysis> {
  const fallback = localSupportAnalysis(input);
  const model = workfusionModel();
  const openai = getClient();
  if (!openai) {
    return {
      ...fallback,
      ok: false,
      error: "OPENAI_API_KEY is not configured.",
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.WORKFUSION_OPENAI_TIMEOUT_MS || 25000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await openai.responses.create({
      model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content:
            "You classify Workfusion support messages for an MT4/MT5 EA generator SaaS. Return only valid JSON with keys: summary, category, priority, suggestedAction, ownerBrief. Do not make trading promises. Keep ownerBrief short and actionable.",
        },
        {
          role: "user",
          content: JSON.stringify({
            allowed_categories: ["bug", "billing", "feature_request", "compiler_error", "account", "feedback", "other"],
            allowed_priorities: ["low", "normal", "high", "urgent"],
            ticket: input,
          }),
        },
      ],
    } as Parameters<typeof openai.responses.create>[0], { signal: controller.signal } as never);

    const text = String((response as { output_text?: string }).output_text || "");
    const parsed = parseJsonObject(text) || {};
    const category = supportCategory(parsed.category, fallback.category);
    const priority = supportPriority(parsed.priority, fallback.priority);
    return {
      ok: true,
      summary: stringField(parsed.summary, fallback.summary).slice(0, 600),
      category,
      priority,
      suggestedAction: stringField(parsed.suggestedAction, fallback.suggestedAction).slice(0, 800),
      ownerBrief: stringField(parsed.ownerBrief, fallback.ownerBrief).slice(0, 800),
    };
  } catch (error) {
    return {
      ...fallback,
      ok: false,
      error: error instanceof Error ? error.message : "OpenAI support analysis failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const growthIntelligenceTextFormat = {
  type: "json_schema",
  name: "workfusion_growth_intelligence",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "generatedAt",
      "objective",
      "headline",
      "diagnosis",
      "confidence",
      "scorecard",
      "benchmarks",
      "priorities",
      "experiments",
      "channelPlan",
      "partnerOutreach",
      "automationRules",
      "instrumentationGaps",
      "risks",
    ],
    properties: {
      generatedAt: { type: "string" },
      objective: { type: "string" },
      headline: { type: "string" },
      diagnosis: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      scorecard: {
        type: "object",
        additionalProperties: false,
        required: [
          "visits7d",
          "leads7d",
          "totalLeads",
          "trials",
          "customers",
          "usage7d",
          "visitorToLeadRate7dPct",
          "leadToTrialRatePct",
          "trialToCustomerRatePct",
          "topPage",
        ],
        properties: {
          visits7d: { type: "number" },
          leads7d: { type: "number" },
          totalLeads: { type: "number" },
          trials: { type: "number" },
          customers: { type: "number" },
          usage7d: { type: "number" },
          visitorToLeadRate7dPct: { type: "number" },
          leadToTrialRatePct: { type: "number" },
          trialToCustomerRatePct: { type: "number" },
          topPage: { type: "string" },
        },
      },
      benchmarks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["metric", "current", "target", "basis", "whyItMatters"],
          properties: {
            metric: { type: "string" },
            current: { type: "string" },
            target: { type: "string" },
            basis: { type: "string" },
            whyItMatters: { type: "string" },
          },
        },
      },
      priorities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "title", "why", "action", "metric", "expectedImpact", "deadline"],
          properties: {
            priority: { type: "string", enum: ["P0", "P1", "P2"] },
            title: { type: "string" },
            why: { type: "string" },
            action: { type: "string" },
            metric: { type: "string" },
            expectedImpact: { type: "string" },
            deadline: { type: "string" },
          },
        },
      },
      experiments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "hypothesis", "setup", "successMetric", "stopRule"],
          properties: {
            name: { type: "string" },
            hypothesis: { type: "string" },
            setup: { type: "string" },
            successMetric: { type: "string" },
            stopRule: { type: "string" },
          },
        },
      },
      channelPlan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceTag", "channel", "action", "draft", "linkPolicy", "metric"],
          properties: {
            sourceTag: { type: "string" },
            channel: { type: "string" },
            action: { type: "string" },
            draft: { type: "string" },
            linkPolicy: { type: "string" },
            metric: { type: "string" },
          },
        },
      },
      partnerOutreach: {
        type: "object",
        additionalProperties: false,
        required: ["targetProfile", "qualificationQuestions", "draft", "doNotSay"],
        properties: {
          targetProfile: { type: "string" },
          qualificationQuestions: { type: "array", items: { type: "string" } },
          draft: { type: "string" },
          doNotSay: { type: "array", items: { type: "string" } },
        },
      },
      automationRules: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["trigger", "action", "guardrail"],
          properties: {
            trigger: { type: "string" },
            action: { type: "string" },
            guardrail: { type: "string" },
          },
        },
      },
      instrumentationGaps: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
  },
};

function safeGrowthTelemetry(telemetry: GrowthIntelligenceTelemetry) {
  const snapshot = telemetry.snapshot;
  return {
    generated_at: new Date().toISOString(),
    storage: snapshot.storage,
    counts: snapshot.counts,
    funnel: telemetry.funnel,
    pages_30d: snapshot.pages,
    usage_by_feature_30d: telemetry.usageByFeature30d,
    usage_by_day_14d: telemetry.usageByDay14d,
    visits_by_day_14d: telemetry.visitsByDay14d,
    top_referrers_30d: telemetry.topReferrers30d,
    support_by_category_30d: telemetry.supportByCategory30d,
    lead_segments: snapshot.segments,
    lead_sources: snapshot.sources,
    lead_pipeline_without_pii: snapshot.leads.slice(0, 25).map((lead) => ({
      persona: lead.persona || "unknown",
      source: lead.source || "unknown",
      stage: lead.stage,
      score: lead.score,
      notes: lead.notes.slice(0, 300),
    })),
    support_without_pii: snapshot.support.slice(0, 12).map((ticket) => ({
      category: ticket.category || ticket.ai.category || "unknown",
      severity: ticket.severity || ticket.ai.priority || "normal",
      status: ticket.status,
      subject: ticket.subject || "",
      page: ticket.page || "",
      ai_summary: ticket.ai.summary || "",
      ai_owner_brief: ticket.ai.ownerBrief || "",
    })),
    channel_tracker: snapshot.channelTracker,
    manual_post_queue: snapshot.manualPostQueue.map((post) => ({
      channel: post.channel,
      title: post.title,
      websiteUrl: post.websiteUrl,
      linkPolicy: post.linkPolicy,
      status: post.status,
      body: post.body,
    })),
    static_tasks: snapshot.tasks,
    static_outreach_drafts: snapshot.outreachDrafts,
    research_principles: telemetry.researchPrinciples,
  };
}

function localGrowthIntelligence(telemetry: GrowthIntelligenceTelemetry): GrowthIntelligenceResult {
  const snapshot = telemetry.snapshot;
  const topPage = snapshot.pages[0]?.path || "none";
  const hasLeads = telemetry.funnel.totalLeads > 0;
  const hasVisits = telemetry.funnel.visits7d > 0;
  const headline = hasVisits && !hasLeads
    ? "Traffic exists, but the CRM has no opt-in leads yet."
    : hasLeads
      ? "Lead follow-up and activation are now the growth bottleneck."
      : "The next growth step is measurable traffic plus first opt-in feedback.";

  return {
    ok: false,
    ai: {
      provider: "openai",
      status: "fallback",
      model: workfusionGrowthModel(),
      error: "Using local growth fallback.",
    },
    generatedAt: new Date().toISOString(),
    objective: "Convert high-intent MT4/MT5 EA builders into opt-in Workfusionapp testers and first paid users.",
    headline,
    diagnosis: [
      `Current telemetry shows ${telemetry.funnel.visits7d} visits in 7 days, ${telemetry.funnel.leads7d} new leads in 7 days, ${telemetry.funnel.totalLeads} total leads, ${telemetry.funnel.trials} trials, ${telemetry.funnel.customers} customers, and ${telemetry.funnel.usage7d} usage events in 7 days.`,
      `The top page is ${topPage}. With this data volume, the main decision is not scaling paid acquisition yet. The practical priority is to prove one repeatable activation loop: user lands on a compiler/generator page, runs a useful EA workflow, opts in, and reports whether the output helped.`,
    ].join(" "),
    confidence: telemetry.funnel.visits7d >= 100 && telemetry.funnel.totalLeads >= 10 ? "medium" : "low",
    scorecard: {
      visits7d: telemetry.funnel.visits7d,
      leads7d: telemetry.funnel.leads7d,
      totalLeads: telemetry.funnel.totalLeads,
      trials: telemetry.funnel.trials,
      customers: telemetry.funnel.customers,
      usage7d: telemetry.funnel.usage7d,
      visitorToLeadRate7dPct: telemetry.funnel.visitorToLeadRate7dPct,
      leadToTrialRatePct: telemetry.funnel.leadToTrialRatePct,
      trialToCustomerRatePct: telemetry.funnel.trialToCustomerRatePct,
      topPage,
    },
    benchmarks: [
      {
        metric: "Visitor to opt-in lead",
        current: `${telemetry.funnel.visitorToLeadRate7dPct}% over the last 7 days`,
        target: "First internal target: 2%+ after the CTA and support loop are instrumented",
        basis: "Internal early-stage benchmark; traffic is still too small for a stable external comparison.",
        whyItMatters: "Without opt-in leads, community activity cannot be followed up or converted into paid trials.",
      },
      {
        metric: "Activation proxy",
        current: `${telemetry.funnel.usage7d} usage events in 7 days`,
        target: "10+ weekly EA workflow runs from real visitors",
        basis: "Internal product-led activation target for the first customer discovery loop.",
        whyItMatters: "Workfusionapp must prove users can get value before pricing optimization matters.",
      },
    ],
    priorities: [
      {
        priority: "P0",
        title: "Fix the no-lead bottleneck",
        why: "The CRM currently has no opt-in path converting traffic into follow-up conversations.",
        action: "Add or verify a clear CTA near Generate EA, Fix code, Compile check, and Backtest estimate: 'Send me the fixed EA result and debugging checklist'.",
        metric: "visitor_to_lead_rate_7d",
        expectedImpact: "Turns anonymous visits into follow-upable testers.",
        deadline: "today",
      },
      {
        priority: "P1",
        title: "Use support as conversion research",
        why: `${snapshot.counts.open_support || 0} open support items are visible. Each blocker should map to one product fix or one SEO guide improvement.`,
        action: "Keep support tagged by blocker and update one page/draft when the same blocker appears twice.",
        metric: "support_blockers_closed",
        expectedImpact: "Removes friction before asking for subscription.",
        deadline: "daily",
      },
      {
        priority: "P1",
        title: "Ask one MQL freelancer for workflow feedback",
        why: "Freelancers know the exact EA brief and compiler errors that waste time.",
        action: "Send one manual feedback request and track it as partner_mql_freelancer. Ask for workflow feedback, not promotion.",
        metric: "freelancer_feedback_replies",
        expectedImpact: "Improves positioning and creates a credible distribution path without spam.",
        deadline: "today",
      },
    ],
    experiments: [
      {
        name: "Compiler-first CTA",
        hypothesis: "Visitors with compiler errors are more likely to opt in if the CTA promises a fixed output plus a debug checklist instead of a generic newsletter.",
        setup: "Add CTA copy to the MQL5 compiler fixer and generated output panel. Track opt-in source path.",
        successMetric: "2%+ visitor-to-lead rate on compiler-related pages over 7 days.",
        stopRule: "Stop or rewrite if 100 targeted visits produce zero opt-ins.",
      },
      {
        name: "Freelancer feedback loop",
        hypothesis: "MQL freelancers will identify the language that makes Workfusionapp useful without positioning it as a replacement.",
        setup: "Send 5 manual messages to relevant MQL freelancers and log replies in CRM notes.",
        successMetric: "2+ substantive replies or 1 concrete workflow improvement.",
        stopRule: "Stop after 5 no-replies and rewrite the ask.",
      },
    ],
    channelPlan: [
      {
        sourceTag: "mql5_codebase_forum",
        channel: "MQL5 Forum",
        action: "Answer one compiler-error thread with the fix first.",
        draft: "The first thing I would check is the exact MetaEditor error line and whether the include/trade object exists for the platform version. If the error is undeclared identifier or wrong parameters count, isolate the smallest failing function and compile that first. If useful, this guide continues the same debugging path: https://www.workfusionapp.com/mql5-compiler-fixer",
        linkPolicy: "Use the link only when the thread is specifically about compiler errors.",
        metric: "qualified_visits_from_mql5",
      },
      {
        sourceTag: "partner_mql_freelancer",
        channel: "MQL freelancer",
        action: "Ask for workflow feedback.",
        draft: "Hi [Name], I am building Workfusionapp for MT4/MT5 EA builders. I am not positioning it as a replacement for serious MQL freelancers. The goal is cleaner first drafts, compiler diagnostics, and risk/readiness notes before a developer does serious review. Would you be open to giving feedback on where client EA briefs usually fail? Website: https://www.workfusionapp.com",
        linkPolicy: "One direct product link is acceptable because this is a private feedback ask.",
        metric: "freelancer_feedback_replies",
      },
    ],
    partnerOutreach: {
      targetProfile: "Independent MQL4/MQL5 freelancer who builds EAs, fixes compiler errors, or reviews trading bots for clients.",
      qualificationQuestions: [
        "Which client EA briefs are usually incomplete?",
        "Which MetaEditor errors waste the most time?",
        "Would a pre-review tool help you receive cleaner jobs?",
        "What should the product never claim?",
      ],
      draft: "Hi [Name], I am building Workfusionapp, an AI EA Generator + Debugger for MT4/MT5 builders. I am looking for freelancer workflow feedback, not promotion. The product helps create cleaner EA drafts, capture compiler diagnostics, run a basic risk/readiness check, and package outputs before a professional review. Would you be open to a quick async review from a freelancer perspective? https://www.workfusionapp.com",
      doNotSay: [
        "Do not say Workfusion replaces MQL freelancers.",
        "Do not promise profitable EAs.",
        "Do not mention BoltIQ or hedge fund plans.",
        "Do not ask for broker credentials or account access.",
      ],
    },
    automationRules: [
      {
        trigger: "New support ticket with compiler_error or generated_code_quality",
        action: "Tag blocker, draft reply, and add the exact error pattern to the next SEO/support update.",
        guardrail: "Do not auto-send external replies.",
      },
      {
        trigger: "SEO page gets 50 visits in 7 days and zero leads",
        action: "Flag the page for CTA rewrite and add a more specific lead capture offer.",
        guardrail: "Do not start paid promotion until the page captures at least one qualified lead.",
      },
    ],
    instrumentationGaps: [
      "Track Generate EA, Fix code, Compile check, Backtest estimate, Download, Pricing click, and PayPal checkout events as separate activation events.",
      "Store lead source path and first feature used so conversion can be tied to the real workflow.",
    ],
    risks: [
      "Autoposting to communities can damage reputation; keep external posts manual-review only.",
      "Do not mix BoltIQ partner conversations with Workfusionapp customer acquisition.",
      "Page views without activation events can create false confidence.",
    ],
  };
}

function normalizeGrowthIntelligence(parsed: Record<string, unknown> | undefined, fallback: GrowthIntelligenceResult, model: string): GrowthIntelligenceResult {
  if (!parsed) {
    return {
      ...fallback,
      ok: false,
      ai: {
        provider: "openai",
        status: "fallback",
        model,
        error: "OpenAI returned an unparsable growth response.",
      },
    };
  }

  const scorecardValue = parsed.scorecard && typeof parsed.scorecard === "object" && !Array.isArray(parsed.scorecard)
    ? parsed.scorecard as Record<string, unknown>
    : {};
  const partnerValue = parsed.partnerOutreach && typeof parsed.partnerOutreach === "object" && !Array.isArray(parsed.partnerOutreach)
    ? parsed.partnerOutreach as Record<string, unknown>
    : {};

  return {
    ok: true,
    ai: { provider: "openai", status: "live", model },
    generatedAt: stringField(parsed.generatedAt, fallback.generatedAt),
    objective: stringField(parsed.objective, fallback.objective).slice(0, 500),
    headline: stringField(parsed.headline, fallback.headline).slice(0, 300),
    diagnosis: stringField(parsed.diagnosis, fallback.diagnosis).slice(0, 1800),
    confidence: confidenceField(parsed.confidence, fallback.confidence),
    scorecard: {
      visits7d: metricNumber(scorecardValue.visits7d, fallback.scorecard.visits7d),
      leads7d: metricNumber(scorecardValue.leads7d, fallback.scorecard.leads7d),
      totalLeads: metricNumber(scorecardValue.totalLeads, fallback.scorecard.totalLeads),
      trials: metricNumber(scorecardValue.trials, fallback.scorecard.trials),
      customers: metricNumber(scorecardValue.customers, fallback.scorecard.customers),
      usage7d: metricNumber(scorecardValue.usage7d, fallback.scorecard.usage7d),
      visitorToLeadRate7dPct: metricNumber(scorecardValue.visitorToLeadRate7dPct, fallback.scorecard.visitorToLeadRate7dPct),
      leadToTrialRatePct: metricNumber(scorecardValue.leadToTrialRatePct, fallback.scorecard.leadToTrialRatePct),
      trialToCustomerRatePct: metricNumber(scorecardValue.trialToCustomerRatePct, fallback.scorecard.trialToCustomerRatePct),
      topPage: stringField(scorecardValue.topPage, fallback.scorecard.topPage).slice(0, 120),
    },
    benchmarks: mapObjects(parsed.benchmarks, fallback.benchmarks, (item) => ({
      metric: stringField(item.metric, "Metric").slice(0, 120),
      current: stringField(item.current, "Unknown").slice(0, 180),
      target: stringField(item.target, "Define target").slice(0, 220),
      basis: stringField(item.basis, "Telemetry-informed target.").slice(0, 260),
      whyItMatters: stringField(item.whyItMatters, "This affects conversion quality.").slice(0, 300),
    })).slice(0, 6),
    priorities: mapObjects(parsed.priorities, fallback.priorities, (item) => ({
      priority: priorityField(item.priority),
      title: stringField(item.title, "Priority").slice(0, 140),
      why: stringField(item.why, "Based on current telemetry.").slice(0, 320),
      action: stringField(item.action, "Take one concrete growth action.").slice(0, 500),
      metric: stringField(item.metric, "metric").slice(0, 120),
      expectedImpact: stringField(item.expectedImpact, "Improve conversion learning.").slice(0, 220),
      deadline: stringField(item.deadline, "today").slice(0, 80),
    })).slice(0, 6),
    experiments: mapObjects(parsed.experiments, fallback.experiments, (item) => ({
      name: stringField(item.name, "Experiment").slice(0, 140),
      hypothesis: stringField(item.hypothesis, "A measurable growth hypothesis.").slice(0, 300),
      setup: stringField(item.setup, "Set up a small test.").slice(0, 500),
      successMetric: stringField(item.successMetric, "success metric").slice(0, 220),
      stopRule: stringField(item.stopRule, "Stop if there is no signal.").slice(0, 220),
    })).slice(0, 5),
    channelPlan: mapObjects(parsed.channelPlan, fallback.channelPlan, (item) => ({
      sourceTag: stringField(item.sourceTag, "manual").slice(0, 120),
      channel: stringField(item.channel, "Manual").slice(0, 120),
      action: stringField(item.action, "Manual review action").slice(0, 240),
      draft: stringField(item.draft, "Draft unavailable.").slice(0, 1400),
      linkPolicy: stringField(item.linkPolicy, "Manual review; link only if useful.").slice(0, 260),
      metric: stringField(item.metric, "qualified_replies").slice(0, 120),
    })).slice(0, 8),
    partnerOutreach: {
      targetProfile: stringField(partnerValue.targetProfile, fallback.partnerOutreach.targetProfile).slice(0, 260),
      qualificationQuestions: stringArrayField(partnerValue.qualificationQuestions, fallback.partnerOutreach.qualificationQuestions).slice(0, 8),
      draft: stringField(partnerValue.draft, fallback.partnerOutreach.draft).slice(0, 1400),
      doNotSay: stringArrayField(partnerValue.doNotSay, fallback.partnerOutreach.doNotSay).slice(0, 8),
    },
    automationRules: mapObjects(parsed.automationRules, fallback.automationRules, (item) => ({
      trigger: stringField(item.trigger, "Trigger").slice(0, 220),
      action: stringField(item.action, "Action").slice(0, 320),
      guardrail: stringField(item.guardrail, "Manual review required.").slice(0, 260),
    })).slice(0, 8),
    instrumentationGaps: stringArrayField(parsed.instrumentationGaps, fallback.instrumentationGaps).slice(0, 8),
    risks: stringArrayField(parsed.risks, fallback.risks).slice(0, 8),
  };
}

function mapObjects<T>(value: unknown, fallback: T[], mapper: (item: Record<string, unknown>) => T) {
  if (!Array.isArray(value)) return fallback;
  const mapped = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map(mapper);
  return mapped.length ? mapped : fallback;
}

function metricNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function confidenceField(value: unknown, fallback: GrowthIntelligenceResult["confidence"]) {
  const text = String(value || "");
  if (text === "low" || text === "medium" || text === "high") return text;
  return fallback;
}

function priorityField(value: unknown): "P0" | "P1" | "P2" {
  const text = String(value || "");
  if (text === "P0" || text === "P1" || text === "P2") return text;
  return "P1";
}

export function stringField(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

export function numberField(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.round(parsed))) : fallback;
}

export function stringArrayField(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const clean = value.map((item) => String(item || "").trim()).filter(Boolean);
  return clean.length ? clean : fallback;
}

export function recordField(value: unknown, fallback: Record<string, string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, item]) => {
    acc[key] = String(item);
    return acc;
  }, {});
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function localSupportAnalysis(input: { category?: string; subject?: string; message: string; page?: string }): SupportAiAnalysis {
  const text = `${input.category || ""} ${input.subject || ""} ${input.message || ""}`.toLowerCase();
  const compiler = /compile|compiler|mql|mq4|mq5|metaeditor|undeclared|error|ex5/u.test(text);
  const billing = /paypal|billing|payment|subscribe|subscription|premium|plan|invoice/u.test(text);
  const account = /login|sign in|account|email|password|session/u.test(text);
  const urgent = /blocked|broken|can't|cannot|urgent|critical|failed|crash|lost/u.test(text);
  const category = compiler ? "compiler_error" : billing ? "billing" : account ? "account" : urgent ? "bug" : "feedback";
  const priority = urgent || compiler || billing ? "high" : "normal";
  const summary = `${input.subject || "Support message"}: ${input.message}`.replace(/\s+/gu, " ").slice(0, 260);
  return {
    ok: false,
    summary,
    category,
    priority,
    suggestedAction: compiler
      ? "Ask for the MQL code, compiler output, platform version, and reproduce through the compile endpoint."
      : "Review the message, reproduce if it is a bug, and reply with the next concrete step.",
    ownerBrief: `[${priority.toUpperCase()}] ${category}: ${summary}${input.page ? ` Page: ${input.page}.` : ""}`,
  };
}

function supportCategory(value: unknown, fallback: SupportAiAnalysis["category"]): SupportAiAnalysis["category"] {
  const text = String(value || "");
  if (["bug", "billing", "feature_request", "compiler_error", "account", "feedback", "other"].includes(text)) {
    return text as SupportAiAnalysis["category"];
  }
  return fallback;
}

function supportPriority(value: unknown, fallback: SupportAiAnalysis["priority"]): SupportAiAnalysis["priority"] {
  const text = String(value || "");
  if (["low", "normal", "high", "urgent"].includes(text)) return text as SupportAiAnalysis["priority"];
  return fallback;
}
