"use client";

import { useEffect, useState } from "react";
import { attributionFrom } from "@/lib/workfusion/source-attribution";

type CheckoutState = {
  plan?: string;
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

type AccountState = {
  authenticated?: boolean;
  plan?: string;
  user?: {
    email?: string;
  };
};

const plans = [
  {
    name: "Free",
    key: "free",
    price: "$0",
    cadence: "forever",
    badge: "Try the workflow",
    description: "For checking whether Workfusion fits your EA build process.",
    outcome: "Generate a first draft, test the risk desk, and inspect the output quality.",
    features: ["3 EA generations", "1 optimizer run", "1 report debrief", "1 EA debug", "1 download"],
    cta: "Use free console",
  },
  {
    name: "Starter",
    key: "starter",
    price: "$29",
    cadence: "per month",
    badge: "First paid plan",
    description: "For solo traders building and fixing MT4/MT5 prototypes.",
    outcome: "Enough quota to iterate on several EA ideas without hitting the free wall.",
    features: ["30 EA generations", "20 EA debugs", "20 downloads", "Prop-firm risk checks", "Saved project history"],
    cta: "Start Starter",
  },
  {
    name: "Pro",
    key: "pro",
    price: "$79",
    cadence: "per month",
    badge: "Recommended",
    description: "For active EA builders who need generation, debugging, reports, and compiler checks.",
    outcome: "The practical default when you are working on real prop-firm EA workflows.",
    features: ["150 EA generations", "150 EA debugs", "Full optimizer", "Report analyzer", "Advanced risk memo"],
    cta: "Start Pro",
    highlight: true,
  },
  {
    name: "Studio",
    key: "studio",
    price: "$199",
    cadence: "per month",
    badge: "Teams and labs",
    description: "For agencies, educators, and trading labs managing multiple EA projects.",
    outcome: "Higher quotas, team workflow, advanced QA, white-label reporting, and API access.",
    features: ["500 EA generations", "500 EA debugs", "Team workspace", "White-label reports", "Priority support"],
    cta: "Start Studio",
  },
];

const comparisonRows = [
  ["EA generation", "3", "30", "150", "500"],
  ["Compiler debugging", "1", "20", "150", "500"],
  ["Downloads", "1", "20", "150", "500"],
  ["Risk/readiness scoring", "Basic", "Included", "Advanced", "Advanced"],
  ["Best for", "Testing", "Solo builders", "Active builders", "Teams"],
];

const faqs = [
  {
    question: "Will Workfusion trade for me?",
    answer: "No. Workfusion is a software assistant for EA generation, debugging, risk review, and project workflow. You still test and approve everything yourself.",
  },
  {
    question: "Does a higher plan guarantee a profitable EA?",
    answer: "No. Paid plans increase workflow capacity and tooling. They do not promise trading results, payouts, funded accounts, or investment performance.",
  },
  {
    question: "Why is Pro recommended?",
    answer: "Pro has enough generation, debug, optimization, and report capacity for real iteration. Starter is useful, but serious EA work usually needs more loops.",
  },
  {
    question: "How is premium activated?",
    answer: "PayPal returns a subscription id, Workfusion verifies it, stores the plan, and activates the premium session on the same email.",
  },
];

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getGuestId() {
  const key = "workfusion_guest_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export default function PricingPage() {
  const [checkout, setCheckout] = useState<CheckoutState>({
    status: "idle",
    message: "Enter your email once, choose a paid plan, and approve the subscription in PayPal.",
  });
  const [account, setAccount] = useState<AccountState | null>(null);
  const [email, setEmail] = useState("");
  const [ownerToken, setOwnerToken] = useState("");

  async function refreshAccount() {
    const response = await fetch("/api/subscription/status");
    const data = await response.json();
    setAccount(data);
    if (data.user?.email) setEmail(data.user.email);
  }

  async function signIn() {
    if (!validEmail(email)) {
      setCheckout({ status: "error", message: "Enter a valid email before continuing." });
      return;
    }

    setCheckout({ status: "loading", message: "Attaching your Workfusion session." });
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ownerToken: ownerToken || undefined }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setCheckout({ status: "error", message: data.message || data.error || "Sign in failed." });
        return;
      }
      setOwnerToken("");
      await refreshAccount();
      setCheckout({ status: "success", message: `Session attached to ${data.user?.email || email}.` });
    } catch {
      setCheckout({ status: "error", message: "Sign in request failed." });
    }
  }

  async function startCheckout(plan: string) {
    if (plan === "free") {
      window.location.href = "/#console";
      return;
    }

    if (!account?.authenticated && !validEmail(email)) {
      setCheckout({ plan, status: "error", message: "Enter a valid email first so PayPal can attach the subscription to your account." });
      return;
    }

    setCheckout({ plan, status: "loading", message: `Creating PayPal checkout for ${plan}.` });
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
          plan,
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
        setCheckout({ plan, status: "error", message: data.message || data.error || "PayPal checkout failed." });
        return;
      }
      if (data.sessionAttached) await refreshAccount().catch(() => undefined);
      if (data.url) {
        setCheckout({ plan, status: "success", message: "PayPal approval URL created. Redirecting now." });
        window.location.href = data.url;
        return;
      }
      setCheckout({ plan, status: "success", message: data.message || "Checkout endpoint responded." });
    } catch {
      setCheckout({ plan, status: "error", message: "Network request failed while creating checkout." });
    }
  }

  useEffect(() => {
    refreshAccount().catch(() => {
      setAccount({ authenticated: false, plan: "free" });
    });

    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get("paypal");
    const subscriptionId = params.get("subscription_id") || params.get("subscriptionId");
    const plan = params.get("plan") || "pro";
    if (paypalStatus === "cancelled") {
      setCheckout({ plan, status: "idle", message: "PayPal checkout was cancelled. No subscription was activated." });
      return;
    }
    if (paypalStatus === "success") {
      if (!subscriptionId) {
        setCheckout({
          status: "error",
          message: "PayPal returned success without a subscription id. Open PayPal dashboard or contact support to activate manually.",
        });
        return;
      }

      setCheckout({ plan, status: "loading", message: "Verifying PayPal subscription and activating premium." });
      fetch("/api/billing/paypal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, plan }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || data.error) throw new Error(data.message || data.error || "PayPal activation failed.");
          setCheckout({ plan, status: "success", message: "PayPal subscription verified. Premium session is active." });
          await refreshAccount();
        })
        .catch((error) => {
          setCheckout({ plan, status: "error", message: error instanceof Error ? error.message : "PayPal activation failed." });
        });
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#101112] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-11 w-11 rounded-lg border border-white/10 bg-[#101112]" />
            <div>
              <p className="font-semibold">Workfusion Trading AI</p>
              <p className="text-xs text-zinc-500">Pricing and checkout</p>
            </div>
          </a>
          <div className="flex flex-wrap gap-2">
            <a href="/#console" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
              Open console
            </a>
            <a href="/legal" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
              Risk disclosure
            </a>
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">AI EA Generator + Debugger</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
              Choose the Workfusion plan for your MT4/MT5 build velocity.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Generate complete EA drafts, debug compiler errors, score prop-firm risk readiness, organize projects, and download MQL outputs from one workflow.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["No profit promise", "PayPal subscription", "Risk-first tooling"].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-zinc-100">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div
            className={`rounded-lg border p-5 text-sm leading-6 ${
              checkout.status === "error"
                ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
                : checkout.status === "success"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
            }`}
          >
            <p className="font-semibold">Checkout status</p>
            <p className="mt-1">{checkout.message}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-white">1. Enter email</p>
            <p className="mt-1 text-sm text-zinc-400">
              {account?.authenticated ? `Signed in as ${account.user?.email}. Current plan: ${account.plan || "free"}.` : "Used for account access, premium activation, and PayPal subscription matching."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
            />
            <input
              value={ownerToken}
              onChange={(event) => setOwnerToken(event.target.value)}
              placeholder="Founder token only"
              type="password"
              className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
            />
          </div>
          <button onClick={account?.authenticated ? refreshAccount : signIn} className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-[#101112]">
            {account?.authenticated ? "Refresh account" : "Attach email"}
          </button>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`flex min-h-full flex-col rounded-lg border p-5 ${
                plan.highlight
                  ? "border-emerald-300 bg-emerald-300 text-[#101112] shadow-2xl shadow-emerald-500/20"
                  : "border-white/10 bg-zinc-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold opacity-80">{plan.badge}</p>
                  <h2 className="mt-1 text-2xl font-semibold">{plan.name}</h2>
                </div>
                {plan.highlight && <span className="rounded-lg bg-[#101112] px-2 py-1 text-xs font-semibold text-white">Best fit</span>}
              </div>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-5xl font-semibold">{plan.price}</p>
                <p className={`pb-2 text-sm ${plan.highlight ? "text-zinc-800" : "text-zinc-500"}`}>{plan.cadence}</p>
              </div>
              <p className={`mt-4 text-sm leading-6 ${plan.highlight ? "text-zinc-900" : "text-zinc-400"}`}>{plan.description}</p>
              <p className={`mt-3 rounded-lg p-3 text-sm leading-6 ${plan.highlight ? "bg-[#101112]/10 text-zinc-950" : "bg-white/[0.04] text-zinc-300"}`}>
                {plan.outcome}
              </p>
              <ul className={`mt-5 flex-1 space-y-2 text-sm ${plan.highlight ? "text-zinc-900" : "text-zinc-300"}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden="true">-</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={checkout.status === "loading"}
                onClick={() => startCheckout(plan.key)}
                className={`mt-6 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60 ${
                  plan.highlight
                    ? "bg-[#101112] text-white"
                    : "bg-white text-[#101112]"
                }`}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
          <div className="border-b border-white/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Compare plans</p>
            <h2 className="mt-2 text-3xl font-semibold">Pick based on iteration volume, not hype.</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.035] text-zinc-300">
                <tr>
                  {["Feature", "Free", "Starter", "Pro", "Studio"].map((item) => (
                    <th key={item} className="px-5 py-4 font-semibold">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row[0]} className="border-t border-white/10">
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className={`px-5 py-4 ${index === 0 ? "font-semibold text-white" : "text-zinc-300"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-5 md:grid-cols-3">
          {[
            ["Fastest first value", "Start in the console, generate or debug, then upgrade when the quota becomes the blocker."],
            ["Clear activation", "PayPal approval returns to Workfusion, then the app verifies and activates the premium plan."],
            ["Responsible positioning", "The product improves EA workflow quality. It does not promise profits or funded-account payouts."],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.answer}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
