// src/server-utils/mail/userMailContext.ts
import MailSettingsModel from "@/server-utils/models/MailSettings";
import RoleMailPolicyModel from "@/server-utils/models/RoleMailPolicy";
import EmailIdentityModel from "@/server-utils/models/EmailIdentity";
import MailTemplateModel from "@/server-utils/models/MailTemplate";

function parseEmailFromEnv(emailFrom: string | undefined) {
  const raw = (emailFrom || "").trim();
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] || raw).trim();
  const [localPart, domain] = email.split("@");
  return { ok: !!localPart && !!domain, localPart, domain, email };
}

function getLocalPart(email: string) {
  return (email.split("@")[0] || "").trim().toLowerCase();
}

export async function getUserMailBootstrap(role: string) {
  const cfg = parseEmailFromEnv(process.env.EMAIL_FROM);
  if (!cfg.ok) throw new Error("EMAIL_FROM_INVALID");

  const settings = await MailSettingsModel.findOne({ key: "global" }).lean();
  const mailEnabled = settings?.enabled !== false;

  const policy = await RoleMailPolicyModel.findOne({ role }).lean();
  const canSend = !!policy?.canSend;
  const defaultSenderIdentityId = policy?.senderIdentityId ? String(policy.senderIdentityId) : undefined;

  const identities = await EmailIdentityModel.find({ enabled: true }).lean();
  const senderOptions = identities
    .filter((i) => getLocalPart(i.fromEmail) !== cfg.localPart.toLowerCase())
    .map((i) => ({
      id: String(i._id),
      label: i.label,
      fromName: i.fromName,
      fromEmail: i.fromEmail,
      replyToEmail: i.replyToEmail,
    }));

  const templates = await MailTemplateModel.find({ enabled: true }).sort({ updatedAt: -1 }).lean();

  return {
    mailEnabled,
    canSend,
    defaultSenderIdentityId,
    senderOptions, // ✅ sempre
    templates: templates.map((t) => ({
      key: t.key,
      name: t.name,
      subject: t.subject,
      description: t.description || "",
    })),
  };
}
