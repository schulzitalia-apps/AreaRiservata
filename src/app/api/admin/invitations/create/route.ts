import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";
import InvitationModel from "@/server-utils/models/Invitation";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { generateInviteToken, hashInviteToken } from "@/server-utils/invitations/token";
import { sendInviteEmail } from "@/server-utils/mail/send-invite-mail";
import type { AppRole } from "@/types/roles";

export const runtime = "nodejs";

type Body = {
  email?: string;
  role?: AppRole;
  name?: string;
  expiresInHours?: number; // default 48
  sendEmail?: boolean; // default false
};

function getBaseUrl(req: NextRequest) {
  const envUrl = (process.env.APP_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  // fallback locale (utile in dev se APP_URL manca)
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (!guard.ok) return guard.res;

  if (!guard.auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const email = body.email?.toLowerCase().trim();
  const role = body.role;
  const name = body.name?.trim();
  const sendEmailFlag = !!body.sendEmail;

  const expiresInHours = Number.isFinite(body.expiresInHours)
    ? Math.max(1, body.expiresInHours as number)
    : 48;

  if (!email) {
    return NextResponse.json({ message: "Email obbligatoria" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await UserModel.findOne({ email }).select("+password");
  if (existing?.password) {
    return NextResponse.json(
      { message: "Utente già esistente con password impostata." },
      { status: 409 },
    );
  }

  // ✅ FIX conflitto role: role solo in $setOnInsert
  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        email,
        role: role ?? "Cliente",
      },
      $set: {
        approved: false,
        ...(name ? { name } : {}),
      },
    },
    { upsert: true, new: true },
  );

  // policy: solo l’ultimo invito rimane valido
  await InvitationModel.deleteMany({ userId: user._id, usedAt: { $exists: false } });

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await InvitationModel.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    createdBy: guard.auth.userId,
  });

  const baseUrl = getBaseUrl(req);
  const inviteLink = `${baseUrl}/invito?token=${token}`;

  // ✅ invio mail di sistema (Resend) SOLO se richiesto
  let mailSent = false;
  let messageId: string | null = null;

  if (sendEmailFlag) {
    const res = await sendInviteEmail({
      to: email,
      inviteLink,
      expiresAtISO: expiresAt.toISOString(),
      // ✅ NON PASSARE name: non è previsto dalla signature attuale
    });

    mailSent = true;
    messageId = (res as any)?.messageId ?? null;
  }

  return NextResponse.json(
    {
      ok: true,
      email,
      inviteLink,
      expiresAt: expiresAt.toISOString(),
      mailSent,
      messageId,
    },
    { status: 200 },
  );
}
