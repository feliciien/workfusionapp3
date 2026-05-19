"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type LeadCaptureFormProps = {
  source: string;
  persona?: string;
  compact?: boolean;
};

type FormState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
}

export function LeadCaptureForm({ source, persona = "mq5_developer", compact = false }: LeadCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(persona);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<FormState>({
    status: "idle",
    message: "Get EA builder updates, compiler fixes, and launch notes.",
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, persona: role, source, consent }),
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
    <div className={`rounded-lg border border-white/10 bg-zinc-950 p-5 ${compact ? "" : "shadow-2xl shadow-black/20"}`}>
      <p className="text-sm font-semibold text-white">Join the EA builder list</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Opt-in only. No scraped lists, no purchased contacts, no trading promises.
      </p>
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
