// src/app/api/mail/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import MailTemplateModel from "@/server-utils/models/MailTemplate";
import { renderTemplate } from "@/server-utils/mail/renderTemplate";

export const runtime = "nodejs";

// POST /api/mail/preview
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;


  const body = await req.json().catch(() => ({}));

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
