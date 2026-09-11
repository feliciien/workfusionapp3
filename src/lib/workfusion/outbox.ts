import fs from "fs";
import path from "path";

const dataDir = process.env.VERCEL ? path.join("/tmp", "workfusion") : path.join(process.cwd(), ".data");
const outboxFile = path.join(dataDir, "workfusion-outbox.json");

type OutboxMessage = {
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  mode: "outbox" | "smtp_pending" | "resend_sent" | "resend_failed";
};

function ensureOutbox() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(outboxFile)) fs.writeFileSync(outboxFile, JSON.stringify({ messages: [] }, null, 2));
}

export function queueActivationEmail(to: string, plan: string, provider: string) {
  const message: OutboxMessage = {
    to,
    subject: "Workfusion Premium activated",
    body: `Your Workfusion ${plan} plan is active via ${provider}. You can now use premium EA generation, debugging, and risk tools.`,
    createdAt: new Date().toISOString(),
    mode: process.env.SMTP_HOST ? "smtp_pending" : "outbox",
  };
  try {
    ensureOutbox();
    const store = JSON.parse(fs.readFileSync(outboxFile, "utf8")) as { messages: OutboxMessage[] };
    store.messages.push(message);
    fs.writeFileSync(outboxFile, JSON.stringify(store, null, 2));
  } catch {
    // Email queuing should never block subscription activation. In serverless,
    // Postgres is the source of truth and local outbox files are best effort.
    message.mode = "outbox";
  }
  return message;
}

export function queueSupportNotification(input: {
  to?: string;
  ticketId: string;
  subject: string;
  ownerBrief: string;
  email?: string;
}) {
  const message = buildSupportNotification(input, process.env.SMTP_HOST ? "smtp_pending" : "outbox");
  try {
    ensureOutbox();
    const store = JSON.parse(fs.readFileSync(outboxFile, "utf8")) as { messages: OutboxMessage[] };
    store.messages.push(message);
    fs.writeFileSync(outboxFile, JSON.stringify(store, null, 2));
  } catch {
    message.mode = "outbox";
  }
  return message;
}

export async function sendSupportNotification(input: {
  to?: string;
  ticketId: string;
  subject: string;
  ownerBrief: string;
  email?: string;
}) {
  const ownerEmail = input.to || process.env.WORKFUSION_OWNER_EMAIL || "";
  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.WORKFUSION_SUPPORT_FROM || process.env.FROM_EMAIL || "";
  if (!ownerEmail || !resendKey || !from) {
    return queueSupportNotification(input);
  }

  const message = buildSupportNotification({ ...input, to: ownerEmail }, "resend_sent");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [ownerEmail],
        subject: message.subject,
        text: message.body,
      }),
    });
    if (response.ok) return message;
    return queueSupportNotification({
      ...input,
      to: ownerEmail,
      ownerBrief: `${input.ownerBrief}\n\nEmail provider failed with HTTP ${response.status}; ticket is still stored in Postgres.`,
    });
  } catch (error) {
    return {
      ...queueSupportNotification({
        ...input,
        to: ownerEmail,
        ownerBrief: `${input.ownerBrief}\n\nEmail provider failed: ${error instanceof Error ? error.message : "unknown error"}; ticket is still stored in Postgres.`,
      }),
      mode: "resend_failed" as const,
    };
  }
}

function buildSupportNotification(input: {
  to?: string;
  ticketId: string;
  subject: string;
  ownerBrief: string;
  email?: string;
}, mode: OutboxMessage["mode"]): OutboxMessage {
  return {
    to: input.to || process.env.WORKFUSION_OWNER_EMAIL || "owner@workfusionapp.local",
    subject: `Workfusion support: ${input.subject || input.ticketId}`,
    body: [
      `Ticket: ${input.ticketId}`,
      input.email ? `From: ${input.email}` : "From: anonymous",
      "",
      input.ownerBrief,
    ].join("\n"),
    createdAt: new Date().toISOString(),
    mode,
  };
}
