// src/server-utils/services/mails/senderResolver.ts
import RoleMailPolicyModel from "@/server-utils/models/RoleMailPolicy";
import EmailIdentityModel from "@/server-utils/models/EmailIdentity";
import MailSettingsModel from "@/server-utils/models/MailSettings";
import type { AppRole } from "@/types/roles";

export type SenderResolved = {
  allowed: boolean;
  reason?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
};

function parseEnvMailbox(raw?: string | null): {
  fromName?: string;
  fromEmail?: string;
} | null {
  const value = raw?.trim();
  if (!value) return null;

  const named = value.match(/^(.*)<([^>]+)>$/);
  if (named) {
    const fromName = named[1]?.trim().replace(/^"|"$/g, "");
    const fromEmail = named[2]?.trim().toLowerCase();
    if (!fromEmail) return null;
    return {
      fromName: fromName || fromEmail,
      fromEmail,
    };
  }

  if (value.includes("@")) {
    return {
      fromName: value,
      fromEmail: value.toLowerCase(),
    };
  }

  return null;
}

function resolveEnvDefaultSender(): SenderResolved | null {
  const mailbox = parseEnvMailbox(process.env.EMAIL_FROM ?? null);
  if (!mailbox?.fromEmail) return null;

  const replyTo =
    process.env.EMAIL_REPLY_TO?.trim().toLowerCase() || mailbox.fromEmail;

  return {
    allowed: true,
    reason: "ENV_DEFAULT_SENDER",
    fromName: mailbox.fromName ?? mailbox.fromEmail,
    fromEmail: mailbox.fromEmail,
    replyToEmail: replyTo,
  };
}

export async function resolveSenderForUserRole(role: AppRole): Promise<SenderResolved> {
  const policy = await RoleMailPolicyModel.findOne({ role }).lean();

  if (!policy?.canSend) {
    return { allowed: false, reason: "ROLE_NOT_ALLOWED" };
  }

  if (!policy.senderIdentityId) {
    return { allowed: false, reason: "ROLE_NO_SENDER_CONFIGURED" };
  }

  const identity = await EmailIdentityModel.findById(policy.senderIdentityId).lean();
  if (!identity || !identity.enabled) {
    return { allowed: false, reason: "SENDER_DISABLED_OR_MISSING" };
  }

  return {
    allowed: true,
    fromName: identity.fromName,
    fromEmail: identity.fromEmail,
    replyToEmail: identity.replyToEmail,
  };
}

export async function resolveSystemSender(): Promise<SenderResolved> {
  const envDefaultSender = resolveEnvDefaultSender();
  const settings =
    (await MailSettingsModel.findOne({ key: "global" }).lean()) ??
    null;

  if (settings?.enabled === false) {
    return envDefaultSender ?? { allowed: false, reason: "MAIL_SYSTEM_DISABLED" };
  }

  const id = settings?.systemSenderIdentityId;
  if (!id) {
    return envDefaultSender ?? { allowed: false, reason: "SYSTEM_SENDER_NOT_CONFIGURED" };
  }

  const identity = await EmailIdentityModel.findById(id).lean();
  if (!identity || !identity.enabled) {
    return envDefaultSender ?? { allowed: false, reason: "SYSTEM_SENDER_DISABLED_OR_MISSING" };
  }

  return {
    allowed: true,
    fromName: identity.fromName,
    fromEmail: identity.fromEmail,
    replyToEmail: identity.replyToEmail,
  };
}
