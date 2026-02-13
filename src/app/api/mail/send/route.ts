// src/app/api/mail/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";

import MailTemplateModel from "@/server-utils/models/MailTemplate";
import MailSettingsModel from "@/server-utils/models/MailSettings";
import RoleMailPolicyModel from "@/server-utils/models/RoleMailPolicy";
import EmailIdentityModel from "@/server-utils/models/EmailIdentity";

import { renderTemplate } from "@/server-utils/mail/renderTemplate";
import { sendEmail } from "@/server-utils/lib/sendEmail"; // ✅ IMPORTA IL TUO HELPER

export const runtime = "nodejs";

function parseEmailFromEnv(emailFrom: string | undefined) {
  const raw = (emailFrom || "").trim();
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] || raw).trim();
  const [localPart] = email.split("@");
  return { ok: !!localPart, localPart, email };
}

function getLocalPart(email: string) {
  return (email.split("@")[0] || "").trim().toLowerCase();
}

function isValidEmail(x: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
}

function parseRecipients(to: any): string[] {
  const out = new Set<string>();

  const pushOne = (v: any) => {
    if (typeof v !== "string") return;
    const s = v.trim().toLowerCase();
    if (!s) return;
    if (!isValidEmail(s)) return;
    out.add(s);
  };

  if (Array.isArray(to)) {
    for (const item of to) pushOne(item);
  } else if (typeof to === "string") {
    // supporta: "a@b.com, c@d.com; e@f.com  g@h.com"
    const parts = to
      .split(/[,; \n\r\t]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) pushOne(p);
  } else {
    pushOne(String(to || ""));
  }

  return Array.from(out);
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  const role =
    (auth as any)?.role ||
    (auth as any)?.user?.role ||
    (auth as any)?.profile?.role ||
    null;

  if (!role) {
    return NextResponse.json({ ok: false, error: "ROLE_NOT_FOUND" }, { status: 500 });
  }

  const settings = await MailSettingsModel.findOne({ key: "global" }).lean();
  if (settings?.enabled === false) {
    return NextResponse.json({ ok: false, error: "MAIL_DISABLED" }, { status: 503 });
  }

  const policy = await RoleMailPolicyModel.findOne({ role: String(role) }).lean();
  if (!policy?.canSend) {
    return NextResponse.json({ ok: false, error: "ROLE_CANNOT_SEND" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const recipients = parseRecipients(body?.to);
  const templateKey = String(body?.templateKey || "").trim();

  const vars =
    body?.vars && typeof body.vars === "object" && !Array.isArray(body.vars)
      ? body.vars
      : {};

  const requestedSenderId = body?.senderIdentityId ? String(body.senderIdentityId).trim() : "";

  // ✅ override opzionali (bozza generata)
  const subjectOverride =
    typeof body?.subjectOverride === "string" ? body.subjectOverride.trim() : "";
  const htmlOverride =
    typeof body?.htmlOverride === "string" ? body.htmlOverride.trim() : "";

  if (!recipients.length || !templateKey) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const tpl = await MailTemplateModel.findOne({ key: templateKey, enabled: true }).lean();
  if (!tpl) {
    return NextResponse.json({ ok: false, error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }

  const cfg = parseEmailFromEnv(process.env.EMAIL_FROM);
  if (!cfg.ok) {
    return NextResponse.json({ ok: false, error: "EMAIL_FROM_INVALID" }, { status: 500 });
  }

  // Mittenti consentiti: enabled=true e NON local-part riservato (system)
  const identities = await EmailIdentityModel.find({ enabled: true }).lean();
  const allowed = identities.filter((i) => getLocalPart(i.fromEmail) !== cfg.localPart!.toLowerCase());

  const defaultSenderId = policy.senderIdentityId ? String(policy.senderIdentityId) : "";
  const finalSenderId = (requestedSenderId || defaultSenderId).trim();

  if (!finalSenderId) {
    return NextResponse.json({ ok: false, error: "MISSING_SENDER" }, { status: 400 });
  }

  const sender = allowed.find((i) => String(i._id) === finalSenderId);
  if (!sender) {
    return NextResponse.json({ ok: false, error: "SENDER_NOT_ALLOWED" }, { status: 400 });
  }

  // ✅ se arriva override, usalo; altrimenti template
  // ✅ in entrambi i casi, renderTemplate con vars (se ci sono {{...}})
  const subjectTpl = subjectOverride || tpl.subject;
  const htmlTpl = htmlOverride || tpl.html;

  const subject = renderTemplate(subjectTpl, vars) || subjectTpl;
  const html = renderTemplate(htmlTpl, vars) || htmlTpl;

  // ✅ from dinamico (Resend vuole "Name <email>")
  const from = `${sender.fromName} <${sender.fromEmail}>`;

  const { messageId } = await sendEmail({
    to: recipients,
    subject,
    html,
    replyTo: sender.replyToEmail || null,
    from, // ✅ override EMAIL_FROM
  });

  return NextResponse.json({ ok: true, messageId });
}
