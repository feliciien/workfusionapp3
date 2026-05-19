"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type TradingResult = {
  riskScore?: number;
  compliance?: number;
  fundingReadiness?: number;
  summary?: string;
  recommendation?: string;
  mql5Code?: string;
  fixedCode?: string;
  issues?: string[];
  fixes?: string[];
  params?: Record<string, string>;
  filename?: string;
  worker?: string;
  status?: string;
  score?: number;
  diagnostics?: string[];
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

const markets = ["Forex", "XAUUSD", "Indices", "Crypto"];
const presets = ["50k", "100k", "200k"];
const platforms = [
  { label: "MT5 (.mq5)", value: "mt5" },
  { label: "MT4 (.mq4)", value: "mt4" },
];

const proofCards = [
  ["Generate", "Turn a plain strategy brief into structured MQL with risk controls."],
  ["Debug", "Paste compiler output and get a compile-ready EA replacement plus fix notes."],
  ["Compile", "Run MetaEditor when configured, or show an honest static pre-check."],
  ["Package", "Save projects, download EA drafts, and keep a technical audit trail."],
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
    caption: "For solo traders building first drafts.",
    features: ["30 generations", "20 debugs", "Downloads", "Project history"],
  },
  {
    name: "Pro",
    key: "pro",
    price: "$79/mo",
    caption: "For active EA builders.",
    features: ["150 generations", "Optimizer", "Report analyzer", "Priority queue"],
    highlight: true,
  },
  {
    name: "Studio",
    key: "studio",
    price: "$199/mo",
    caption: "For trading labs and agencies.",
    features: ["Team workflow", "Advanced QA", "White-label reports", "API access"],
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

  const payload = useMemo(() => ({ idea, market, preset, platform, propMode }), [idea, market, preset, platform, propMode]);
  const limits = result?.remaining || account?.limits || { generate: 3, optimize: 1, debrief: 1, debug: 1, download: 1 };
  const plan = result?.plan || account?.plan || "checking";

  function notify(next: Toast) {
    setToast(next);
  }

  async function run(endpoint: string, body: Record<string, unknown>, label: string) {
    setActiveAction(label);
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || "Request failed.";
        setResult({ error: message });
        notify({ tone: "error", title: `${label} failed`, body: message });
        return;
      }
      setResult(data);
      notify({
        tone: data.compiled === false && data.compiler?.mode === "static_precheck" ? "warning" : "success",
        title: `${label} complete`,
        body: data.summary || data.message || data.compiler?.message || "Artifact generated successfully.",
      });
    } catch {
      setResult({ error: "Request failed. Check the deployment logs and API route." });
      notify({ tone: "error", title: `${label} failed`, body: "Network request failed." });
    } finally {
      setActiveAction(null);
    }
  }

  async function refreshAccount() {
    try {
      const response = await fetch("/api/subscription/status");
      const data = await response.json();
      setAccount(data);
      if (data.user?.email) setEmail(data.user.email);
      notify({
        tone: data.status === "premium" ? "success" : "info",
        title: "Account checked",
        body: `${data.authenticated ? "Signed in" : "Guest"} | ${String(data.plan || "free").toUpperCase()} plan. Storage ${data.storage || "checking"}.`,
      });
    } catch {
      notify({ tone: "error", title: "Account check failed", body: "Could not read subscription state." });
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
      await refreshAccount();
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
          code: result?.mql5Code || result?.fixedCode || "",
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
    if (planKey !== "free" && !account?.authenticated) {
      notify({ tone: "warning", title: "Sign in first", body: "Paid plans need a signed-in account so PayPal can attach the subscription correctly." });
      document.getElementById("account")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setActiveAction(`PayPal ${planKey}`);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, provider: "paypal" }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        notify({ tone: "error", title: "Checkout blocked", body: data.message || data.error || "PayPal checkout could not be created." });
        return;
      }
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

  useEffect(() => {
    refreshAccount();
    loadProjects(false);
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workfusion-guest-id": getGuestId() },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer }),
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
            <a onClick={() => setMobileMenuOpen(false)} href="/legal" className="rounded-lg bg-white/[0.04] px-3 py-3">Risk disclosure</a>
          </nav>
        )}
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 overflow-hidden px-5 pb-16 pt-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:overflow-visible">
        <div className="min-w-0 max-w-full overflow-hidden lg:overflow-visible">
          <div className="mb-6 inline-flex rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-200">
            Commercial EA workflow for MT4/MT5 builders
          </div>
          <h1 className="max-w-[calc(100vw-2.5rem)] break-words text-4xl font-semibold leading-[1.03] tracking-normal text-white sm:max-w-4xl sm:text-6xl xl:text-7xl">
            <span className="block">Build safer</span>
            <span className="block">Expert Advisors</span>
            <span className="block">with a risk desk</span>
            <span className="block">built in.</span>
          </h1>
          <p className="mt-6 max-w-[calc(100vw-2.5rem)] break-words text-lg leading-8 text-zinc-300 sm:max-w-2xl">
            <span className="block">Generate MQL drafts, debug compiler errors,</span>
            <span className="block">score prop-firm readiness, save projects,</span>
            <span className="block">and move to PayPal checkout</span>
            <span className="block">from one operator-grade console.</span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() => document.getElementById("console")?.scrollIntoView({ behavior: "smooth" })}
              className="h-12 rounded-lg bg-emerald-300 px-6 text-base text-[#101112] hover:bg-emerald-200"
            >
              Open console
            </Button>
            <Button
              variant="outline"
              onClick={() => run("/api/trading/debug", { platform, code: debugCode, errors: debugErrors }, "Debug")}
              className="h-12 rounded-lg border-zinc-700 bg-zinc-950 px-6 text-base text-white hover:bg-zinc-900"
            >
              Test debugger
            </Button>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["AI engine", result?.ai?.model || "gpt-5.5"],
              ["Plan", plan],
              ["Risk mode", propMode ? "prop on" : "manual"],
            ].map(([label, value]) => (
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
                    content: result?.mql5Code || result?.fixedCode || "",
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
                    code: result?.mql5Code || result?.fixedCode || debugCode,
                    platform,
                    filename: platform === "mt4" ? "workfusion-ea.mq4" : "workfusion-ea.mq5",
                  },
                  "Compile",
                )}
                variant="outline"
                className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Compile EA
              </Button>
              <Button disabled={!!activeAction} onClick={() => run("/api/workers/backtest", { code: result?.mql5Code || result?.fixedCode || debugCode, idea }, "Backtest")} variant="outline" className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                Backtest estimate
              </Button>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-[#101112] p-4">
              <p className="text-sm font-semibold text-white">Output</p>
              {activeAction ? (
                <p className="mt-3 text-sm text-cyan-200">Running {activeAction}. Waiting for API response...</p>
              ) : result?.error ? (
                <p className="mt-3 text-sm text-rose-300">{result.error}</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-300">
                  <p>{result?.summary || "No run yet. Start with Generate EA, Fix code, or Compile check."}</p>
                  {result?.recommendation && <p className="text-emerald-200">{result.recommendation}</p>}
                  {result?.ai && (
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                      AI {result.ai.status || "unknown"} | {result.ai.provider || "openai"} | {result.ai.model || "gpt-5.5"}
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
                  {result?.issues && <p>Issues: {result.issues.join(" | ")}</p>}
                  {result?.fixes && <p>Fixes: {result.fixes.join(" | ")}</p>}
                  {result?.params && <p>Params: {Object.entries(result.params).map(([k, v]) => `${k}: ${v}`).join(" | ")}</p>}
                  <pre className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-400">
                    {result?.mql5Code || result?.fixedCode || "// Generated code appears here."}
                  </pre>
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
                    <p className="text-sm font-semibold text-white">Sign in for freemium</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">Free users keep limited access. Paid PayPal plans require this account identity.</p>
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
                      Sign in
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
                <Button disabled={!!activeAction} onClick={refreshAccount} variant="outline" className="rounded-lg border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
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
              <h2 className="mt-2 text-3xl font-semibold">Direct PayPal checkout for EA builders.</h2>
            </div>
            <a href="/pricing" className="text-sm font-semibold text-emerald-800">Open full pricing page</a>
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
                    Start {item.name} with PayPal
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <p>Copyright {new Date().getFullYear()} Workfusionapp, Inc. All rights reserved.</p>
        <p>Software tool only. No investment advice. No profit guarantee.</p>
      </footer>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-2 rounded-lg border border-white/10 bg-[#101112]/95 p-2 text-center text-xs text-zinc-300 shadow-2xl backdrop-blur md:hidden">
        <a href="#" className="rounded-md px-2 py-3 hover:bg-white/10">Home</a>
        <a href="#console" className="rounded-md px-2 py-3 hover:bg-white/10">Console</a>
        <a href="#pricing" className="rounded-md px-2 py-3 hover:bg-white/10">Pricing</a>
        <button onClick={refreshAccount} className="rounded-md px-2 py-3 hover:bg-white/10">Account</button>
      </nav>
    </main>
  );
}
