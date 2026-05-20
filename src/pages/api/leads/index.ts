import type { NextApiRequest, NextApiResponse } from "next";
import { recordUsageEvent } from "@/lib/workfusion/account-store";
import { getSession, isValidEmail, normalizeEmail } from "@/lib/workfusion/session";
import { saveMarketingLead } from "@/lib/workfusion/support-store";

const CONSENT_TEXT = "I agree to receive Workfusion EA builder updates and understand I can unsubscribe later.";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = normalizeEmail(req.body?.email);
  const persona = String(req.body?.persona || "").trim();
  const source = String(req.body?.source || "website_lead_form").trim();
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
    metadata: {
      page: req.headers.referer || "/",
      acquisition: "opt_in",
    },
  });
  await recordUsageEvent({
    session: getSession(req),
    eventType: "lead_opt_in",
    feature: source || "website_lead_form",
    metadata: {
      persona,
      source,
      page: req.headers.referer || "/",
    },
  });

  return res.status(200).json({
    ok: true,
    id: saved.id,
    storage: saved.storage,
    message: "You are on the Workfusion EA builder update list.",
  });
}
