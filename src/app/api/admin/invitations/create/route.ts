import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import {
  createOrRegenerateInvitation,
  resolveInviteBaseUrl,
  UserInvitationServiceError,
} from "@/server-utils/service/userInvitationService";
import type { AppRole } from "@/types/roles";

export const runtime = "nodejs";

type Body = {
  email?: string;
  role?: AppRole;
  name?: string;
  expiresInHours?: number;
  sendEmail?: boolean;
};

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (!guard.ok) return guard.res;

  if (!guard.auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  try {
    const result = await createOrRegenerateInvitation({
      email: body.email || "",
      role: body.role,
      name: body.name,
      expiresInHours: Number.isFinite(body.expiresInHours)
        ? Math.max(1, body.expiresInHours as number)
        : 48,
      sendEmail: !!body.sendEmail,
      createdByUserId: guard.auth.userId,
      baseUrl: resolveInviteBaseUrl(req),
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof UserInvitationServiceError) {
      const status =
        error.code === "MISSING_EMAIL"
          ? 400
          : error.code === "USER_NOT_FOUND"
            ? 404
            : error.code === "ACTIVE_USER" || error.code === "EMAIL_ALREADY_ACTIVE"
              ? 409
              : 400;
      return NextResponse.json({ message: error.message }, { status });
    }
    throw error;
  }
}
