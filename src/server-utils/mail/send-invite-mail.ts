import { sendEmail } from "@/server-utils/lib/sendEmail";
import { inviteEmailTemplateConfig } from "@/config/invite_template.config";

export async function sendInviteEmail(params: {
  to: string; // singolo destinatario per invito
  inviteLink: string;
  expiresAtISO: string;
}) {
  const { to, inviteLink, expiresAtISO } = params;

  // HTML centralizzato nel config (qui non tocchiamo più i testi)
  const html = inviteEmailTemplateConfig.renderHtml({ inviteLink, expiresAtISO });

  return sendEmail({
    to: [to], // ✅ to deve essere string[]
    subject: inviteEmailTemplateConfig.subject,
    html,
  });
}
