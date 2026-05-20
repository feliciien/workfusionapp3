import type { Metadata } from "next";
import { LeadCaptureForm } from "@/components/workfusion/LeadCaptureForm";
import { PageEventTracker } from "@/components/workfusion/PageEventTracker";
import { resourceGuidesByCluster, resourceGuideSlugs } from "@/lib/workfusion/resource-guides";

export const metadata: Metadata = {
  title: "MT4/MT5 EA Builder Resources | Workfusion",
  description:
    "Guides for MQL5 compiler fixes, MT5 EA generation, MT4 debugging, prop firm EA risk checks, and Expert Advisor code review.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  const clusters = resourceGuidesByCluster();

  return (
    <main className="min-h-screen bg-[#101112] text-white">
      <PageEventTracker path="/resources" />
      <header className="border-b border-white/10 bg-[#101112]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-10 w-10 rounded-lg border border-white/10 bg-[#101112]" />
            <span className="text-base font-semibold">Workfusion Trading AI</span>
          </a>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <a href="/#console" className="hover:text-white">Console</a>
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/updates" className="hover:text-white">Build notes</a>
            <a href="/mql5-compiler-fixer" className="hover:text-white">Compiler fixer</a>
            <a href="/growth" className="hover:text-white">Growth</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">EA builder resources</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            Practical MT4/MT5 guides for builders who want cleaner EAs.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            A focused content library for MQL compiler errors, EA generation specs, debugging, prop-style risk controls, and backtest readiness.
            {` ${resourceGuideSlugs.length} guides across five clusters link back to the Workfusion console so visitors can move from learning to testing.`}
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label="Guides" value={resourceGuideSlugs.length.toString()} />
            <Metric label="Clusters" value="5" />
            <Metric label="Intent" value="High" />
          </div>
          <a href="#workfusion-primary-cta" className="mt-7 inline-flex rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#101112] hover:bg-emerald-200">
            Paste compiler errors / Generate EA draft / Get risk check
          </a>
        </div>
        <LeadCaptureForm source="resources_hub" persona="mq5_developer" defaultIntent="compiler_error" />
      </section>

      <section className="border-y border-white/10 bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:grid-cols-5">
          {Object.entries(clusters).map(([cluster, guides]) => (
            <a key={cluster} href={`#${cluster.toLowerCase().replaceAll(" ", "-")}`} className="rounded-lg border border-white/10 bg-[#101112] p-4 hover:border-emerald-300/50">
              <p className="text-sm font-semibold text-white">{cluster}</p>
              <p className="mt-2 text-sm text-zinc-400">{guides.length} guides</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="space-y-12">
          {Object.entries(clusters).map(([cluster, guides]) => (
            <section key={cluster} id={cluster.toLowerCase().replaceAll(" ", "-")}>
              <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">{cluster}</p>
                  <h2 className="mt-2 text-3xl font-semibold">{cluster} guides</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-zinc-400">
                  Built for search intent, support reuse, and conversion into the EA console.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {guides.map((guide) => (
                  <a key={guide.slug} href={`/resources/${guide.slug}`} className="rounded-lg border border-white/10 bg-zinc-950 p-5 hover:border-emerald-300/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{guide.pillarSlug.replaceAll("-", " ")}</p>
                    <h3 className="mt-3 text-xl font-semibold text-white">{guide.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{guide.description}</p>
                    <p className="mt-5 text-sm font-semibold text-emerald-300">Read guide</p>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-emerald-300">{value}</p>
    </div>
  );
}
