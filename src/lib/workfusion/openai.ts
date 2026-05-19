import OpenAI from "openai";

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
