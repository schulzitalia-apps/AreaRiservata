import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";
import InvitationModel from "@/server-utils/models/Invitation";
import { generateInviteToken, hashInviteToken } from "@/server-utils/invitations/token";
import { sendInviteEmail } from "@/server-utils/mail/send-invite-mail";
import type { AppRole } from "@/types/roles";

type CreateOrRegenerateInvitationInput =
  | {
      baseUrl: string;
      createdByUserId?: string | null;
      expiresInHours: number;
      sendEmail?: boolean;
      email: string;
      role?: AppRole;
      name?: string;
    }
  | {
      baseUrl: string;
      createdByUserId?: string | null;
      expiresInHours: number;
      sendEmail?: boolean;
      userId: string;
    };

export type CreateOrRegenerateInvitationResult = {
  email: string;
  inviteLink: string;
  expiresAt: string;
  mailSent: boolean;
  messageId: string | null;
  userId: string;
  mode: "created" | "regenerated";
};

export class UserInvitationServiceError extends Error {
  constructor(
    public code:
      | "MISSING_EMAIL"
      | "INVALID_USER_ID"
      | "USER_NOT_FOUND"
      | "ACTIVE_USER"
      | "EMAIL_ALREADY_ACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "UserInvitationServiceError";
  }
}

export function resolveInviteBaseUrl(req: NextRequest) {
  const envUrl = (process.env.APP_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export async function createOrRegenerateInvitation(
  input: CreateOrRegenerateInvitationInput,
): Promise<CreateOrRegenerateInvitationResult> {
  await connectToDatabase();

  const expiresInHours = Number.isFinite(input.expiresInHours)
    ? Math.max(1, input.expiresInHours)
    : 48;
  const sendEmailFlag = !!input.sendEmail;

  let userId: string;
  let email: string;
  let mode: "created" | "regenerated" = "regenerated";

  if ("userId" in input) {
    if (!mongoose.isValidObjectId(input.userId)) {
      throw new UserInvitationServiceError("INVALID_USER_ID", "Utente non valido");
    }

    const existingUser = await UserModel.findById(input.userId).select("+password");
    if (!existingUser) {
      throw new UserInvitationServiceError("USER_NOT_FOUND", "Utente non trovato");
    }
    if (existingUser.password) {
      throw new UserInvitationServiceError(
        "ACTIVE_USER",
        "Utente già esistente con password impostata.",
      );
    }

    userId = String(existingUser._id);
    email = (existingUser.email || "").toLowerCase().trim();

    if (!email) {
      throw new UserInvitationServiceError("MISSING_EMAIL", "Email obbligatoria");
    }
  } else {
    email = input.email.toLowerCase().trim();
    if (!email) {
      throw new UserInvitationServiceError("MISSING_EMAIL", "Email obbligatoria");
    }

    const existing = await UserModel.findOne({ email }).select("+password");
    if (existing?.password) {
      throw new UserInvitationServiceError(
        "EMAIL_ALREADY_ACTIVE",
        "Utente già esistente con password impostata.",
      );
    }

    mode = existing ? "regenerated" : "created";

    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          role: input.role ?? "Cliente",
        },
        $set: {
          approved: false,
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        },
      },
      { upsert: true, new: true },
    );

    userId = String(user._id);
  }

  await InvitationModel.deleteMany({
    userId,
    $or: [{ usedAt: { $exists: false } }, { usedAt: null }],
  });

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await InvitationModel.create({
    userId,
    tokenHash,
    expiresAt,
    createdBy: input.createdByUserId ?? undefined,
  });

  const inviteLink = `${input.baseUrl}/invito?token=${token}`;

  let mailSent = false;
  let messageId: string | null = null;

  if (sendEmailFlag) {
    const res = await sendInviteEmail({
      to: email,
      inviteLink,
      expiresAtISO: expiresAt.toISOString(),
    });
    mailSent = true;
    messageId = res.messageId ?? null;
  }

  return {
    email,
    inviteLink,
    expiresAt: expiresAt.toISOString(),
    mailSent,
    messageId,
    userId,
    mode,
  };
}
