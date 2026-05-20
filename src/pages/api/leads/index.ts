import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { getSession, isValidEmail, normalizeEmail } from "@/lib/workfusion/session";
import { attributionFrom } from "@/lib/workfusion/source-attribution";
import { saveMarketingLead } from "@/lib/workfusion/support-store";

const CONSENT_TEXT = "I agree to receive Workfusion EA builder updates and understand I can unsubscribe later.";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = normalizeEmail(req.body?.email);
  const persona = String(req.body?.persona || "").trim();
  const source = String(req.body?.source || "website_lead_form").trim();
  const intent = String(req.body?.intent || "unknown").trim().slice(0, 80);
  const cta = String(req.body?.cta || "primary_conversion_cta").trim().slice(0, 120);
  const leadStatus = String(req.body?.leadStatus || "new").trim().slice(0, 40);
  const page = String(req.body?.page || req.headers.referer || "/").trim().slice(0, 500);
  const referrer = String(req.body?.referrer || req.headers.referer || "").trim().slice(0, 500);
  const url = String(req.body?.url || req.headers.referer || "").trim().slice(0, 800);
  const activationFeature = String(req.body?.activationFeature || "").trim().slice(0, 80);
  const activationAction = String(req.body?.activationAction || "").trim().slice(0, 120);
  const reply = String(req.body?.reply || "").trim().slice(0, 1200);
  const isActivatedFollowup = source === "activated_user_followup";
  const attribution = attributionFrom({
    referrer,
    url,
    path: page,
    intent,
    sourceTag: String(req.body?.sourceTag || ""),
    conversionPath: String(req.body?.conversionPath || ""),
  });
  const consent = req.body?.consent === true;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "valid_email_required", message: "Enter a valid email address." });
  }
  if (!consent) {
    return res.status(400).json({ error: "consent_required", message: "Marketing email requires explicit opt-in consent." });
  }

  const saved = await saveMarketingLead({
    email,
    persona,
    source,
    consent,
    consentText: CONSENT_TEXT,
    userAgent: req.headers["user-agent"],
    stage: isActivatedFollowup ? "researching" : "new",
    score: isActivatedFollowup ? 70 : 0,
    notes: isActivatedFollowup
      ? [
        "Activated-user follow-up requested.",
        activationFeature ? `Feature: ${activationFeature}.` : "",
        activationAction ? `Action: ${activationAction}.` : "",
        reply ? `Reply: ${reply}` : "",
      ].filter(Boolean).join(" ")
      : "",
    metadata: {
      page,
      acquisition: "opt_in",
      intent,
      cta,
      leadStatus,
      activationFeature,
      activationAction,
      reply,
      followupQuestion: isActivatedFollowup ? "Want a free workflow review or help with the next compiler error?" : "",
      sourceTag: attribution.sourceTag,
      conversionPath: attribution.conversionPath,
      referrer,
      url,
      eventSource: source,
    },
  });
  await recordUsageEvent({
    session: getSession(req),
    eventType: "lead_opt_in",
    feature: source || "website_lead_form",
    metadata: {
      persona,
      source,
      intent,
      cta,
      leadStatus,
      activationFeature,
      activationAction,
      hasReply: Boolean(reply),
      page,
      referrer,
      url,
      sourceTag: attribution.sourceTag,
      conversionPath: attribution.conversionPath,
    },
  });

  return res.status(200).json({
    ok: true,
    id: saved.id,
    storage: saved.storage,
    message: "You are on the Workfusion EA builder update list.",
  });
}
