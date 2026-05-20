"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type LeadCaptureFormProps = {
  source: string;
  persona?: string;
  compact?: boolean;
  defaultIntent?: "compiler_error" | "ea_draft" | "risk_check";
};

type FormState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
}

function guestId() {
  const key = "workfusion_guest_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const value = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `guest_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    window.localStorage.setItem(key, value);
    return value;
  } catch {
    return "guest_ephemeral";
  }
}

const intentOptions = [
  { value: "compiler_error", label: "Paste compiler errors" },
  { value: "ea_draft", label: "Generate EA draft" },
  { value: "risk_check", label: "Get risk check" },
] as const;

export function LeadCaptureForm({ source, persona = "mq5_developer", compact = false, defaultIntent = "compiler_error" }: LeadCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(persona);
  const [intent, setIntent] = useState(defaultIntent);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<FormState>({
    status: "idle",
    message: "Choose the workflow you want, then opt in so the CRM source is measurable.",
  });

  async function submit() {
    if (!validEmail(email)) {
      setState({ status: "error", message: "Enter a valid email address." });
      return;
    }
    if (!consent) {
      setState({ status: "error", message: "Please opt in before joining the list." });
      return;
    }
    setState({ status: "loading", message: "Saving opt-in." });
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workfusion-guest-id": guestId() },
        body: JSON.stringify({
          email,
          persona: role,
          source,
          consent,
          intent,
          cta: "primary_conversion_cta",
          leadStatus: "new",
          page: window.location.pathname,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setState({ status: "error", message: data.message || data.error || "Opt-in failed." });
        return;
      }
      setState({ status: "success", message: data.message || "Saved. You are on the Workfusion update list." });
    } catch {
      setState({ status: "error", message: "Network request failed while saving opt-in." });
    }
  }

  return (
    <div id="workfusion-primary-cta" className={`rounded-lg border border-emerald-300/20 bg-zinc-950 p-5 ${compact ? "" : "shadow-2xl shadow-black/20"}`}>
      <p className="text-sm font-semibold text-emerald-200">Paste compiler errors / Generate EA draft / Get risk check</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Short opt-in only. We store one source, one intent, and one new lead status. No scraped lists, no purchased contacts, no trading promises.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {intentOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setIntent(item.value)}
            className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
              intent === item.value
                ? "border-emerald-300 bg-emerald-300 text-[#101112]"
                : "border-white/10 bg-[#101112] text-zinc-300 hover:border-emerald-300/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="developer@example.com"
          className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
        >
          <option value="mq5_developer">MQL5 developer</option>
          <option value="mt4_developer">MQL4 developer</option>
          <option value="prop_trader">Prop trader</option>
          <option value="agency_or_educator">Agency / educator</option>
        </select>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-zinc-300">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
        I agree to receive Workfusion EA builder updates and understand I can unsubscribe later.
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${state.status === "error" ? "text-rose-300" : state.status === "success" ? "text-emerald-300" : "text-zinc-400"}`}>
          {state.message}
        </p>
        <Button disabled={state.status === "loading"} onClick={submit} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
          Join list
        </Button>
      </div>
    </div>
  );
}
