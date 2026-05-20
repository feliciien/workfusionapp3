import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadCaptureForm } from "@/components/workfusion/LeadCaptureForm";
import { PageEventTracker } from "@/components/workfusion/PageEventTracker";
import { resourceGuides, resourceGuideSlugs } from "@/lib/workfusion/resource-guides";

type ResourceGuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return resourceGuideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ResourceGuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = resourceGuides[slug];
  if (!guide) return {};
  return {
    title: guide.metaTitle,
    description: guide.description,
    alternates: { canonical: `/resources/${guide.slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      url: `/resources/${guide.slug}`,
      type: "article",
    },
  };
}

export default async function ResourceGuidePage({ params }: ResourceGuidePageProps) {
  const { slug } = await params;
  const guide = resourceGuides[slug];
  if (!guide) notFound();

  const related = guide.related.map((item) => resourceGuides[item]).filter(Boolean);

  return (
    <main className="min-h-screen bg-[#101112] text-white">
      <PageEventTracker path={`/resources/${guide.slug}`} />
      <header className="border-b border-white/10 bg-[#101112]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-10 w-10 rounded-lg border border-white/10 bg-[#101112]" />
            <span className="text-base font-semibold">Workfusion Trading AI</span>
          </a>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <a href="/resources" className="hover:text-white">Resources</a>
            <a href={`/${guide.pillarSlug}`} className="hover:text-white">Pillar page</a>
            <a href="/#console" className="hover:text-white">Console</a>
          </nav>
        </div>
      </header>

      <article>
        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div>
            <a href="/resources" className="text-sm font-semibold text-cyan-300">EA builder resources</a>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">{guide.cluster}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">{guide.h1}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{guide.intro}</p>
            <div className="mt-7 rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Search intent</p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{guide.searchIntent}</p>
            </div>
            <a href="#workfusion-primary-cta" className="mt-7 inline-flex rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#101112] hover:bg-emerald-200">
              Paste compiler errors / Generate EA draft / Get risk check
            </a>
          </div>
          <LeadCaptureForm
            source={guide.source}
            persona={guide.persona}
            defaultIntent={guide.cluster === "EA Generation" ? "ea_draft" : guide.cluster === "Prop Firm Risk" ? "risk_check" : "compiler_error"}
          />
        </section>

        <section className="border-y border-white/10 bg-zinc-950">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:grid-cols-3">
            <Info label="Cluster" value={guide.cluster} />
            <Info label="Tool path" value={guide.pillarSlug.replaceAll("-", " ")} />
            <Info label="Reader" value={guide.persona.replaceAll("_", " ")} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.68fr_1.32fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Implementation checklist</p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
                {guide.checklist.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="space-y-5">
            {guide.sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-white/10 bg-zinc-950 p-6">
                <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{section.body}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {section.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-lg border border-white/10 bg-[#101112] p-4 text-sm leading-6 text-zinc-300">
                      {bullet}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-6">
              <h2 className="text-2xl font-semibold text-white">Use the tool</h2>
              <p className="mt-3 text-sm leading-7 text-emerald-50">{guide.cta}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#workfusion-primary-cta" className="rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#101112] hover:bg-emerald-200">
                  Send me the EA workflow
                </a>
                <a href={`/${guide.pillarSlug}`} className="rounded-lg border border-white/10 bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-900">
                  Open related tool page
                </a>
              </div>
            </section>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-16">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Related guides</p>
                <h2 className="mt-2 text-3xl font-semibold">Continue the EA build path.</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((item) => (
                <a key={item.slug} href={`/resources/${item.slug}`} className="rounded-lg border border-white/10 bg-zinc-950 p-5 hover:border-emerald-300/50">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{item.cluster}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#101112] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-3 text-sm font-semibold capitalize text-zinc-200">{value}</p>
    </div>
  );
}
