import fs from "fs";
import path from "path";

const dataDir = process.env.VERCEL ? path.join("/tmp", "workfusion") : path.join(process.cwd(), ".data");
const outboxFile = path.join(dataDir, "workfusion-outbox.json");

type OutboxMessage = {
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  mode: "outbox" | "smtp_pending";
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
  const message: OutboxMessage = {
    to: input.to || process.env.WORKFUSION_OWNER_EMAIL || "owner@workfusionapp.local",
    subject: `Workfusion support: ${input.subject || input.ticketId}`,
    body: [
      `Ticket: ${input.ticketId}`,
      input.email ? `From: ${input.email}` : "From: anonymous",
      "",
      input.ownerBrief,
    ].join("\n"),
    createdAt: new Date().toISOString(),
    mode: process.env.SMTP_HOST ? "smtp_pending" : "outbox",
  };
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
