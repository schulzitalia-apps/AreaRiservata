import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import InvitationModel from "@/server-utils/models/Invitation";
import UserModel from "@/server-utils/models/User";
import { hashInviteToken } from "@/server-utils/invitations/token";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const token = (body?.token as string | undefined)?.trim();
  const inviteId = (body?.inviteId as string | undefined)?.trim();
  const password = (body?.password as string | undefined) ?? "";

  if (!token || !inviteId) {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: "Password troppo corta" }, { status: 400 });
  }

  await connectToDatabase();

  const tokenHash = hashInviteToken(token);
  const consumedAt = new Date();

  // L'invito viene consumato solo quando la password viene salvata davvero.
  const inv = await InvitationModel.findOneAndUpdate(
    {
      _id: inviteId,
      tokenHash,
      expiresAt: { $gt: new Date() },
      $or: [{ usedAt: { $exists: false } }, { usedAt: null }],
    },
    {
      $set: { usedAt: consumedAt },
    },
    {
      new: true,
    },
  );

  if (!inv) {
    return NextResponse.json({ message: "Invito non valido o scaduto" }, { status: 400 });
  }

  const user = await UserModel.findById(inv.userId).select("+password");
  if (!user) {
    return NextResponse.json({ message: "Utente non trovato" }, { status: 404 });
  }

  try {
    user.password = password; // verra' hashata dal pre-save
    user.approved = true;
    await user.save();
  } catch (error) {
    await InvitationModel.updateOne(
      { _id: inv._id, usedAt: consumedAt },
      { $unset: { usedAt: 1 } },
    ).catch(() => null);
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
