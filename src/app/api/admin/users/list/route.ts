// src/app/api/admin/users/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";
import InvitationModel from "@/server-utils/models/Invitation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any)?.role as string | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";
  if (!isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const users = await UserModel.find({}, { name: 1, email: 1, role: 1, approved: 1 })
    .sort({ name: 1, email: 1 })
    .limit(500)
    .lean();

  const userIds = users.map((u) => u._id);
  const pendingInvites = await InvitationModel.find({
    userId: { $in: userIds },
    $or: [{ usedAt: { $exists: false } }, { usedAt: null }],
  })
    .sort({ expiresAt: -1 })
    .select({ userId: 1, expiresAt: 1 })
    .lean();

  const pendingInviteByUserId = new Map<
    string,
    { expiresAt: string; expired: boolean }
  >();
  const now = Date.now();

  for (const invite of pendingInvites) {
    const key = String(invite.userId);
    if (pendingInviteByUserId.has(key)) continue;

    const expiresAt = invite.expiresAt instanceof Date
      ? invite.expiresAt.toISOString()
      : new Date(invite.expiresAt).toISOString();

    pendingInviteByUserId.set(key, {
      expiresAt,
      expired: new Date(expiresAt).getTime() <= now,
    });
  }

  return NextResponse.json({
    items: users.map((u) => ({
      id: String(u._id),
      name: u.name || u.email || "(no name)",
      email: u.email || "",
      role: u.role || "Cliente",
      approved: u.approved !== false ? true : false,
      pendingInviteExpiresAt: pendingInviteByUserId.get(String(u._id))?.expiresAt ?? null,
      pendingInviteExpired: pendingInviteByUserId.get(String(u._id))?.expired ?? false,
    })),
  });
}
