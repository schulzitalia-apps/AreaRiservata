// src/app/api/admin/Mail/policies/route.ts
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

export async function GET(req: NextRequest) {
  try {
    // TODO: auth/role check
    await ensureDb();

    const items = await RoleMailPolicyModel.find().lean();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("GET policies error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
