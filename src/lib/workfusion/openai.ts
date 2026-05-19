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
