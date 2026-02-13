// src/server-utils/services/mails/mailService.ts
import { Resend } from "resend";
import MailTemplateModel from "@/server-utils/models/MailTemplate";
import MailLogModel from "@/server-utils/models/MailLog";
import { renderMustacheLite } from "./render";
import type { SenderResolved } from "./senderResolver";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTemplatedMail(params: {
  sender: SenderResolved & { allowed: true; fromName: string; fromEmail: string };
  to: string[];
  templateKey: string;
  vars: Record<string, any>;
  createdByUserId?: string;
  replyToOverride?: string; // opzionale: es. replyTo = Mail del cliente
  meta?: Record<string, any>;
}) {
  const tpl = await MailTemplateModel.findOne({ key: params.templateKey }).lean();
  if (!tpl || !tpl.enabled) {
    throw new Error("TEMPLATE_NOT_FOUND_OR_DISABLED");
  }

  const subject = renderMustacheLite(tpl.subject, params.vars);
  const html = renderMustacheLite(tpl.html, params.vars);

  const from = `${params.sender.fromName} <${params.sender.fromEmail}>`;
  const replyTo = params.replyToOverride || params.sender.replyToEmail;

  const log = await MailLogModel.create({
    createdBy: params.createdByUserId,
    to: params.to,
    fromEmail: params.sender.fromEmail,
    fromName: params.sender.fromName,
    subject,
    templateKey: params.templateKey,
    provider: "resend",
    status: "queued",
    meta: params.meta,
  });

  try {
    const data = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    await MailLogModel.findByIdAndUpdate(log._id, {
      status: "sent",
      providerMessageId: (data as any)?.data?.id || (data as any)?.id,
    });

    return { ok: true, id: log._id.toString(), provider: data };
  } catch (e: any) {
    await MailLogModel.findByIdAndUpdate(log._id, {
      status: "failed",
      errorMessage: e?.message || "SEND_FAILED",
    });
    throw e;
  }
}
