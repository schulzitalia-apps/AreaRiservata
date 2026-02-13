// src/app/api/profile/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import Profile from "@/server-utils/models/Profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const prof = await Profile.findOne({ userId: token.id }).lean();

  return NextResponse.json(
    prof
      ? {
        fullName: prof.fullName ?? null,
        phone: prof.phone ?? null,
        bio: prof.bio ?? null,
        avatarKey: prof.avatarKey ?? null,
        updatedAt: prof.updatedAt?.toISOString() ?? null,
      }
      : { fullName: null, phone: null, bio: null, avatarKey: null, updatedAt: null },
    { status: 200 }
  );
}

export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { fullName, phone, bio } = body as {
    fullName?: string;
    phone?: string;
    bio?: string;
  };

  await connectToDatabase();

  const updated = await Profile.findOneAndUpdate(
    { userId: token.id },
    {
      $set: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(bio !== undefined ? { bio } : {}),
      },
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json(
    {
      fullName: updated.fullName ?? null,
      phone: updated.phone ?? null,
      bio: updated.bio ?? null,
      avatarKey: updated.avatarKey ?? null,
      updatedAt: updated.updatedAt?.toISOString() ?? null,
    },
    { status: 200 }
  );
}
