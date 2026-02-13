// src/app/api/admin/mail/policies/[role]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import RoleMailPolicyModel from "@/server-utils/models/RoleMailPolicy";

export const runtime = "nodejs";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    // TODO: auth/role check
    await ensureDb();

    const { role } = await params;
    const decodedRole = decodeURIComponent(role);

    const body = await req.json();

    const canSend = !!body.canSend;
    const senderIdentityId = body.senderIdentityId
      ? String(body.senderIdentityId)
      : undefined;

    const item = await RoleMailPolicyModel.findOneAndUpdate(
      { role: decodedRole },
      { role: decodedRole, canSend, senderIdentityId },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    console.error("PUT policy error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
