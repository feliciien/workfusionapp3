"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

type TradingResult = {
  riskScore?: number;
  compliance?: number;
  fundingReadiness?: number;
  summary?: string;
  recommendation?: string;
  mql5Code?: string;
  fixedCode?: string;
  sourceCode?: string;
  checkedCode?: string;
  lastAction?: string;
  lastActionLabel?: string;
  issues?: string[];
  fixes?: string[];
  params?: Record<string, string>;
  filename?: string;
  worker?: string;
  status?: string;
  score?: number;
  diagnostics?: string[];
  warnings?: string[];
  resourceSlugs?: string[];
  compiled?: boolean;
  compiler?: {
    mode?: string;
    available?: boolean;
    message?: string;
    returnCode?: number | null;
    sourceFile?: string;
    artifactFile?: string;
    logFile?: string;
    logTail?: string[];
  };
  plan?: string;
  remaining?: Record<string, number>;
  ai?: {
    provider?: string;
    model?: string;
    status?: string;
    error?: string;
  };
  error?: string;
};

type ProjectSummary = {
  id: string;
  title: string;
  market: string;
  platform: string;
  riskScore: number;
  compliance: number;
  updatedAt: string;
};

type AccountStatus = {
  status: string;
  plan: string;
  storage?: string;
  authenticated?: boolean;
  user?: {
    email?: string;
    role?: string;
    authenticated?: boolean;
  };
  limits?: Record<string, number>;
  billing?: {
    mode?: string;
    stripeConfigured?: boolean;
    paypalConfigured?: boolean;
  };
  subscription?: {
    provider?: string;
    status?: string;
  } | null;
};

type Toast = {
  tone: "success" | "warning" | "error" | "info";
  title: string;
  body: string;
};

type FormStatus = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

const markets = ["Forex", "XAUUSD", "Indices", "Crypto"];
const presets = ["50k", "100k", "200k"];
const platforms = [
  { label: "MT5 (.mq5)", value: "mt5" },
  { label: "MT4 (.mq4)", value: "mt4" },
];

const leadIntentOptions = [
  { value: "compiler_error", label: "Paste compiler errors" },
  { value: "ea_draft", label: "Generate EA draft" },
  { value: "risk_check", label: "Get risk check" },
];

const proofCards = [
  ["Generate", "Turn a plain strategy brief into a complete MQL draft with risk controls."],
  ["Debug", "Paste compiler output and get a fixed EA replacement plus clear fix notes."],
  ["Compile", "Use MetaEditor when configured, or show an honest static pre-check."],
  ["Package", "Save projects, download MQL outputs, and keep a technical audit trail."],
];

const plans = [
  {
    name: "Free",
    key: "free",
    price: "$0",
    caption: "Validate the workflow.",
    features: ["3 generations", "1 optimizer run", "1 debug", "1 download"],
  },
  {
    name: "Starter",
    key: "starter",
    price: "$29/mo",
    caption: "For solo traders building first prototypes.",
    features: ["30 generations", "20 debugs", "20 downloads", "Project history"],
  },
  {
    name: "Pro",
    key: "pro",
    price: "$79/mo",
    caption: "Best fit for active EA builders.",
    features: ["150 generations", "150 debugs", "Optimizer", "Report analyzer"],
    highlight: true,
  },
  {
    name: "Studio",
    key: "studio",
    price: "$199/mo",
    caption: "For trading labs and agencies.",
    features: ["500 generations", "Team workflow", "Advanced QA", "API access"],
  },
];

const conversionProof = [
  ["First value", "Generate or debug an EA before paying."],
  ["Upgrade trigger", "Pay when quota, downloads, or optimizer depth becomes the bottleneck."],
  ["Risk posture", "No martingale promotion, no profit promises, no hidden model name."],
];

const seoLinks = [
  ["/updates", "Build Notes", "Public Workfusion notes on EA debugging patterns, compiler issues, and product workflow improvements."],
  ["/resources", "EA Builder Resource Hub", "Practical guides for compiler fixes, EA generation, debugging, prop risk, and code review."],
  ["/mql5-compiler-fixer", "MQL5 Compiler Fixer", "Fix MetaEditor errors and produce a complete corrected EA draft."],
  ["/mt5-ea-generator", "MT5 EA Generator", "Turn strategy ideas into structured MQL5 Expert Advisor drafts."],
  ["/mt4-ea-debugger", "MT4 EA Debugger", "Review and clean MQL4 EA code before manual compile testing."],
  ["/prop-firm-ea-risk-checker", "Prop Firm EA Risk Checker", "Check sizing, drawdown, spread, and funding-readiness controls."],
  ["/mql5-code-review", "MQL5 Code Review", "Review lifecycle, trade calls, risk gates, and readiness before backtesting."],
];

const workflowSteps = [
  ["1", "Describe the EA", "Market, platform, prop preset, risk cap, entry style, and exit rules."],
  ["2", "Generate or debug", "Create MQL, fix compiler errors, and inspect risk/readiness scores."],
  ["3", "Compile and package", "Run the compiler worker when configured, save projects, and download outputs."],
];

const commonMqlProblems = [
  {
    title: "Invalid volume 10014",
    body: "Lot size is 0.00, below min, above max, or not aligned to SYMBOL_VOLUME_STEP.",
    code: "#property strict\n#include <Trade/Trade.mqh>\nCTrade trade;\nvoid OnTick(){ double lots=0.00; trade.Buy(lots,_Symbol); }",
    errors: "order_send failed, retcode=10014\nTRADE_RETCODE_INVALID_VOLUME\nXAUUSD Buy 0.00 lots",
  },
  {
    title: "Unsupported filling 10030",
    body: "ORDER_FILLING_FOK/IOC/RETURN is hard-coded but the symbol does not support it.",
    code: "#property strict\n#include <Trade/Trade.mqh>\nCTrade trade;\nint OnInit(){ trade.SetTypeFilling(ORDER_FILLING_FOK); return(INIT_SUCCEEDED); }\nvoid OnTick(){ trade.Sell(0.10,_Symbol); }",
    errors: "failed market sell [Unsupported filling mode]\nretcode=10030\nTRADE_RETCODE_INVALID_FILL",
  },
  {
    title: "CopyBuffer array range",
    body: "The EA reads buffer[1] or buffer[2] without confirming enough indicator data was copied.",
    code: "#property strict\nint maHandle;\nint OnInit(){ maHandle=iMA(_Symbol,PERIOD_CURRENT,20,0,MODE_EMA,PRICE_CLOSE); return(INIT_SUCCEEDED); }\nvoid OnTick(){ double ma[]; CopyBuffer(maHandle,0,0,3,ma); Print(ma[2]); }",
    errors: "array out of range in 'Expert.mq5'\nCopyBuffer returned fewer values than requested",
  },
  {
    title: "Overfit backtest risk",
    body: "Strong optimization language but no walk-forward, OOS split, spread sensitivity, or segment stability.",
    code: "#property strict\n// Optimized EA shows a great backtest with 99% modeling quality but no walk-forward or out-of-sample evidence.\nvoid OnTick(){}",
    errors: "Backtest looks great in Strategy Tester but live/demo behavior is different. Possible overfit / curve fit / no walk-forward evidence.",
  },
];

function getGuestId() {
  const key = "workfusion_guest_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return "guest_ephemeral";
  }
}

function scoreColor(value = 0) {
  if (value >= 85) return "text-emerald-300";
  if (value >= 70) return "text-cyan-300";
  if (value >= 55) return "text-amber-300";
  return "text-rose-300";
}

function toneClasses(tone: Toast["tone"]) {
  if (tone === "success") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
  if (tone === "error") return "border-rose-400/40 bg-rose-400/10 text-rose-100";
  if (tone === "warning") return "border-amber-400/40 bg-amber-400/10 text-amber-100";
  return "border-cyan-400/40 bg-cyan-400/10 text-cyan-100";
}

function pickEaCode(result?: TradingResult | null, fallback = "") {
  return result?.fixedCode || result?.mql5Code || result?.sourceCode || result?.checkedCode || fallback;
}

function codeSourceLabel(result?: TradingResult | null, fallback = "") {
  if (result?.fixedCode) return "Fixed EA draft";
  if (result?.mql5Code) return "Generated EA draft";
  if (result?.sourceCode) return "Preserved EA draft";
  if (result?.checkedCode) return "Last checked EA draft";
  if (fallback.trim()) return "Manual debug input";
  return "No generated EA yet";
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function usageEventFor(endpoint: string, label: string) {
  if (endpoint === "/api/trading/generate") return { eventType: "start_generate", feature: "generate" };
  if (endpoint === "/api/trading/debug") return { eventType: "compiler_error_submitted", feature: "debug" };
  if (endpoint === "/api/workers/compile") return { eventType: "compile_check_started", feature: "compile_check" };
  if (endpoint === "/api/workers/backtest") return { eventType: "backtest_estimate_started", feature: "backtest_estimate" };
  if (endpoint === "/api/trading/download") return { eventType: "download_clicked", feature: "download" };
  if (endpoint === "/api/trading/optimize") return { eventType: "start_optimize", feature: "optimize" };
  if (endpoint === "/api/trading/debrief") return { eventType: "report_analyze_started", feature: "debrief" };
  return { eventType: "workflow_action_started", feature: label.toLowerCase().replace(/\s+/gu, "_") };
}

function activatedFollowupFor(result?: TradingResult | null) {
  if (!result || result.error) return null;
  if (result.lastAction === "/api/trading/generate") {
    return { feature: "generate", action: result.lastActionLabel || "Generate", intent: "ea_draft" };
  }
  if (result.lastAction === "/api/trading/debug") {
    return { feature: "debug", action: result.lastActionLabel || "Debug", intent: "compiler_error" };
  }
  if (result.lastAction === "/api/trading/download") {
    return { feature: "download", action: result.lastActionLabel || "Download", intent: "ea_draft" };
  }
  return null;
}

async function trackUsageEvent(eventType: string, feature: string, metadata: Record<string, unknown> = {}) {
  try {
    const page = window.location.pathname;
    const attribution = attributionFrom({
      referrer: document.referrer,
      url: window.location.href,
      path: page,
      intent: String(metadata.intent || ""),
      sourceTag: String(metadata.sourceTag || ""),
      conversionPath: String(metadata.conversionPath || ""),
    });
    await fetch("/api/analytics/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
      body: JSON.stringify({
        eventType,
        feature,
        page,
        referrer: document.referrer,
        url: window.location.href,
        sourceTag: attribution.sourceTag,
        conversionPath: attribution.conversionPath,
        metadata: {
          ...metadata,
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
        },
      }),
    });
  } catch {
    return;
  }
}

function BrandMark() {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#101112] shadow-lg shadow-emerald-500/20">
      <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-full w-full" />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`mt-5 text-5xl font-semibold ${scoreColor(value)}`}>{value}</p>
      <div className="mt-4 h-1.5 rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div className={`fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg border p-4 shadow-2xl backdrop-blur ${toneClasses(toast.tone)}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{toast.title}</p>
          <p className="mt-1 text-sm opacity-85">{toast.body}</p>
        </div>
        <button onClick={onClose} className="rounded-md px-2 text-sm opacity-70 hover:bg-white/10 hover:opacity-100" aria-label="Close notification">
          x
        </button>
      </div>
    </div>
  );
}

function ProductShot() {
  return (
    <div className="relative min-w-0 w-full max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg border border-white/10 bg-[#0b0d0e] shadow-2xl shadow-black/40 lg:max-w-full">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
        </div>
        <div className="hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400 sm:block">workfusion console</div>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">EA readiness desk</p>
          <h3 className="mt-2 text-2xl font-semibold">XAUUSD M5 Prop Engine</h3>
        </div>
        <span className="w-fit rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-[#101112]">Pro active</span>
        <div className="grid gap-3">
          <MetricCard label="Risk" value={87} />
          <MetricCard label="Compliance" value={91} />
          <MetricCard label="Readiness" value={88} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-semibold text-zinc-200">Guardrails</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-400">
            {["No martingale", "Daily loss cap", "Spread filter"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#101112] px-3 py-2">
                <span>{item}</span>
                <span className="text-emerald-300">pass</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hidden min-h-[500px] grid-cols-[4.5rem_1fr] md:grid">
        <aside className="border-r border-white/10 bg-white/[0.03] p-3">
          {["D", "E", "R", "B", "P"].map((item) => (
            <div key={item} className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-[#101112] text-xs text-zinc-400">
              {item}
            </div>
          ))}
        </aside>
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">EA readiness desk</p>
              <h3 className="mt-1 text-2xl font-semibold">XAUUSD M5 Prop Engine</h3>
            </div>
            <span className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-[#101112]">Pro active</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Risk" value={87} />
            <MetricCard label="Compliance" value={91} />
            <MetricCard label="Readiness" value={88} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.78fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-200">Backtest readiness</p>
                <p className="text-xs text-emerald-300">review required</p>
              </div>
              <div className="mt-5 h-44 rounded-lg border border-white/10 bg-[#101112] p-4">
                <div className="flex h-full items-end gap-2">
                  {[28, 38, 32, 52, 45, 64, 72, 68, 84, 78, 92, 88].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t bg-emerald-300/70" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-semibold text-zinc-200">Guardrails</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                {["No martingale", "Max daily loss", "Spread filter", "Session check"].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#101112] px-3 py-2">
                    <span>{item}</span>
                    <span className="text-emerald-300">pass</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <pre className="mt-4 max-h-32 overflow-hidden rounded-lg border border-white/10 bg-[#101112] p-4 text-xs leading-6 text-zinc-400">
{`#property strict
input double RiskPerTradePct = 0.50;
input int MaxSpreadPoints = 45;
bool RiskGatePasses(){ return true; }`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ScreenshotDeck() {
  const cards = [
    {
      title: "Real live dashboard",
      body: "Prompt, market, platform, prop preset, signed-in account, and downloadable MQL output in one view.",
      image: "/brand/workfusion-dashboard-live-v2.png",
    },
    {
      title: "Real pricing checkout",
      body: "Freemium entry, PayPal checkout path, and premium plan positioning for EA builders.",
      image: "/brand/workfusion-pricing-live-v2.png",
    },
    {
      title: "Real brand preview",
      body: "Final mark, Open Graph card, commercial trading-AI visual language, and social share asset.",
      image: "/brand/workfusion-og.svg?v=2",
    },
  ];

  return (
    <section className="border-y border-white/10 bg-[#151719] px-5 py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Live product captures v2</p>
            <h2 className="mt-2 text-3xl font-semibold">Real screenshots, not placeholder score cards.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            These are browser captures from the deployed Workfusion application: dashboard, pricing checkout, and brand preview.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {cards.map((card, index) => (
            <article key={card.title} className="overflow-hidden rounded-lg border border-white/10 bg-[#101112]">
              <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                Live capture {index + 1}
              </div>
              <div className="p-4">
                <div className="aspect-[16/10] overflow-hidden rounded-lg border border-white/10 bg-[#0b0d0e]">
                  <img src={card.image} alt={`${card.title} screenshot`} className="h-full w-full object-cover object-top" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("London breakout on XAUUSD, M5, max 0.5% risk, fixed SL, 1:2 RR, no martingale.");
  const [market, setMarket] = useState("XAUUSD");
  const [preset, setPreset] = useState("100k");
  const [platform, setPlatform] = useState("mt5");
  const [propMode, setPropMode] = useState(true);
  const [debugCode, setDebugCode] = useState("int OnInit(){ return(INIT_SUCCEEDED); }\nvoid OnTick(){ /* entry rules */ }");
  const [debugErrors, setDebugErrors] = useState("undeclared identifier 'trade'");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [result, setResult] = useState<TradingResult | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [email, setEmail] = useState("");
  const [ownerToken, setOwnerToken] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");
  const [supportCategory, setSupportCategory] = useState("bug");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState<FormStatus>({ status: "idle", message: "Send bugs, compiler errors, billing issues, or product feedback." });
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPersona, setLeadPersona] = useState("mq5_developer");
  const [leadIntent, setLeadIntent] = useState("compiler_error");
  const [leadConsent, setLeadConsent] = useState(false);
  const [leadStatus, setLeadStatus] = useState<FormStatus>({ status: "idle", message: "Join only with explicit opt-in. No scraped list, no purchased database." });
  const [followupEmail, setFollowupEmail] = useState("");
  const [followupReply, setFollowupReply] = useState("");
  const [followupConsent, setFollowupConsent] = useState(false);
  const [followupStatus, setFollowupStatus] = useState<FormStatus>({ status: "idle", message: "Optional follow-up only. No spam, no broker access, no trading promises." });

  const payload = useMemo(() => ({ idea, market, preset, platform, propMode }), [idea, market, preset, platform, propMode]);
  const limits = result?.remaining || account?.limits || { generate: 3, optimize: 1, debrief: 1, debug: 1, download: 1 };
  const plan = result?.plan || account?.plan || "checking";
  const currentEaCode = pickEaCode(result, debugCode);
  const codeForChecks = currentEaCode;
  const currentCodeSource = codeSourceLabel(result, debugCode);
  const activatedFollowup = activatedFollowupFor(result);

  function notify(next: Toast) {
    setToast(next);
  }

  function loadProblemTemplate(template: (typeof commonMqlProblems)[number]) {
    setPlatform("mt5");
    setDebugCode(template.code);
    setDebugErrors(template.errors);
    notify({
      tone: "info",
      title: template.title,
      body: "Loaded a real MQ5 problem pattern. Run Fix code to get the diagnostic and linked tutorial.",
    });
  }

  async function run(endpoint: string, body: Record<string, unknown>, label: string) {
    const codeFromRequest = typeof body.code === "string" ? body.code : "";
    const previousCode = pickEaCode(result, codeFromRequest || debugCode);
    const shouldPreserveCode = !["/api/trading/generate", "/api/trading/debug"].includes(endpoint);
    const trackedEvent = usageEventFor(endpoint, label);
    const attribution = attributionFrom({
      referrer: document.referrer,
      url: window.location.href,
      path: window.location.pathname,
      intent: trackedEvent.feature === "generate"
        ? "ea_draft"
        : trackedEvent.feature === "debug" || trackedEvent.feature === "compile_check"
          ? "compiler_error"
          : trackedEvent.feature === "backtest_estimate"
            ? "risk_check"
            : "",
    });

    setActiveAction(label);
    trackUsageEvent(trackedEvent.eventType, trackedEvent.feature, {
      market,
      platform,
      label,
      conversionStage: "intent",
      hasCode: Boolean(codeFromRequest || currentEaCode),
      hasErrors: Boolean(debugErrors.trim()),
    }).catch(() => undefined);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify({
          ...body,
          page: window.location.pathname,
          referrer: document.referrer,
          url: window.location.href,
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || "Request failed.";
        setResult((current) => ({
          ...(shouldPreserveCode ? current || {} : {}),
          error: message,
          sourceCode: shouldPreserveCode ? pickEaCode(current, previousCode) : undefined,
          checkedCode: codeFromRequest || undefined,
          lastAction: endpoint,
          lastActionLabel: label,
        }));
        notify({ tone: "error", title: `${label} failed`, body: message });
        return;
      }
      if (endpoint === "/api/trading/download" && typeof data.file === "string") {
        const filename = typeof data.filename === "string" ? data.filename : platform === "mt4" ? "workfusion-ea.mq4" : "workfusion-ea.mq5";
        const blob = new Blob([data.file], { type: "text/plain;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        data.summary = `Download ready: ${filename}. The file was generated from the current EA draft shown below.`;
        data.recommendation = "Open the downloaded file in MetaEditor, compile it, then run manual Strategy Tester validation before any live use.";
      }
      setResult((current) => {
        const currentCode = pickEaCode(current, previousCode);
        const returnedCode = data.fixedCode || data.mql5Code || "";
        const preservedCode = returnedCode || (shouldPreserveCode ? currentCode : "");
        const base = shouldPreserveCode ? { ...(current || {}), ...data } : data;

        return {
          ...base,
          error: undefined,
          sourceCode: preservedCode || undefined,
          checkedCode: codeFromRequest || data.checkedCode || undefined,
          lastAction: endpoint,
          lastActionLabel: label,
        };
      });
      trackUsageEvent(`${trackedEvent.feature}_completed`, trackedEvent.feature, {
        market,
        platform,
        label,
        conversionStage: label === "Generate" || label === "Debug" ? "first_useful_output" : "completion",
        compiled: data.compiled === true,
        status: data.status || "ok",
      }).catch(() => undefined);
      notify({
        tone: data.compiled === false && data.compiler?.mode === "static_precheck" ? "warning" : "success",
        title: `${label} complete`,
        body: data.summary || data.message || data.compiler?.message || "Artifact generated successfully.",
      });
    } catch {
      setResult((current) => ({
        ...(shouldPreserveCode ? current || {} : {}),
        error: "Request failed. Check the deployment logs and API route.",
        sourceCode: shouldPreserveCode ? pickEaCode(current, previousCode) : undefined,
        checkedCode: codeFromRequest || undefined,
        lastAction: endpoint,
        lastActionLabel: label,
      }));
      notify({ tone: "error", title: `${label} failed`, body: "Network request failed." });
    } finally {
      setActiveAction(null);
    }
  }

  async function refreshAccount(showToast = true) {
    try {
      const response = await fetch("/api/subscription/status");
      const data = await response.json();
      setAccount(data);
      if (data.user?.email) setEmail(data.user.email);
      if (showToast) {
        notify({
          tone: data.status === "premium" ? "success" : "info",
          title: "Account checked",
          body: `${data.authenticated ? "Signed in" : "Guest"} | ${String(data.plan || "free").toUpperCase()} plan. Storage ${data.storage || "checking"}.`,
        });
      }
    } catch {
      if (showToast) notify({ tone: "error", title: "Account check failed", body: "Could not read subscription state." });
    }
  }

  async function signIn() {
    if (!email.trim()) {
      notify({ tone: "warning", title: "Email required", body: "Enter an email before signing in." });
      return;
    }

    setActiveAction("Sign in");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ownerToken: ownerToken || undefined }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        notify({ tone: "error", title: "Sign in failed", body: data.message || data.error || "Authentication failed." });
        return;
      }
      setOwnerToken("");
      await refreshAccount(false);
      notify({ tone: "success", title: "Signed in", body: `Session attached to ${data.user?.email || email}.` });
    } catch {
      notify({ tone: "error", title: "Sign in failed", body: "Authentication request failed." });
    } finally {
      setActiveAction(null);
    }
  }

  async function signOut() {
    setActiveAction("Sign out");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAccount({ status: "free", plan: "free", storage: account?.storage, authenticated: false, user: { authenticated: false }, limits: { generate: 3, optimize: 1, debrief: 1, debug: 1, download: 1 } });
      setProjects([]);
      notify({ tone: "info", title: "Signed out", body: "Free guest mode is active." });
    } catch {
      notify({ tone: "error", title: "Sign out failed", body: "Could not clear the session." });
    } finally {
      setActiveAction(null);
    }
  }

  async function saveCurrentProject() {
    if (!account?.authenticated) {
      notify({ tone: "warning", title: "Sign in required", body: "Sign in before saving projects so your EA history is attached to your account." });
      return;
    }

    setActiveAction("Save project");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${market} ${platform.toUpperCase()} prop EA`,
          market,
          platform,
          idea,
          propMode,
          riskScore: result?.riskScore || 0,
          compliance: result?.compliance || 0,
          code: currentEaCode,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        notify({ tone: "error", title: "Save failed", body: data.message || data.error || "Project storage rejected the request." });
        return;
      }
      notify({ tone: "success", title: "Project saved", body: data.project?.title || "EA project saved." });
      await loadProjects(false);
    } catch {
      notify({ tone: "error", title: "Save failed", body: "Project storage did not respond." });
    } finally {
      setActiveAction(null);
    }
  }

  async function loadProjects(showToast = true) {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data.projects || []);
      if (showToast) notify({ tone: "info", title: "Projects loaded", body: `${(data.projects || []).length} project(s) found.` });
    } catch {
      notify({ tone: "error", title: "Load failed", body: "Could not load saved projects." });
    }
  }

  async function checkout(planKey: string) {
    if (planKey !== "free" && !account?.authenticated && !looksLikeEmail(email)) {
      notify({ tone: "warning", title: "Email required", body: "Enter your email in the account panel so PayPal can attach the subscription correctly." });
      document.getElementById("account")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setActiveAction(`PayPal ${planKey}`);
    trackUsageEvent("trial_start", "checkout", {
      plan: planKey,
      conversionStage: "trial_start",
      sourceTag: "",
      conversionPath: "pricing",
    }).catch(() => undefined);
    try {
      const attribution = attributionFrom({
        referrer: document.referrer,
        url: window.location.href,
        path: window.location.pathname,
        intent: "trial_start",
        conversionPath: "pricing",
      });
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify({
          plan: planKey,
          provider: "paypal",
          email,
          ownerToken: ownerToken || undefined,
          page: window.location.pathname,
          referrer: document.referrer,
          url: window.location.href,
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        notify({ tone: "error", title: "Checkout blocked", body: data.message || data.error || "PayPal checkout could not be created." });
        return;
      }
      if (data.sessionAttached) await refreshAccount(false).catch(() => undefined);
      if (data.url) {
        notify({ tone: "success", title: "PayPal ready", body: "Redirecting to PayPal approval." });
        window.location.href = data.url;
        return;
      }
      notify({ tone: data.error ? "error" : "info", title: "Billing response", body: data.message || data.error || "Checkout endpoint responded." });
    } catch {
      notify({ tone: "error", title: "Checkout failed", body: "PayPal checkout could not be created." });
    } finally {
      setActiveAction(null);
    }
  }

  async function submitSupport() {
    setSupportStatus({ status: "loading", message: "Analyzing and sending your support message." });
    try {
      const attribution = attributionFrom({
        referrer: document.referrer,
        url: window.location.href,
        path: window.location.pathname,
        intent: supportCategory === "compiler_error" ? "compiler_error" : "",
      });
      const response = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify({
          email: supportEmail || email,
          category: supportCategory,
          subject: supportSubject,
          message: supportMessage,
          page: typeof window !== "undefined" ? window.location.pathname : "/",
          referrer: typeof window !== "undefined" ? document.referrer : "",
          url: typeof window !== "undefined" ? window.location.href : "",
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || "Support message failed.";
        setSupportStatus({ status: "error", message });
        notify({ tone: "error", title: "Support failed", body: message });
        return;
      }
      setSupportMessage("");
      setSupportSubject("");
      setSupportStatus({
        status: "success",
        message: `Ticket ${data.id} created. Priority: ${data.support?.priority || "normal"}.`,
      });
      notify({ tone: "success", title: "Support sent", body: data.support?.summary || "Message stored for review." });
    } catch {
      setSupportStatus({ status: "error", message: "Network request failed while sending support." });
      notify({ tone: "error", title: "Support failed", body: "Network request failed." });
    }
  }

  async function joinLeadList(source = "homepage_ea_builder_updates", intent = leadIntent) {
    setLeadStatus({ status: "loading", message: "Saving opt-in email." });
    try {
      const attribution = attributionFrom({
        referrer: document.referrer,
        url: window.location.href,
        path: window.location.pathname,
        intent,
      });
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify({
          email: leadEmail,
          persona: leadPersona,
          source,
          consent: leadConsent,
          intent,
          cta: "primary_conversion_cta",
          leadStatus: "new",
          page: typeof window !== "undefined" ? window.location.pathname : "/",
          referrer: typeof window !== "undefined" ? document.referrer : "",
          url: typeof window !== "undefined" ? window.location.href : "",
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || "Lead capture failed.";
        setLeadStatus({ status: "error", message });
        notify({ tone: "error", title: "Opt-in failed", body: message });
        return;
      }
      setLeadStatus({ status: "success", message: data.message || "You are on the update list." });
      trackUsageEvent("lead_opt_in_client_confirmed", source, { persona: leadPersona, intent }).catch(() => undefined);
      notify({ tone: "success", title: "Opt-in saved", body: "Workfusion EA builder updates are enabled for this email." });
    } catch {
      setLeadStatus({ status: "error", message: "Network request failed while saving opt-in." });
      notify({ tone: "error", title: "Opt-in failed", body: "Network request failed." });
    }
  }

  async function submitActivatedFollowup() {
    if (!activatedFollowup) return;

    const emailToUse = (followupEmail || email || account?.user?.email || "").trim();
    if (!looksLikeEmail(emailToUse)) {
      setFollowupStatus({ status: "error", message: "Enter an email so I can follow up manually." });
      return;
    }
    if (!followupConsent) {
      setFollowupStatus({ status: "error", message: "Please opt in before requesting a workflow review." });
      return;
    }

    setFollowupStatus({ status: "loading", message: "Saving activated-user follow-up in CRM." });
    try {
      const attribution = attributionFrom({
        referrer: document.referrer,
        url: window.location.href,
        path: window.location.pathname,
        intent: activatedFollowup.intent,
      });
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify({
          email: emailToUse,
          persona: leadPersona,
          source: "activated_user_followup",
          consent: true,
          intent: activatedFollowup.intent,
          cta: "activated_user_followup_question",
          leadStatus: "activated_followup",
          page: typeof window !== "undefined" ? window.location.pathname : "/",
          referrer: typeof window !== "undefined" ? document.referrer : "",
          url: typeof window !== "undefined" ? window.location.href : "",
          sourceTag: attribution.sourceTag,
          conversionPath: attribution.conversionPath,
          activationFeature: activatedFollowup.feature,
          activationAction: activatedFollowup.action,
          reply: followupReply || "Requested free workflow review or next compiler-error help.",
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || "Follow-up capture failed.";
        setFollowupStatus({ status: "error", message });
        notify({ tone: "error", title: "Follow-up failed", body: message });
        return;
      }

      setFollowupStatus({
        status: "success",
        message: "Saved in CRM. This user is tagged for manual workflow review.",
      });
      setFollowupReply("");
      trackUsageEvent("activated_user_to_lead_conversion", "activated_user_followup", {
        activationFeature: activatedFollowup.feature,
        activationAction: activatedFollowup.action,
        intent: activatedFollowup.intent,
        source: "activated_user_followup",
        hasReply: Boolean(followupReply.trim()),
      }).catch(() => undefined);
      notify({ tone: "success", title: "Follow-up saved", body: "The request is now in the CRM." });
    } catch {
      setFollowupStatus({ status: "error", message: "Network request failed while saving follow-up." });
      notify({ tone: "error", title: "Follow-up failed", body: "Network request failed." });
    }
  }

  useEffect(() => {
    refreshAccount(false);
    loadProjects(false);
    setSupportEmail((value) => value || email);
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer,
        url: window.location.href,
        ...attributionFrom({ referrer: document.referrer, url: window.location.href, path: window.location.pathname }),
      }),
    }).catch(() => undefined);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101112] pb-20 text-white md:pb-0">
      {toast && <ToastView toast={toast} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101112]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="#" className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-base font-semibold">Workfusion Trading AI</p>
              <p className="text-xs text-zinc-500">Workfusionapp, Inc.</p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a href="#console" className="hover:text-white">Console</a>
            <a href="#shots" className="hover:text-white">Screenshots</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="/resources" className="hover:text-white">Resources</a>
            <a href="/growth" className="hover:text-white">Growth</a>
            <a href="#support" className="hover:text-white">Support</a>
            <a href="/legal" className="hover:text-white">Risk disclosure</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
              {plan} plan
            </span>
            <Button onClick={() => checkout("pro")} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
              Upgrade
            </Button>
          </div>
          <button
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 md:hidden"
            aria-label="Open mobile navigation"
          >
            Menu
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="grid gap-2 border-t border-white/10 px-5 py-4 text-sm text-zinc-300 md:hidden">
            <a onClick={() => setMobileMenuOpen(false)} href="#console" className="rounded-lg bg-white/[0.04] px-3 py-3">Console</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#shots" className="rounded-lg bg-white/[0.04] px-3 py-3">Screenshots</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#pricing" className="rounded-lg bg-white/[0.04] px-3 py-3">Pricing</a>
            <a onClick={() => setMobileMenuOpen(false)} href="/resources" className="rounded-lg bg-white/[0.04] px-3 py-3">Resources</a>
            <a onClick={() => setMobileMenuOpen(false)} href="/growth" className="rounded-lg bg-white/[0.04] px-3 py-3">Growth</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#support" className="rounded-lg bg-white/[0.04] px-3 py-3">Support</a>
            <a onClick={() => setMobileMenuOpen(false)} href="/legal" className="rounded-lg bg-white/[0.04] px-3 py-3">Risk disclosure</a>
          </nav>
        )}
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 overflow-hidden px-5 pb-16 pt-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:overflow-visible">
        <div className="min-w-0 max-w-full overflow-hidden lg:overflow-visible">
          <div className="mb-6 inline-flex rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-200">
            AI EA Generator + Debugger for MT4/MT5 traders
          </div>
          <h1 className="max-w-[calc(100vw-2.5rem)] break-words text-4xl font-semibold leading-[1.03] tracking-normal text-white sm:max-w-4xl sm:text-6xl xl:text-7xl">
            <span className="block">Generate, debug,</span>
            <span className="block">risk-check, and</span>
            <span className="block">download EA drafts</span>
            <span className="block">from one console.</span>
          </h1>
          <p className="mt-6 max-w-[calc(100vw-2.5rem)] break-words text-lg leading-8 text-zinc-300 sm:max-w-2xl">
            <span className="block">Describe a strategy, get structured MQL, fix compiler errors,</span>
            <span className="block">score risk/readiness, save projects, and upgrade only when</span>
            <span className="block">your quota or workflow needs more capacity.</span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                trackUsageEvent("cta_click", "homepage_primary_generate", { destination: "console" }).catch(() => undefined);
                document.getElementById("console")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="h-12 rounded-lg bg-emerald-300 px-6 text-base text-[#101112] hover:bg-emerald-200"
            >
              Generate a free EA draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                trackUsageEvent("cta_click", "homepage_compare_plans", { destination: "pricing" }).catch(() => undefined);
                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="h-12 rounded-lg border-zinc-700 bg-zinc-950 px-6 text-base text-white hover:bg-zinc-900"
            >
              Compare plans
            </Button>
          </div>
          <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-sm font-semibold text-emerald-100">Paste compiler errors / Generate EA draft / Get risk check</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">Short opt-in only. One source, one intent, one new lead status in the CRM.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {leadIntentOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLeadIntent(item.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                    leadIntent === item.value
                      ? "border-emerald-300 bg-emerald-300 text-[#101112]"
                      : "border-white/10 bg-[#101112] text-zinc-300 hover:border-emerald-300/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={leadEmail}
                onChange={(event) => setLeadEmail(event.target.value)}
                placeholder="developer@example.com"
                className="min-h-12 rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
              />
              <Button
                disabled={leadStatus.status === "loading"}
                onClick={() => joinLeadList("homepage_hero_primary_cta", leadIntent)}
                className="h-12 rounded-lg bg-emerald-300 px-5 text-[#101112] hover:bg-emerald-200"
              >
                Continue
              </Button>
            </div>
            <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-zinc-300">
              <input
                type="checkbox"
                checked={leadConsent}
                onChange={(event) => setLeadConsent(event.target.checked)}
                className="mt-1"
              />
              I agree to receive Workfusion EA builder updates. No scraped lists, no trading promises.
            </label>
            <p className={`mt-2 text-sm ${leadStatus.status === "error" ? "text-rose-300" : leadStatus.status === "success" ? "text-emerald-300" : "text-zinc-400"}`}>
              {leadStatus.message}
            </p>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {conversionProof.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <ProductShot />
      </section>

      <section className="border-y border-white/10 bg-[#151719]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:grid-cols-4">
          {proofCards.map(([title, body]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-[#101112] p-5">
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Conversion workflow</p>
            <h2 className="mt-2 text-3xl font-semibold">From idea to downloadable MQL in three steps.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Workfusion is built around the jobs MT4/MT5 builders actually repeat: generation, debugging, compiler checks, risk review, and project packaging.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workflowSteps.map(([number, title, body]) => (
            <article key={title} className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-sm font-black text-[#101112]">{number}</div>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="console" className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Operator console</p>
            <h2 className="mt-2 text-3xl font-semibold">A dense desk for build, debug, risk, billing, and storage.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Every action produces a visible state: running, success, error, or a downloadable artifact.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr_0.72fr]">
          <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Strategy brief</p>
                <p className="text-xs text-zinc-500">Prompt and prop settings</p>
              </div>
              <span className="rounded-lg bg-emerald-300/10 px-2 py-1 text-xs text-emerald-200">MT desk</span>
            </div>
            <label className="mt-5 block text-sm text-zinc-400">Trade idea</label>
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              className="mt-2 min-h-40 w-full rounded-lg border border-white/10 bg-[#101112] p-3 text-sm leading-6 text-white outline-none focus:border-emerald-300"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <select value={market} onChange={(e) => setMarket(e.target.value)} className="rounded-lg border border-white/10 bg-[#101112] p-3 text-sm">
                {markets.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border border-white/10 bg-[#101112] p-3 text-sm">
                {presets.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-white/10 bg-[#101112] p-3 text-sm">
                {platforms.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm text-zinc-300">
              <input type="checkbox" checked={propMode} onChange={(e) => setPropMode(e.target.checked)} />
              Prop Mode: cap risk and reject dangerous sizing.
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button disabled={!!activeAction} onClick={() => run("/api/trading/generate", payload, "Generate")} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
                Generate EA
              </Button>
              <Button disabled={!!activeAction} onClick={() => run("/api/trading/optimize", { ...payload, currentRisk: 78, currentCompliance: 82 }, "Optimize")} className="rounded-lg bg-cyan-300 text-[#101112] hover:bg-cyan-200">
                Optimize plan
              </Button>
              <Button disabled={!!activeAction} onClick={() => run("/api/trading/debrief", { source: "manual", content: idea, market, propMode }, "Analyze")} variant="outline" className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                Analyze report
              </Button>
              <Button
                disabled={!!activeAction}
                onClick={() => run(
                  "/api/trading/download",
                  {
                    filename: platform === "mt4" ? "workfusion-ea.mq4" : "workfusion-ea.mq5",
                    content: currentEaCode,
                  },
                  "Download",
                )}
                variant="outline"
                className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Download EA
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Live result desk</p>
                <p className="text-xs text-zinc-500">Code, scores, fixes, and checks</p>
              </div>
              <span className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeAction ? "bg-cyan-300/10 text-cyan-200" : "bg-emerald-300/10 text-emerald-200"}`}>
                {activeAction ? `Running ${activeAction}` : "Ready"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MetricCard label="Risk" value={result?.riskScore ?? 87} />
              <MetricCard label="Compliance" value={result?.compliance ?? 91} />
              <MetricCard label="Readiness" value={result?.fundingReadiness ?? 88} />
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-white">Real MQ5 problem tests</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Load a common EA developer issue, then run Fix code to see the diagnosis and tutorial link.
                  </p>
                </div>
                <span className="w-fit rounded-md border border-emerald-300/20 px-2 py-1 text-xs text-emerald-200">problem solving</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {commonMqlProblems.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => loadProblemTemplate(template)}
                    className="rounded-lg border border-white/10 bg-[#101112] p-3 text-left hover:border-emerald-300/50"
                  >
                    <span className="text-sm font-semibold text-zinc-100">{template.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">{template.body}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-400">EA code to debug</label>
                <textarea
                  value={debugCode}
                  onChange={(event) => setDebugCode(event.target.value)}
                  className="mt-2 min-h-32 w-full rounded-lg border border-white/10 bg-[#101112] p-3 font-mono text-xs text-white outline-none focus:border-cyan-300"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Compiler errors</label>
                <textarea
                  value={debugErrors}
                  onChange={(event) => setDebugErrors(event.target.value)}
                  className="mt-2 min-h-32 w-full rounded-lg border border-white/10 bg-[#101112] p-3 font-mono text-xs text-white outline-none focus:border-cyan-300"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button disabled={!!activeAction} onClick={() => run("/api/trading/debug", { platform, code: debugCode, errors: debugErrors }, "Debug")} className="rounded-lg bg-amber-300 text-[#101112] hover:bg-amber-200">
                Fix code
              </Button>
              <Button
                disabled={!!activeAction}
                onClick={() => run(
                  "/api/workers/compile",
                  {
                    code: codeForChecks,
                    platform,
                    filename: platform === "mt4" ? "workfusion-ea.mq4" : "workfusion-ea.mq5",
                  },
                  "Compile check",
                )}
                variant="outline"
                className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Compile check
              </Button>
              <Button disabled={!!activeAction} onClick={() => run("/api/workers/backtest", { code: codeForChecks, idea }, "Backtest")} variant="outline" className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                Backtest estimate
              </Button>
            </div>
            <div className="mt-4 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
              <p><span className="font-semibold text-amber-200">Fix code</span> creates a corrected EA draft and shows the replacement below.</p>
              <p><span className="font-semibold text-cyan-200">Compile check</span> checks the current EA draft below. Without a MetaEditor worker, it is an honest static pre-check, not a real .ex5 build.</p>
              <p><span className="font-semibold text-emerald-200">Backtest estimate</span> estimates readiness from the current EA draft. It does not replace the code and it is not a real MT5 Strategy Tester report.</p>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-[#101112] p-4">
              <p className="text-sm font-semibold text-white">Output</p>
              {activeAction ? (
                <p className="mt-3 text-sm text-cyan-200">Running {activeAction}. The EA draft below is preserved while the check runs.</p>
              ) : result?.error ? (
                <p className="mt-3 text-sm text-rose-300">{result.error}</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-300">
                  <p>{result?.summary || "No run yet. Generate an EA first, or paste code in the debug box and run Compile check."}</p>
                  {result?.recommendation && <p className="text-emerald-200">{result.recommendation}</p>}
                  {result?.ai && (
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                      AI {result.ai.status || "unknown"} | secure backend
                    </p>
                  )}
                  {result?.compiler && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                        Compiler {result.compiler.mode || "unknown"} | {result.compiled ? "compiled" : "not compiled"} | {result.status || "unknown"}
                      </p>
                      <p className="mt-2 text-zinc-300">{result.compiler.message}</p>
                      {result.compiler.artifactFile && <p className="mt-1 text-xs text-emerald-300">Artifact: {result.compiler.artifactFile}</p>}
                      {typeof result.score === "number" && <p className="mt-1 text-xs text-zinc-500">Compile score: {result.score}/100</p>}
                    </div>
                  )}
                  {result?.diagnostics && <p>Diagnostics: {result.diagnostics.join(" | ")}</p>}
                  {result?.warnings && <p>Warnings: {result.warnings.join(" | ")}</p>}
                  {result?.issues && <p>Issues: {result.issues.join(" | ")}</p>}
                  {result?.fixes && <p>Fixes: {result.fixes.join(" | ")}</p>}
                  {result?.resourceSlugs && result.resourceSlugs.length > 0 && (
                    <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Tutorials for this issue</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.resourceSlugs.map((slug) => (
                          <a
                            key={slug}
                            href={`/resources/${slug}`}
                            className="rounded-md border border-emerald-300/20 bg-[#101112] px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-300"
                          >
                            {slug.replaceAll("-", " ")}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {result?.params && <p>Params: {Object.entries(result.params).map(([k, v]) => `${k}: ${v}`).join(" | ")}</p>}
                </div>
              )}
              <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Current EA draft</p>
                  <p className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400">{currentCodeSource}</p>
                </div>
                {result?.lastActionLabel && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Last action: {result.lastActionLabel}. Compile check and backtest estimate use this preserved draft as input.
                  </p>
                )}
                {result?.checkedCode && (result.lastAction === "/api/workers/compile" || result.lastAction === "/api/workers/backtest") && (
                  <p className="mt-2 text-xs text-cyan-300">
                    Checked input: this action reviewed the EA draft shown here; it did not erase or silently rewrite it.
                  </p>
                )}
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-400">
                  {currentEaCode || "// Generated or fixed EA code appears here. Compile check and backtest estimate will not replace it."}
                </pre>
              </div>
              {activatedFollowup && (
                <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <p className="text-sm font-semibold text-emerald-100">Want a free workflow review or help with the next compiler error?</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                    Optional. This tags your request in the CRM after {activatedFollowup.action.toLowerCase()} so I can follow up manually with the next useful step.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                    <input
                      value={followupEmail}
                      onChange={(event) => setFollowupEmail(event.target.value)}
                      placeholder={account?.user?.email || email || "developer@example.com"}
                      className="w-full rounded-lg border border-emerald-300/20 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
                    />
                    <input
                      value={followupReply}
                      onChange={(event) => setFollowupReply(event.target.value)}
                      placeholder="What should I review next? Compiler error, EA brief, download, or risk check."
                      className="w-full rounded-lg border border-emerald-300/20 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
                    />
                  </div>
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-emerald-50/80">
                    <input
                      checked={followupConsent}
                      onChange={(event) => setFollowupConsent(event.target.checked)}
                      type="checkbox"
                      className="mt-1 accent-emerald-300"
                    />
                    I agree to receive manual Workfusion follow-up about this EA workflow. No spam, no broker access, no trading credentials, no profit promises.
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className={followupStatus.status === "error" ? "text-xs text-rose-300" : followupStatus.status === "success" ? "text-xs text-emerald-200" : "text-xs text-emerald-50/70"}>
                      {followupStatus.message}
                    </p>
                    <Button disabled={followupStatus.status === "loading"} onClick={submitActivatedFollowup} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
                      Request review
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section id="account" className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Account panel</p>
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Current plan</p>
                <p className="mt-2 text-3xl font-semibold capitalize text-white">{plan}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {account?.authenticated ? `Signed in: ${account.user?.email}` : "Guest free mode"} | Billing: {account?.billing?.paypalConfigured ? "PayPal live" : "checking"}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-emerald-200">
                  Storage: {account?.storage === "postgres" ? "Postgres live" : account?.storage || "checking"}
                </p>
              </div>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                {account?.authenticated ? (
                  <div>
                    <p className="text-sm font-semibold text-white">Authenticated session</p>
                    <p className="mt-1 break-all text-sm text-zinc-400">{account.user?.email}</p>
                    <Button disabled={!!activeAction} onClick={signOut} variant="outline" className="mt-3 w-full rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-white">Email for checkout</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Use one email for free quota, project history, and PayPal premium activation.</p>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-3 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
                    />
                    <input
                      value={ownerToken}
                      onChange={(event) => setOwnerToken(event.target.value)}
                      placeholder="Owner token only for founder email"
                      type="password"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
                    />
                    <Button disabled={!!activeAction} onClick={signIn} className="mt-3 w-full rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
                      Attach email
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                {Object.entries(limits).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="capitalize">{key}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                <Button disabled={!!activeAction} onClick={() => refreshAccount()} variant="outline" className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                  Refresh account
                </Button>
                <Button disabled={!!activeAction} onClick={saveCurrentProject} variant="outline" className="rounded-lg border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20">
                  Save project
                </Button>
                <Button disabled={!!activeAction} onClick={() => loadProjects()} variant="outline" className="rounded-lg border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20">
                  Load projects
                </Button>
              </div>
            </section>
            <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Saved projects</p>
              <div className="mt-4 grid gap-3">
                {projects.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                    No saved projects loaded yet.
                  </p>
                ) : (
                  projects.slice(0, 4).map((project) => (
                    <div key={project.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                      <p className="font-semibold">{project.title}</p>
                      <p className="mt-2 text-xs text-zinc-500">{new Date(project.updatedAt).toLocaleString()}</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        {project.market} | {project.platform.toUpperCase()} | Risk {project.riskScore || "-"} | Compliance {project.compliance || "-"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>

      <div id="shots">
        <ScreenshotDeck />
      </div>

      <section id="pricing" className="bg-[#e8eee9] px-5 py-14 text-[#101112]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Pricing</p>
              <h2 className="mt-2 text-3xl font-semibold">Upgrade when iteration volume becomes the blocker.</h2>
            </div>
            <a href="/pricing" className="text-sm font-semibold text-emerald-800">Open full comparison and FAQ</a>
          </div>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {[
              ["Free first", "Generate or debug before paying."],
              ["Pro default", "Best balance of generations, debugs, optimizer, and reports."],
              ["Clear risk line", "Software assistance only. No trading result guarantee."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-[#c9d5cf] bg-white p-4">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{body}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {plans.map((item) => (
              <article key={item.name} className={`rounded-lg border p-5 ${item.highlight ? "border-emerald-500 bg-white shadow-xl shadow-emerald-900/10" : "border-[#c9d5cf] bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.name}</p>
                  {item.highlight && <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Best fit</span>}
                </div>
                <p className="mt-2 text-3xl font-semibold">{item.price}</p>
                <p className="mt-3 text-sm text-zinc-600">{item.caption}</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                  {item.features.map((feature) => <li key={feature}>- {feature}</li>)}
                </ul>
                {item.key === "free" ? (
                  <button onClick={() => document.getElementById("console")?.scrollIntoView({ behavior: "smooth" })} className="mt-5 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold">
                    Use free console
                  </button>
                ) : (
                  <button onClick={() => checkout(item.key)} className="mt-5 w-full rounded-lg bg-[#101112] px-4 py-2 text-sm font-semibold text-white">
                    Start {item.name}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="resources" className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">EA builder resources</p>
            <h2 className="mt-2 text-3xl font-semibold">Dedicated pages and guides for high-intent MT4/MT5 searches.</h2>
          </div>
          <a href="/resources" className="text-sm font-semibold text-cyan-300">Open all guides</a>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {seoLinks.map(([href, title, body]) => (
            <a key={href} href={href} className="rounded-lg border border-white/10 bg-zinc-950 p-5 hover:border-emerald-300/50">
              <p className="text-lg font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
              <p className="mt-4 text-sm font-semibold text-emerald-300">Open page</p>
            </a>
          ))}
        </div>
      </section>

      <section id="support" className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Support desk</p>
            <h2 className="mt-2 text-3xl font-semibold">Report bugs and join the EA builder list.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Support messages are summarized and classified with OpenAI, then stored for the owner to review and improve the product.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Send a support message</p>
                <p className="mt-1 text-sm text-zinc-500">Compiler errors, payment problems, broken output, missing features, or UX feedback.</p>
              </div>
              <span className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                supportStatus.status === "success"
                  ? "bg-emerald-300/10 text-emerald-200"
                  : supportStatus.status === "error"
                    ? "bg-rose-300/10 text-rose-200"
                    : "bg-cyan-300/10 text-cyan-200"
              }`}>
                {supportStatus.status}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={supportEmail || email}
                onChange={(event) => setSupportEmail(event.target.value)}
                placeholder="email for reply"
                className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"
              />
              <select
                value={supportCategory}
                onChange={(event) => setSupportCategory(event.target.value)}
                className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"
              >
                <option value="bug">Bug</option>
                <option value="compiler_error">Compiler error</option>
                <option value="billing">Billing</option>
                <option value="feature_request">Feature request</option>
                <option value="feedback">Feedback</option>
              </select>
            </div>
            <input
              value={supportSubject}
              onChange={(event) => setSupportSubject(event.target.value)}
              placeholder="short subject"
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300"
            />
            <textarea
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              placeholder="Describe what happened, what you expected, and paste compiler errors if relevant."
              className="mt-3 min-h-36 w-full rounded-lg border border-white/10 bg-[#101112] p-3 text-sm leading-6 text-white outline-none focus:border-cyan-300"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-zinc-400">{supportStatus.message}</p>
              <Button disabled={supportStatus.status === "loading"} onClick={submitSupport} className="rounded-lg bg-cyan-300 text-[#101112] hover:bg-cyan-200">
                Send to support
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
            <p className="text-sm font-semibold text-zinc-200">EA builder updates</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Build the first audience with opt-in emails from MT4/MT5 builders. Do not import scraped or purchased lists.
            </p>
            <input
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.target.value)}
              placeholder="developer@example.com"
              className="mt-5 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
            />
            <select
              value={leadPersona}
              onChange={(event) => setLeadPersona(event.target.value)}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
            >
              <option value="mq5_developer">MQL5 / EA developer</option>
              <option value="mt4_developer">MQL4 / MT4 developer</option>
              <option value="prop_trader">Prop trader</option>
              <option value="agency_or_educator">Agency / educator</option>
            </select>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-zinc-300">
              <input
                type="checkbox"
                checked={leadConsent}
                onChange={(event) => setLeadConsent(event.target.checked)}
                className="mt-1"
              />
              I agree to receive Workfusion EA builder updates and understand I can unsubscribe later.
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-zinc-400">{leadStatus.message}</p>
              <Button disabled={leadStatus.status === "loading"} onClick={() => joinLeadList()} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
                Join list
              </Button>
            </div>
          </section>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <p>Copyright {new Date().getFullYear()} Workfusionapp, Inc. All rights reserved.</p>
        <p>Software tool only. No investment advice. No profit guarantee.</p>
      </footer>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-2 rounded-lg border border-white/10 bg-[#101112]/95 p-2 text-center text-xs text-zinc-300 shadow-2xl backdrop-blur md:hidden">
        <a href="#" className="rounded-md px-2 py-3 hover:bg-white/10">Home</a>
        <a href="#console" className="rounded-md px-2 py-3 hover:bg-white/10">Console</a>
        <a href="#pricing" className="rounded-md px-2 py-3 hover:bg-white/10">Pricing</a>
        <a href="/growth" className="rounded-md px-2 py-3 hover:bg-white/10">Growth</a>
        <a href="#support" className="rounded-md px-2 py-3 hover:bg-white/10">Support</a>
      </nav>
    </main>
  );
}
