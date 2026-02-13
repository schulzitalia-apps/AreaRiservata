// src/app/api/anagrafiche/pack/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { buildAnagraficaPack } from "@/server-utils/anagrafiche/anagraficaPack";

export const runtime = "nodejs";

// POST /api/anagrafiche/pack
// body: { typeSlug: string; id: string }
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  try {
    const body = await req.json().catch(() => ({}));

    const typeSlug = String(body?.typeSlug || "").trim();
    const id = String(body?.id || "").trim();

    if (!typeSlug || !id) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    const pack = await buildAnagraficaPack(typeSlug, id);
    if (!pack) {
      return NextResponse.json({ ok: false, error: "ANAGRAFICA_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, pack }, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/anagrafiche/pack error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "INTERNAL_ERROR" }, { status: 500 });
  }
}
