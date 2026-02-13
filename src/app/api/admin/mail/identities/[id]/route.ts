// src/app/api/admin/mail/identities/[id]/route.ts
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // IMPORTANT: Next.js 15+ => params è Promise
    const { id } = await params;

    // TODO: auth/role check
    await ensureDb();

    const body = await req.json();

    const patch: any = {};
    if (body.label !== undefined) patch.label = String(body.label).trim();
    if (body.fromName !== undefined) patch.fromName = String(body.fromName).trim();
    if (body.replyToEmail !== undefined)
      patch.replyToEmail = body.replyToEmail
        ? String(body.replyToEmail).trim().toLowerCase()
        : undefined;
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;

    if (body.fromEmail !== undefined) {
      const fromEmail = String(body.fromEmail).trim().toLowerCase();
      const allowedDomain = allowedDomainFromEnv();

      if (allowedDomain && domainOf(fromEmail) !== allowedDomain.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "DOMAIN_NOT_ALLOWED", allowedDomain },
          { status: 400 }
        );
      }

      patch.fromEmail = fromEmail;
    }

    const updated = await EmailIdentityModel.findByIdAndUpdate(id, patch, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: any) {
    console.error("PATCH identity error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
