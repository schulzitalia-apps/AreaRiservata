// src/app/api/mail/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import MailTemplateModel from "@/server-utils/models/MailTemplate";
import { renderTemplate } from "@/server-utils/mail/renderTemplate";

export const runtime = "nodejs";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);
}

// POST /api/mail/preview
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;


  const body = await req.json().catch(() => ({}));
  await ensureDb();

  const templateKey = String(body.templateKey || "").trim();
  const vars = body.vars && typeof body.vars === "object" ? body.vars : {};

  if (!templateKey) {
    return NextResponse.json({ ok: false, error: "MISSING_TEMPLATE_KEY" }, { status: 400 });
  }

  const tpl = await MailTemplateModel.findOne({ key: templateKey, enabled: true }).lean();
  if (!tpl) {
    return NextResponse.json({ ok: false, error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
  }

  const subject = renderTemplate(tpl.subject, vars);
  const html = renderTemplate(tpl.html, vars);

  return NextResponse.json({ ok: true, subject, html });
}
