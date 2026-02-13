// src/app/api/admin/Mail/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import MailSettingsModel from "@/server-utils/models/MailSettings";

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

    const item = await MailSettingsModel.findOne({ key: "global" }).lean();
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("GET settings error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // TODO: auth/role check
    await ensureDb();

    const body = await req.json();

    const patch: any = {};
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;

    // allow unset: null/"" -> undefined
    if (body.systemSenderIdentityId !== undefined) {
      patch.systemSenderIdentityId = body.systemSenderIdentityId
        ? String(body.systemSenderIdentityId)
        : undefined;
    }

    const item = await MailSettingsModel.findOneAndUpdate(
      { key: "global" },
      { key: "global", ...patch },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    console.error("PATCH settings error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
