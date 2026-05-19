import type { NextApiRequest, NextApiResponse } from "next";
import { analyzeSupportMessage } from "@/lib/workfusion/openai";
import { queueSupportNotification } from "@/lib/workfusion/outbox";
import { getPersistentAccess } from "@/lib/workfusion/account-store";
import { getSession, isValidEmail, normalizeEmail } from "@/lib/workfusion/session";
import { listSupportMessages, saveSupportMessage } from "@/lib/workfusion/support-store";

function ownerAllowed(req: NextApiRequest) {
  const session = getSession(req);
  const token = String(req.headers["x-workfusion-admin-token"] || "");
  return (session.authenticated && session.role === "owner") || Boolean(process.env.WORKFUSION_ADMIN_TOKEN && token === process.env.WORKFUSION_ADMIN_TOKEN);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    if (!ownerAllowed(req)) return res.status(401).json({ error: "owner_auth_required" });
    const data = await listSupportMessages(Number(req.query.limit || 50));
    return res.status(200).json(data);
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = getSession(req);
  const access = await getPersistentAccess(session);
  const email = normalizeEmail(req.body?.email || access.session.email);
  const message = String(req.body?.message || "").trim();
  const subject = String(req.body?.subject || "").trim();
  const category = String(req.body?.category || "feedback").trim();
  const page = String(req.body?.page || req.headers.referer || "/").trim();

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: "valid_email_required", message: "Enter a valid email or leave it blank." });
  }
  if (message.length < 12) {
    return res.status(400).json({ error: "message_too_short", message: "Describe the issue or feedback in at least 12 characters." });
  }
  if (message.length > 8000) {
    return res.status(400).json({ error: "message_too_long", message: "Support messages must be under 8,000 characters." });
  }

  const ai = await analyzeSupportMessage({
    email,
    category,
    subject,
    message,
    page,
    plan: access.plan,
  });
  const saved = await saveSupportMessage({
    session: access.session,
    email,
    plan: access.plan,
    category,
    severity: ai.priority,
    subject,
    message,
    page,
    userAgent: req.headers["user-agent"],
    ai,
    metadata: {
      ipHashStored: false,
      source: "website_support_form",
    },
  });
  const notification = queueSupportNotification({
    ticketId: saved.id,
    subject: subject || ai.category,
    ownerBrief: ai.ownerBrief,
    email,
  });

  return res.status(200).json({
    ok: true,
    id: saved.id,
    storage: saved.storage,
    support: {
      summary: ai.summary,
      category: ai.category,
      priority: ai.priority,
      suggestedAction: ai.suggestedAction,
    },
    notification: {
      mode: notification.mode,
      queued: true,
    },
  });
}
