import { LeadCaptureForm } from "./LeadCaptureForm";
import { PageEventTracker } from "./PageEventTracker";
import type { SeoLanding } from "@/lib/workfusion/seo-pages";

export function SeoLandingPage({ page }: { page: SeoLanding }) {
  return (
    <main className="min-h-screen bg-[#101112] text-white">
      <PageEventTracker path={`/${page.slug}`} />
      <header className="border-b border-white/10 bg-[#101112]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-10 w-10 rounded-lg border border-white/10 bg-[#101112]" />
            <span className="text-base font-semibold">Workfusion Trading AI</span>
          </a>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <a href="/#console" className="hover:text-white">Console</a>
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/#support" className="hover:text-white">Support</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">{page.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-white md:text-6xl">
            {page.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{page.description}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {page.bullets.map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-zinc-950 p-4 text-sm leading-6 text-zinc-300">
                {item}
              </div>
            ))}
          </div>
          <a href="#workfusion-primary-cta" className="mt-7 inline-flex rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#101112] hover:bg-emerald-200">
            Paste compiler errors / Generate EA draft / Get risk check
          </a>
        </div>
        <LeadCaptureForm source={page.source} persona={page.persona} defaultIntent={page.slug.includes("risk") ? "risk_check" : page.slug.includes("generator") ? "ea_draft" : "compiler_error"} />
      </section>

      <section className="border-y border-white/10 bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-12 md:grid-cols-3">
          <InfoBlock title="Audience" body={page.audience} />
          <InfoBlock title="Problem" body={page.problem} />
          <InfoBlock title="Outcome" body={page.outcome} />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Workflow</p>
          <h2 className="mt-2 text-3xl font-semibold">From idea or error to a cleaner EA draft.</h2>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            Workfusion keeps the output tied to code quality, compiler readiness, and explicit risk review. It does not promise trading performance.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {page.workflow.map((step, index) => (
            <div key={step} className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Step {index + 1}</p>
              <p className="mt-2 text-lg font-semibold text-white">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          {page.faqs.map((faq) => (
            <article key={faq.question} className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <h2 className="text-lg font-semibold text-white">{faq.question}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#101112] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p>
    </article>
  );
}
