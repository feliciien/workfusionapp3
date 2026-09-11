import { randomUUID } from "crypto";
import { databaseConfigured, ensureWorkfusionSchema, query } from "./database";
import { normalizeEmail, type WorkfusionSession } from "./session";
import type { SupportAiAnalysis } from "./openai";

export type SupportMessageInput = {
  session: WorkfusionSession;
  email?: string;
  plan?: string;
  category?: string;
  severity?: string;
  subject?: string;
  message: string;
  page?: string;
  userAgent?: string;
  ai: SupportAiAnalysis;
  metadata?: Record<string, unknown>;
};

export type LeadInput = {
  email: string;
  persona?: string;
  source?: string;
  consent: boolean;
  consentText?: string;
  userAgent?: string;
  stage?: string;
  score?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type SupportMessageRecord = {
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

export async function saveSupportMessage(input: SupportMessageInput) {
  const id = `support_${randomUUID().replace(/-/gu, "").slice(0, 18)}`;
  const email = normalizeEmail(input.email || input.session.email);
  const category = cleanText(input.category || input.ai.category, 40);
  const severity = cleanText(input.severity || input.ai.priority, 24);
  const subject = cleanText(input.subject || input.ai.summary, 180);
  const message = String(input.message || "").trim().slice(0, 8000);
  const page = cleanText(input.page || "/", 500);
  const userAgent = cleanText(input.userAgent || "", 500);
  const metadata = {
    ...input.metadata,
    aiOk: input.ai.ok,
    aiError: input.ai.error,
  };

  if (databaseConfigured()) {
    try {
      await query(
        `
        insert into wf_support_messages (
          id, user_id, email, plan, category, severity, subject, message, page, user_agent,
          ai_summary, ai_category, ai_priority, ai_suggested_action, ai_owner_brief, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
        `,
        [
          id,
          input.session.id,
          email || null,
          cleanText(input.plan || input.session.plan || "free", 24),
          category || null,
          severity || null,
          subject || null,
          message,
          page || null,
          userAgent || null,
          input.ai.summary,
          input.ai.category,
          input.ai.priority,
          input.ai.suggestedAction,
          input.ai.ownerBrief,
          JSON.stringify(metadata),
        ],
      );
      return { id, storage: "postgres" as const };
    } catch {
      return { id, storage: "memory_fallback" as const };
    }
  }

  return { id, storage: "memory_fallback" as const };
}

export async function listSupportMessages(limit = 50) {
  await ensureWorkfusionSchema();
  const result = await query<SupportRow>(
    `
    select id, email, plan, category, severity, subject, message, page,
      ai_summary, ai_category, ai_priority, ai_suggested_action, ai_owner_brief, status, metadata, created_at
    from wf_support_messages
    order by created_at desc
    limit $1
    `,
    [Math.max(1, Math.min(100, limit))],
  );

  return {
    storage: databaseConfigured() ? "postgres" : "local-json",
    messages: (result?.rows || []).map(mapSupportRow),
  };
}

const allowedSupportStatuses = new Set(["open", "replied", "blocked", "closed"]);

export async function updateSupportMessage(input: {
  id: string;
  status?: string;
  blocker?: string;
  ownerNotes?: string;
  replyDraft?: string;
}) {
  await ensureWorkfusionSchema();
  const status = input.status && allowedSupportStatuses.has(input.status) ? input.status : undefined;
  const metadataPatch: Record<string, unknown> = {
    ownerUpdatedAt: new Date().toISOString(),
  };

  if (input.blocker !== undefined) metadataPatch.blocker = cleanText(input.blocker, 80) || "none";
  if (input.ownerNotes !== undefined) metadataPatch.ownerNotes = String(input.ownerNotes || "").slice(0, 2000);
  if (input.replyDraft !== undefined) metadataPatch.replyDraft = String(input.replyDraft || "").slice(0, 3000);

  const result = await query<SupportRow>(
    `
    update wf_support_messages
    set
      status = coalesce($2, status),
      metadata = metadata || $3::jsonb,
      updated_at = now()
    where id = $1
    returning id, email, plan, category, severity, subject, message, page,
      ai_summary, ai_category, ai_priority, ai_suggested_action, ai_owner_brief, status, metadata, created_at
    `,
    [input.id, status || null, JSON.stringify(metadataPatch)],
  );
  const row = result?.rows[0];
  return row ? mapSupportRow(row) : null;
}

export async function saveMarketingLead(input: LeadInput) {
  const email = normalizeEmail(input.email);
  const id = `lead_${randomUUID().replace(/-/gu, "").slice(0, 18)}`;
  const stage = cleanText(input.stage || "new", 40) || "new";
  const score = Math.max(0, Math.min(100, Math.round(Number(input.score || 0))));
  const notes = String(input.notes || "").trim().slice(0, 2000);
  if (databaseConfigured()) {
    try {
      await query(
        `
        insert into wf_marketing_leads (id, email, persona, source, consent, consent_text, user_agent, metadata, stage, score, notes)
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        on conflict (email) do update set
          persona = excluded.persona,
          source = excluded.source,
          consent = excluded.consent,
          consent_text = excluded.consent_text,
          user_agent = excluded.user_agent,
          metadata = excluded.metadata,
          stage = case when excluded.stage <> 'new' then excluded.stage else wf_marketing_leads.stage end,
          score = greatest(wf_marketing_leads.score, excluded.score),
          notes = case when excluded.notes <> '' then excluded.notes else wf_marketing_leads.notes end,
          status = 'subscribed',
          updated_at = now()
        `,
        [
          id,
          email,
          cleanText(input.persona || "", 80) || null,
          cleanText(input.source || "website", 120),
          input.consent,
          cleanText(input.consentText || "", 500),
          cleanText(input.userAgent || "", 500) || null,
          JSON.stringify(input.metadata || {}),
          stage,
          score,
          notes,
        ],
      );
      return { id, storage: "postgres" as const };
    } catch {
      return { id, storage: "memory_fallback" as const };
    }
  }

  return { id, storage: "memory_fallback" as const };
}

function cleanText(value: unknown, max: number) {
  return String(value || "").replace(/\s+/gu, " ").trim().slice(0, max);
}

type SupportRow = {
  id: string;
  email: string | null;
  plan: string | null;
  category: string | null;
  severity: string | null;
  subject: string | null;
  message: string;
  page: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_priority: string | null;
  ai_suggested_action: string | null;
  ai_owner_brief: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

function mapSupportRow(row: SupportRow): SupportMessageRecord {
  return {
    id: row.id,
    email: row.email,
    plan: row.plan,
    category: row.category,
    severity: row.severity,
    subject: row.subject,
    message: row.message,
    page: row.page,
    ai: {
      summary: row.ai_summary,
      category: row.ai_category,
      priority: row.ai_priority,
      suggestedAction: row.ai_suggested_action,
      ownerBrief: row.ai_owner_brief,
    },
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
  };
}
