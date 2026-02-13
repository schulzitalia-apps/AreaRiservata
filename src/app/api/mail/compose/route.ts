import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { composeMailWithGroq } from "@/server-utils/anima/mailComposer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  try {
    const body = await req.json().catch(() => ({}));

    const templateKey = String(body?.templateKey || "").trim();
    if (!templateKey) {
      return NextResponse.json({ ok: false, error: "MISSING_TEMPLATE_KEY" }, { status: 400 });
    }

    const currentVars =
      body?.currentVars && typeof body.currentVars === "object" && !Array.isArray(body.currentVars)
        ? body.currentVars
        : undefined;

    const anagrafica =
      body?.anagrafica && typeof body.anagrafica === "object"
        ? {
          typeSlug: String(body.anagrafica.typeSlug || "").trim(),
          id: String(body.anagrafica.id || "").trim(),
        }
        : undefined;

    const userGoal = typeof body?.userGoal === "string" ? body.userGoal.trim() : undefined;
    const language = body?.language === "en" ? "en" : "it";

    const out = await composeMailWithGroq({
      templateKey,
      currentVars,
      anagrafica: anagrafica?.typeSlug && anagrafica?.id ? anagrafica : undefined,
      userGoal,
      language,
    });

    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/mail/compose error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
