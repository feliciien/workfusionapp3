export type WorkfusionSourceTag =
  | "direct"
  | "github"
  | "linkedin"
  | "codex"
  | "mql5_forum"
  | "forex_factory"
  | "earnforex_forum"
  | "forum_reply"
  | "search"
  | "other";

export type WorkfusionConversionPath =
  | "homepage"
  | "compiler_fixer"
  | "ea_generator"
  | "mt4_debugger"
  | "risk_checker"
  | "code_review"
  | "resource_guide"
  | "resources_hub"
  | "pricing"
  | "support"
  | "updates"
  | "unknown";

export function sourceTagFrom(input: { referrer?: string; url?: string; explicit?: string }): WorkfusionSourceTag {
  const explicit = normalizeSourceAlias(normalize(input.explicit));
  if (isKnownSource(explicit)) return explicit;

  const haystack = `${input.referrer || ""} ${input.url || ""}`.toLowerCase();
  const url = safeUrl(input.url || "");
  const ref = safeUrl(input.referrer || "");
  const utm = normalizeSourceAlias(normalize(url?.searchParams.get("utm_source") || url?.searchParams.get("source") || url?.searchParams.get("ref")));
  if (isKnownSource(utm)) return utm;

  if (/github\.com|github/u.test(haystack)) return "github";
  if (/linkedin\.com|lnkd\.in|linkedin/u.test(haystack)) return "linkedin";
  if (/codex|chatgpt|openai/u.test(haystack)) return "codex";
  if (/mql5\.com/u.test(haystack)) return "mql5_forum";
  if (/forexfactory\.com/u.test(haystack)) return "forex_factory";
  if (/earnforex\.com/u.test(haystack)) return "earnforex_forum";
  if (/forum|thread|community/u.test(haystack)) return "forum_reply";
  if (/google\.|bing\.|duckduckgo|yahoo\./u.test(haystack)) return "search";
  if (url && ref && url.hostname === ref.hostname) return "direct";
  if (!input.referrer && !ref) return "direct";
  return "other";
}

export function conversionPathFrom(input: { path?: string; intent?: string; explicit?: string }): WorkfusionConversionPath {
  const explicit = normalize(input.explicit);
  if (isKnownConversionPath(explicit)) return explicit;
  const rawPath = String(input.path || "");
  const parsedPath = safeUrl(rawPath)?.pathname || rawPath;
  const path = normalize(parsedPath);
  const intent = normalize(input.intent);

  if (intent === "compiler_error") return "compiler_fixer";
  if (intent === "ea_draft") return "ea_generator";
  if (intent === "risk_check") return "risk_checker";
  if (path === "/" || path === "") return "homepage";
  if (path.includes("mql5-compiler-fixer")) return "compiler_fixer";
  if (path.includes("mt5-ea-generator")) return "ea_generator";
  if (path.includes("mt4-ea-debugger")) return "mt4_debugger";
  if (path.includes("prop-firm-ea-risk-checker")) return "risk_checker";
  if (path.includes("prop-firm-payout-tracker")) return "risk_checker";
  if (path.includes("mql5-code-review")) return "code_review";
  if (path === "/resources") return "resources_hub";
  if (path.includes("/resources/")) return "resource_guide";
  if (path.includes("pricing")) return "pricing";
  if (path.includes("support")) return "support";
  if (path.includes("updates")) return "updates";
  return "unknown";
}

export function attributionFrom(input: {
  referrer?: string;
  url?: string;
  path?: string;
  intent?: string;
  sourceTag?: string;
  conversionPath?: string;
}) {
  return {
    sourceTag: sourceTagFrom({ referrer: input.referrer, url: input.url, explicit: input.sourceTag }),
    conversionPath: conversionPathFrom({ path: input.path, intent: input.intent, explicit: input.conversionPath }),
  };
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/gu, "_");
}

function safeUrl(value: string) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function normalizeSourceAlias(value: string) {
  if (value === "mql5" || value === "mql5_forum_reply") return "mql5_forum";
  if (value === "forex_factory" || value === "forexfactory") return "forex_factory";
  if (value === "earnforex") return "earnforex_forum";
  if (value === "forum" || value === "forums") return "forum_reply";
  if (value === "openai" || value === "chatgpt") return "codex";
  return value;
}

function isKnownSource(value: string): value is WorkfusionSourceTag {
  return ["direct", "github", "linkedin", "codex", "mql5_forum", "forex_factory", "earnforex_forum", "forum_reply", "search", "other"].includes(value);
}

function isKnownConversionPath(value: string): value is WorkfusionConversionPath {
  return ["homepage", "compiler_fixer", "ea_generator", "mt4_debugger", "risk_checker", "code_review", "resource_guide", "resources_hub", "pricing", "support", "updates", "unknown"].includes(value);
}
