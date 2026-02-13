// (es) src/server-utils/lib/sendEmail.ts
import { Resend } from "resend";

export type SendEmailParams = {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string | null;

  // ✅ nuovo: permette di passare un "from" dinamico
  // es: 'Assistenza <assistenza@atlas.evolve3d.it>'
  from?: string | null;
};

export async function sendEmail(params: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY mancante");

  const from = (params.from ?? process.env.EMAIL_FROM)?.trim();
  if (!from) throw new Error("EMAIL_FROM mancante (e params.from non fornito)");

  const resend = new Resend(apiKey);

  const replyTo = (params.replyTo ?? process.env.EMAIL_REPLY_TO ?? null)?.trim() || null;

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(replyTo ? { replyTo } : {}),
  });

  // Resend SDK può restituire { data, error } oppure lanciare eccezione
  // Qui gestiamo entrambi in modo robusto
  const anyRes: any = result as any;
  if (anyRes?.error) {
    throw new Error(anyRes.error?.message || "RESEND_ERROR");
  }

  const messageId = anyRes?.data?.id || anyRes?.id || null;
  return { messageId };
}
