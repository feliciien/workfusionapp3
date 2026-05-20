"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type GrowthLead = {
  id: string;
  email: string;
  persona: string | null;
  source: string | null;
  status: string;
  stage: string;
  score: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastContactedAt: string | null;
};

type GrowthSupportTicket = {
  id: string;
  email: string | null;
  plan: string | null;
  category: string | null;
  severity: string | null;
  subject: string | null;
  message: string;
  page: string | null;
  ai: {
    summary: string | null;
    category: string | null;
    priority: string | null;
    suggestedAction: string | null;
    ownerBrief: string | null;
  };
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type GrowthSnapshot = {
  storage: string;
  counts: Record<string, number>;
  leads: GrowthLead[];
  support: GrowthSupportTicket[];
  segments: Array<{ persona: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
  pages: Array<{ path: string; visits: number }>;
  channelTracker: Array<{
    date: string;
    channel: string;
    sourceTag: string;
    targetPersona: string;
    assetOrThread: string;
    action: string;
    cta: string;
    owner: string;
    status: string;
    result: string;
    notes: string;
  }>;
  manualPostQueue: Array<{
    channel: string;
    title: string;
    url: string;
    shareUrl: string;
    websiteUrl: string;
    linkPolicy: string;
    status: string;
    body: string;
  }>;
  tasks: Array<{ priority: string; title: string; detail: string }>;
  outreachDrafts: Array<{ channel: string; title: string; body: string }>;
};

const stages = ["new", "researching", "contacted", "trial", "customer", "nurture", "closed"];
const supportStatuses = ["open", "replied", "blocked", "closed"];
const blockerTags = ["none", "compiler_error", "generated_code_quality", "backtest_confusion", "billing", "login", "download", "mobile", "missing_feature", "ux_confusion"];

export function GrowthCommandCenter() {
  const [token, setToken] = useState("");
  const [snapshot, setSnapshot] = useState<GrowthSnapshot | null>(null);
  const [status, setStatus] = useState("Enter owner token or use an owner session, then load the growth desk.");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { ownerNotes: string; replyDraft: string; blocker: string }>>({});

  const hotLeads = useMemo(() => {
    return [...(snapshot?.leads || [])].sort((a, b) => b.score - a.score || a.stage.localeCompare(b.stage)).slice(0, 12);
  }, [snapshot]);

  async function loadGrowth(nextToken = token) {
    setLoading(true);
    setStatus("Loading growth pipeline.");
    try {
      const response = await fetch("/api/admin/growth", {
        headers: nextToken ? { "x-workfusion-admin-token": nextToken } : undefined,
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus(data.error || "Growth load failed.");
        return;
      }
      setSnapshot(data);
      setStatus(`Loaded ${data.counts?.leads || 0} leads from ${data.storage}.`);
      if (nextToken) window.localStorage.setItem("workfusion_admin_token", nextToken);
    } catch {
      setStatus("Network request failed while loading growth data.");
    } finally {
      setLoading(false);
    }
  }

  async function updateLead(id: string, patch: Partial<Pick<GrowthLead, "stage" | "score" | "notes">> & { contacted?: boolean }) {
    const response = await fetch("/api/admin/growth", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-workfusion-admin-token": token } : {}),
      },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      setStatus(data.error || "Lead update failed.");
      return;
    }
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        leads: current.leads.map((lead) => (lead.id === id ? data.lead : lead)),
      };
    });
    setStatus(`Updated ${data.lead.email}.`);
  }

  function supportDraft(ticket: GrowthSupportTicket) {
    const metadata = ticket.metadata || {};
    const existing = supportDrafts[ticket.id];
    return {
      ownerNotes: existing?.ownerNotes ?? String(metadata.ownerNotes || ""),
      replyDraft: existing?.replyDraft ?? String(metadata.replyDraft || buildSupportReplyDraft(ticket)),
      blocker: existing?.blocker ?? String(metadata.blocker || "none"),
    };
  }

  function setSupportDraft(ticket: GrowthSupportTicket, patch: Partial<{ ownerNotes: string; replyDraft: string; blocker: string }>) {
    setSupportDrafts((current) => ({
      ...current,
      [ticket.id]: {
        ...supportDraft(ticket),
        ...patch,
      },
    }));
  }

  async function updateSupport(ticket: GrowthSupportTicket, patch: Partial<Pick<GrowthSupportTicket, "status">> & { blocker?: string; ownerNotes?: string; replyDraft?: string }) {
    const draft = supportDraft(ticket);
    const response = await fetch("/api/support/messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-workfusion-admin-token": token } : {}),
      },
      body: JSON.stringify({
        id: ticket.id,
        status: patch.status,
        blocker: patch.blocker ?? draft.blocker,
        ownerNotes: patch.ownerNotes ?? draft.ownerNotes,
        replyDraft: patch.replyDraft ?? draft.replyDraft,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      setStatus(data.error || "Support update failed.");
      return;
    }
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        counts: {
          ...current.counts,
          open_support: current.support.filter((item) => item.id === ticket.id ? data.support.status === "open" : item.status === "open").length,
        },
        support: current.support.map((item) => (item.id === ticket.id ? data.support : item)),
      };
    });
    setSupportDrafts((current) => {
      const next = { ...current };
      delete next[ticket.id];
      return next;
    });
    setStatus(`Updated support ticket ${ticket.id}.`);
  }

  async function copyPost(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setStatus("Copied post draft to clipboard.");
    } catch {
      setStatus("Copy failed. Select the text manually.");
    }
  }

  async function copyAndOpenPost(id: string, post: GrowthSnapshot["manualPostQueue"][number]) {
    await copyPost(id, post.body);
    const nextUrl = post.shareUrl || post.url;
    if (nextUrl) window.open(nextUrl, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("workfusion_admin_token") || "";
    if (saved) {
      setToken(saved);
      loadGrowth(saved).catch(() => undefined);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#101112] text-white">
      <header className="border-b border-white/10 bg-[#101112]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/brand/workfusion-mark.svg" alt="Workfusion mark" className="h-10 w-10 rounded-lg border border-white/10 bg-[#101112]" />
            <span className="text-base font-semibold">Workfusion Growth</span>
          </a>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <a href="/" className="hover:text-white">Home</a>
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/mql5-compiler-fixer" className="hover:text-white">SEO</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Growth command center</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">CRM for first Workfusion users.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
              Track opt-in MQL developers, support blockers, SEO page traction, and daily outreach drafts from one owner-only desk.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
            <label className="text-sm text-zinc-400">Owner token</label>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="WORKFUSION_ADMIN_TOKEN"
              type="password"
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#101112] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">{status}</p>
              <Button disabled={loading} onClick={() => loadGrowth()} className="rounded-lg bg-emerald-300 text-[#101112] hover:bg-emerald-200">
                Load desk
              </Button>
            </div>
          </div>
        </div>

        {snapshot && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <Metric label="Leads" value={snapshot.counts.leads || 0} />
              <Metric label="New" value={snapshot.counts.new_leads || 0} />
              <Metric label="Trials" value={snapshot.counts.trials || 0} />
              <Metric label="7d visits" value={snapshot.counts.visits_7d || 0} />
            </section>

            <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-lg border border-white/10 bg-zinc-950">
                <div className="border-b border-white/10 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Lead pipeline</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Persona</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-white/5 text-zinc-300">
                          <td className="px-4 py-3">{lead.email}</td>
                          <td className="px-4 py-3">{lead.persona || "unknown"}</td>
                          <td className="px-4 py-3">{lead.source || "unknown"}</td>
                          <td className="px-4 py-3">
                            <select
                              value={lead.stage}
                              onChange={(event) => updateLead(lead.id, { stage: event.target.value, contacted: event.target.value === "contacted" })}
                              className="rounded-md border border-white/10 bg-[#101112] px-2 py-2 text-sm"
                            >
                              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              defaultValue={lead.score}
                              type="number"
                              min={0}
                              max={100}
                              onBlur={(event) => updateLead(lead.id, { score: Number(event.target.value) })}
                              className="w-20 rounded-md border border-white/10 bg-[#101112] px-2 py-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => updateLead(lead.id, { contacted: true, stage: "contacted" })} className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#101112]">
                              mark contacted
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-5">
                <Panel title="Daily owner actions">
                  <div className="space-y-3">
                    {snapshot.tasks.map((task) => (
                      <div key={task.title} className="rounded-lg border border-white/10 bg-[#101112] p-4">
                        <p className="text-xs font-semibold text-emerald-300">{task.priority}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{task.title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">{task.detail}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-3">
              <Panel title="Segments">
                {snapshot.segments.map((item) => <Row key={item.persona} label={item.persona} value={item.count} />)}
              </Panel>
              <Panel title="Sources">
                {snapshot.sources.map((item) => <Row key={item.source} label={item.source} value={item.count} />)}
              </Panel>
              <Panel title="SEO pages">
                {snapshot.pages.map((item) => <Row key={item.path} label={item.path} value={item.visits} />)}
              </Panel>
            </section>

            <section className="mt-8">
              <Panel title="Manual post queue">
                <div className="grid gap-4 lg:grid-cols-2">
                  {snapshot.manualPostQueue.map((post, index) => {
                    const id = `${post.channel}-${post.title}-${index}`;
                    return (
                      <div key={id} className="rounded-lg border border-white/10 bg-[#101112] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">{post.channel}</p>
                            <p className="mt-1 text-sm font-semibold text-white">{post.title}</p>
                          </div>
                          <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300">{post.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400">{post.linkPolicy}</span>
                          {post.websiteUrl && <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400">{post.websiteUrl}</span>}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{post.body}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button onClick={() => copyPost(id, post.body)} className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-[#101112]">
                            {copied === id ? "copied" : "copy text"}
                          </button>
                          {post.url && (
                            <button onClick={() => copyAndOpenPost(id, post)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-cyan-300">
                              copy + open
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-2">
              <Panel title="Acquisition tracker">
                <div className="space-y-3">
                  {snapshot.channelTracker.map((item, index) => (
                    <div key={`${item.date}-${item.channel}-${item.sourceTag}-${item.status}-${item.result}-${index}`} className="rounded-lg border border-white/10 bg-[#101112] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">{item.channel}</p>
                        <p className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300">{item.status}</p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{item.assetOrThread}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.action}</p>
                      <p className="mt-2 text-xs text-zinc-500">{item.sourceTag} | {item.result || "pending"}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Outreach drafts">
                <div className="space-y-3">
                  {snapshot.outreachDrafts.map((draft) => (
                    <div key={`${draft.channel}-${draft.title}`} className="rounded-lg border border-white/10 bg-[#101112] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">{draft.channel}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{draft.title}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{draft.body}</p>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Recent support">
                <div className="space-y-3">
                  {snapshot.support.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-[#101112] p-4 text-sm text-zinc-400">
                      No support tickets yet. When a user reports a bug or compiler issue, it will appear here with AI triage.
                    </p>
                  ) : (
                    snapshot.support.map((ticket) => {
                      const draft = supportDraft(ticket);
                      return (
                        <div key={ticket.id} className="rounded-lg border border-white/10 bg-[#101112] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{ticket.severity || "normal"} | {ticket.category || "support"}</p>
                            <p className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300">{ticket.status}</p>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">{ticket.subject || ticket.id}</p>
                          <p className="mt-1 text-xs text-zinc-500">{ticket.email || "anonymous"} | {ticket.plan || "free"} | {new Date(ticket.createdAt).toLocaleString()}</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{ticket.message}</p>
                          {ticket.ai?.ownerBrief && <p className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-100">{ticket.ai.ownerBrief}</p>}
                          {ticket.ai?.suggestedAction && <p className="mt-2 text-xs text-zinc-400">Suggested action: {ticket.ai.suggestedAction}</p>}
                          {ticket.page && <p className="mt-2 text-xs text-zinc-500">Page: {ticket.page}</p>}
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <select
                              value={ticket.status}
                              onChange={(event) => updateSupport(ticket, { status: event.target.value })}
                              className="rounded-md border border-white/10 bg-[#101112] px-2 py-2 text-sm"
                            >
                              {supportStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select
                              value={draft.blocker}
                              onChange={(event) => setSupportDraft(ticket, { blocker: event.target.value })}
                              className="rounded-md border border-white/10 bg-[#101112] px-2 py-2 text-sm"
                            >
                              {blockerTags.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </div>
                          <textarea
                            value={draft.ownerNotes}
                            onChange={(event) => setSupportDraft(ticket, { ownerNotes: event.target.value })}
                            placeholder="Owner note: what is the blocker and what should be fixed?"
                            className="mt-3 min-h-20 w-full rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-emerald-300"
                          />
                          <textarea
                            value={draft.replyDraft}
                            onChange={(event) => setSupportDraft(ticket, { replyDraft: event.target.value })}
                            placeholder="Reply draft to user"
                            className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-cyan-300"
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => copyPost(`${ticket.id}-reply`, draft.replyDraft)} className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-[#101112]">
                              {copied === `${ticket.id}-reply` ? "copied" : "copy reply"}
                            </button>
                            <button onClick={() => updateSupport(ticket, { status: "replied" })} className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-cyan-300">
                              mark replied
                            </button>
                            <button onClick={() => updateSupport(ticket, { status: "blocked", blocker: draft.blocker === "none" ? "ux_confusion" : draft.blocker })} className="rounded-md border border-amber-300/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10">
                              tag blocker
                            </button>
                            <button onClick={() => updateSupport(ticket, { status: "closed" })} className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white">
                              close
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950 p-5">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">{title}</p>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm">
      <span className="truncate text-zinc-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function buildSupportReplyDraft(ticket: GrowthSupportTicket) {
  const name = ticket.email ? ticket.email.split("@")[0] : "there";
  const action = ticket.ai?.suggestedAction || "I am reviewing this and will use it to improve the workflow.";
  return [
    `Hi ${name},`,
    "",
    "Thanks for reporting this. I received the issue and I am reviewing it from the Workfusion support desk.",
    "",
    `Current action: ${action}`,
    "",
    "If you can, please send the exact compiler output, the EA code snippet involved, and what you expected to happen. That will help me reproduce and fix it faster.",
    "",
    "Best,",
    "Felicien",
  ].join("\n");
}
