// src/app/api/admin/Mail/identities/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import EmailIdentityModel from "@/server-utils/models/EmailIdentity";

export const runtime = "nodejs";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);
}

function allowedDomainFromEnv() {
  const raw = (process.env.EMAIL_FROM || "").trim();
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] || raw).trim();
  const domain = email.split("@")[1];
  return domain || null;
}

function domainOf(email: string) {
  return (email.split("@")[1] || "").toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    // TODO: auth/role check
    await ensureDb();

    const items = await EmailIdentityModel.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("GET identities error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // TODO: auth/role check
    await ensureDb();

    const body = await req.json();

    const label = String(body.label || "").trim();
    const fromName = String(body.fromName || "").trim();
    const fromEmail = String(body.fromEmail || "").trim().toLowerCase();
    const replyToEmail = body.replyToEmail
      ? String(body.replyToEmail).trim().toLowerCase()
      : undefined;
    const enabled = body.enabled === false ? false : true;

    if (!label || !fromName || !fromEmail) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const allowedDomain = allowedDomainFromEnv();
    if (allowedDomain && domainOf(fromEmail) !== allowedDomain.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "DOMAIN_NOT_ALLOWED", allowedDomain },
        { status: 400 }
      );
    }

    const created = await EmailIdentityModel.create({
      label,
      fromName,
      fromEmail,
      replyToEmail,
      enabled,
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    console.error("POST identities error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
