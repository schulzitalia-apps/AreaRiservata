// src/app/api/avatar/me/route.ts (esempio)
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import Profile from "@/server-utils/models/Profile";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { key } = await req.json();

  // opzionale: consenti null per "rimuovere" avatar
  if (key !== null && typeof key !== "string") {
    return NextResponse.json({ message: "Invalid key" }, { status: 400 });
  }

  // sicurezza minima: deve essere una delle immagini del set
  if (!key.startsWith("/images/user/")) {
    return NextResponse.json({ message: "Invalid avatar path" }, { status: 400 });
  }

  await connectToDatabase();
  const updated = await Profile.findOneAndUpdate(
    { userId: token.id },
    { $set: { avatarKey: key } },
    { new: true, upsert: true }
  );

  return NextResponse.json({ profile: updated });
}
