"use client";

import { useEffect, useState } from "react";

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
    description: "Validate the workflow before paying.",
    features: ["3 EA generations", "1 optimizer run", "1 report debrief", "1 EA debug", "Community support"],
  },
  {
    name: "Starter",
    key: "starter",
    price: "$29/mo",
    description: "For solo traders building first versions.",
    features: ["30 EA generations", "20 EA debugs", "Downloads enabled", "Prop-firm risk checks", "Saved project history"],
  },
  {
    name: "Pro",
    key: "pro",
    price: "$79/mo",
    description: "For active EA builders and challenge traders.",
    features: ["150 EA generations", "Full optimizer", "Report analyzer", "Priority queue", "Advanced risk memo"],
    highlight: true,
  },
  {
    name: "Studio",
    key: "studio",
    price: "$199/mo",
    description: "For agencies, educators, and trading labs.",
    features: ["Team workspace", "API access", "White-label reports", "Advanced QA", "Priority support"],
  },
];

export default function PricingPage() {
  const [checkout, setCheckout] = useState<CheckoutState>({
    status: "idle",
    message: "PayPal is the active checkout path. Stripe is parked until live price IDs are ready.",
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
    setCheckout({ status: "loading", message: "Signing in." });
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
      setCheckout({ status: "success", message: `Signed in as ${data.user?.email || email}.` });
    } catch {
      setCheckout({ status: "error", message: "Sign in request failed." });
    }
  }

  async function startCheckout(plan: string) {
    if (plan === "free") {
      window.location.href = "/#console";
      return;
    }

    if (!account?.authenticated) {
      setCheckout({ plan, status: "error", message: "Sign in first so PayPal can attach the subscription to your account." });
      return;
    }

    setCheckout({ plan, status: "loading", message: `Creating PayPal checkout for ${plan}.` });
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, provider: "paypal" }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setCheckout({ plan, status: "error", message: data.message || data.error || "PayPal checkout failed." });
        return;
      }
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
    if (paypalStatus === "success") {
      if (!subscriptionId) {
        setCheckout({
          status: "error",
          message: "PayPal returned success without a subscription id. Open PayPal dashboard or contact support to activate manually.",
        });
        return;
      }

      setCheckout({ plan, status: "loading", message: "Verifying PayPal subscription and activating account." });
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
    <main className="min-h-screen bg-[#101112] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-sm font-black text-[#101112]">WF</div>
            <div>
              <p className="font-semibold">Workfusion Trading AI</p>
              <p className="text-xs text-zinc-500">Pricing and checkout</p>
            </div>
          </a>
          <a href="/#console" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
            Open console
          </a>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Commercial plans</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight">Subscription plans for serious EA builders.</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-400">
              Start free, then upgrade when you need more generations, downloads, optimizer usage, and project workflow.
            </p>
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

        <section className="mt-8 grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-semibold text-white">Account identity</p>
            <p className="mt-1 text-sm text-zinc-400">
              {account?.authenticated ? `Signed in as ${account.user?.email}. Current plan: ${account.plan || "free"}.` : "Sign in before starting a paid plan."}
            </p>
          </div>
          {!account?.authenticated && (
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
                placeholder="Owner token"
                type="password"
                className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
              />
            </div>
          )}
          <button onClick={account?.authenticated ? refreshAccount : signIn} className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-[#101112]">
            {account?.authenticated ? "Refresh account" : "Sign in"}
          </button>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-lg border p-5 ${
                plan.highlight
                  ? "border-emerald-300 bg-emerald-300 text-[#101112] shadow-2xl shadow-emerald-500/20"
                  : "border-white/10 bg-zinc-950"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{plan.name}</p>
                {plan.highlight && <span className="rounded-lg bg-[#101112] px-2 py-1 text-xs font-semibold text-white">Best fit</span>}
              </div>
              <p className="mt-3 text-4xl font-semibold">{plan.price}</p>
              <p className={`mt-3 min-h-14 text-sm leading-6 ${plan.highlight ? "text-zinc-800" : "text-zinc-400"}`}>{plan.description}</p>
              <ul className={`mt-5 space-y-2 text-sm ${plan.highlight ? "text-zinc-900" : "text-zinc-300"}`}>
                {plan.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
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
                {plan.key === "free" ? "Use free console" : `Start ${plan.name} with PayPal`}
              </button>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-4 rounded-lg border border-white/10 bg-zinc-950 p-5 md:grid-cols-3">
          {[
            ["Billing", "PayPal live checkout is active. Stripe will be enabled only after valid price IDs are available."],
            ["Risk disclosure", "Workfusion is software assistance only. It does not manage accounts or guarantee trading results."],
            ["Best plan", "Pro is the practical default for active EA builders because it unlocks the main workflow quotas."],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
