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
  const settings =
    (await MailSettingsModel.findOne({ key: "global" }).lean()) ??
    null;

  if (settings?.enabled === false) {
    return { allowed: false, reason: "MAIL_SYSTEM_DISABLED" };
  }

  const id = settings?.systemSenderIdentityId;
  if (!id) return { allowed: false, reason: "SYSTEM_SENDER_NOT_CONFIGURED" };

  const identity = await EmailIdentityModel.findById(id).lean();
  if (!identity || !identity.enabled) {
    return { allowed: false, reason: "SYSTEM_SENDER_DISABLED_OR_MISSING" };
  }

  return {
    allowed: true,
    fromName: identity.fromName,
    fromEmail: identity.fromEmail,
    replyToEmail: identity.replyToEmail,
  };
}
