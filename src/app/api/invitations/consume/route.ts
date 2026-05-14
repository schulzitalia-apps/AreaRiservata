import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import InvitationModel from "@/server-utils/models/Invitation";
import UserModel from "@/server-utils/models/User";
import { hashInviteToken } from "@/server-utils/invitations/token";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.token as string | undefined)?.trim();

  if (!token) {
    return NextResponse.json({ message: "Token mancante" }, { status: 400 });
  }

  await connectToDatabase();

  const tokenHash = hashInviteToken(token);

  // Qui validiamo soltanto il link. Il consumo reale avviene al salvataggio
  // della password, cosi' il semplice click o una preview della mail non
  // bruciano l'invito prima dell'utente.
  const inv = await InvitationModel.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
    $or: [{ usedAt: { $exists: false } }, { usedAt: null }],
  });

  if (!inv) {
    return NextResponse.json({ message: "Invito non valido o scaduto" }, { status: 400 });
  }

  const user = await UserModel.findById(inv.userId).lean();
  if (!user) {
    return NextResponse.json({ message: "Utente non trovato" }, { status: 404 });
  }

  return NextResponse.json(
    {
      inviteId: inv._id.toString(),
      userId: inv.userId.toString(),
      email: user.email,
    },
    { status: 200 },
  );
}
