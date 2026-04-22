import mongoose from "mongoose";
import ProfileModel from "@/server-utils/models/Profile";
import UserModel from "@/server-utils/models/User";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { loadUserKeyScopes } from "@/server-utils/access/load-key-scopes";
import { RolesConfig } from "@/config/access/access-roles.config";
import type { AppRole } from "@/types/roles";

function normalizePhone(value: string): string {
  return value
    .replace(/^whatsapp:/i, "")
    .replace(/[^\d+]/g, "")
    .trim();
}

export async function resolveAnimaPhoneIdentity(phone: string): Promise<{
  matched: boolean;
  userId: string;
  sessionId: string;
  user: {
    userId: string;
    displayName?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    bio?: string | null;
    role?: string | null;
    isAuthenticated: boolean;
  };
  auth?: {
    role?: AppRole | null;
    isAdmin?: boolean;
    keyScopes?: Partial<Record<string, Partial<Record<string, string[]>>>>;
  };
}> {
  const normalizedPhone = normalizePhone(phone);
  const sessionId = `twilio:${normalizedPhone}`;

  if (!normalizedPhone) {
    return {
      matched: false,
      userId: sessionId,
      sessionId,
      user: {
        userId: sessionId,
        phone: phone,
        isAuthenticated: false,
      },
    };
  }

  await connectToDatabase();
  const profiles = await ProfileModel.find({
    phone: { $exists: true, $ne: null },
  })
    .select({ userId: 1, fullName: 1, phone: 1, bio: 1 })
    .lean();

  const profile = profiles.find((item: any) => normalizePhone(String(item?.phone ?? "")) === normalizedPhone);
  if (!profile?.userId || !mongoose.isValidObjectId(String(profile.userId))) {
    return {
      matched: false,
      userId: sessionId,
      sessionId,
      user: {
        userId: sessionId,
        displayName: null,
        fullName: null,
        phone: normalizedPhone,
        isAuthenticated: false,
      },
    };
  }

  const userDoc = await UserModel.findById(profile.userId)
    .select({ name: 1, email: 1, role: 1 })
    .lean();

  const userId = String(profile.userId);
  const role = (userDoc?.role as AppRole | undefined) ?? undefined;
  const isAdmin = role ? !!RolesConfig[role]?.isAdmin : false;
  const keyScopes = role && !isAdmin ? await loadUserKeyScopes(userId) : undefined;

  return {
    matched: true,
    userId,
    sessionId,
    user: {
      userId,
      displayName:
        (typeof userDoc?.name === "string" && userDoc.name.trim()) ||
        (typeof profile.fullName === "string" && profile.fullName.trim()) ||
        null,
      fullName:
        typeof profile.fullName === "string" && profile.fullName.trim()
          ? profile.fullName.trim()
          : null,
      email:
        typeof userDoc?.email === "string" && userDoc.email.trim()
          ? userDoc.email.trim().toLowerCase()
          : null,
      phone: typeof profile.phone === "string" ? profile.phone.trim() : normalizedPhone,
      bio: typeof profile.bio === "string" && profile.bio.trim() ? profile.bio.trim() : null,
      role: role ?? null,
      isAuthenticated: !!role,
    },
    auth: role
      ? {
          role,
          isAdmin,
          keyScopes,
        }
      : undefined,
  };
}
