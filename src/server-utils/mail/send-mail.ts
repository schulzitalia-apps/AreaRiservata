import { Resend } from "resend";

export type SendEmailParams = {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string | null;
};

export async function sendEmail(params: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY mancante");

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM mancante");

  const resend = new Resend(apiKey);

  const replyTo =
    params.replyTo ??
    process.env.EMAIL_REPLY_TO ??
    null;

  await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(replyTo ? { replyTo } : {}),
  });
}
