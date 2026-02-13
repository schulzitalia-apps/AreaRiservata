// src/app/api/avatar/view/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import Profile from "@/server-utils/models/Profile";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const prof = await Profile.findOne({ userId: token.id }).lean();

  if (!prof?.avatarKey) {
    return NextResponse.json({ url: null, key: null });
  }

  return NextResponse.json({
    key: prof.avatarKey,
    url: prof.avatarKey, // è già il path pubblico
  });
}
