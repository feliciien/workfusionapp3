import type { Metadata } from "next";
import buildNotes from "@/content/workfusion/build-notes.json";
import { LeadCaptureForm } from "@/components/workfusion/LeadCaptureForm";
import { PageEventTracker } from "@/components/workfusion/PageEventTracker";

type BuildNote = {
  id: string;
  date: string;
  title: string;
  summary: string;
  tags: string[];
  body: string[];
  ctaLabel: string;
  ctaHref: string;
};

export const metadata: Metadata = {
  title: "Workfusion Build Notes | MT4/MT5 EA Debugging Updates",
  description:
    "Public Workfusion build notes for MT4/MT5 EA generation, MQL debugging, compiler checks, and Expert Advisor readiness workflows.",
  alternates: { canonical: "/updates" },
};

export default function UpdatesPage() {
  const notes = (buildNotes as BuildNote[]).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="min-h-screen bg-[#101112] text-white">
      <PageEventTracker path="/updates" />
      <header className="border-b border-white/10 bg-[#101112]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-10 w-10 rounded-lg border border-white/10 bg-[#101112]" />
            <span className="text-base font-semibold">Workfusion Trading AI</span>
          </a>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <a href="/resources" className="hover:text-white">Resources</a>
            <a href="/mql5-compiler-fixer" className="hover:text-white">Compiler fixer</a>
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/growth" className="hover:text-white">Growth</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Build notes</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            MT4/MT5 EA debugging lessons from the Workfusion build.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            Short product updates and technical notes from real EA builder problems: compiler errors, invalid stops, backtest readiness,
            project packaging, and risk-aware Expert Advisor workflow.
          </p>
        </div>
        <LeadCaptureForm source="updates_build_notes" persona="mq5_developer" />
      </section>

      <section className="border-y border-white/10 bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:grid-cols-3">
          <Metric label="Notes" value={notes.length.toString()} />
          <Metric label="Focus" value="EA dev" />
          <Metric label="Promise" value="No signals" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="space-y-5">
          {notes.map((note) => (
            <article key={note.id} className="rounded-lg border border-white/10 bg-zinc-950 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">{note.date}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">{note.title}</h2>
              <p className="mt-3 text-base leading-7 text-zinc-300">{note.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-white/10 px-3 py-1 text-xs text-zinc-300">{tag}</span>
                ))}
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-zinc-300">
                {note.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <a href={note.ctaHref} className="mt-6 inline-flex rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-[#101112] hover:bg-emerald-200">
                {note.ctaLabel}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#101112] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-emerald-300">{value}</p>
    </div>
  );
}
