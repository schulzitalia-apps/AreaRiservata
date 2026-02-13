// src/app/api/mail/bootstrap/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { getUserMailBootstrap } from "@/server-utils/mail/userMailContext";
import MailTemplateModel from "@/server-utils/models/MailTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);
}

// GET /api/mail/bootstrap
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  const role =
    (auth as any)?.role ||
    (auth as any)?.user?.role ||
    (auth as any)?.profile?.role ||
    null;

  if (!role) {
    return NextResponse.json({ ok: false, error: "ROLE_NOT_FOUND" }, { status: 500 });
  }

  // bootstrap “standard” (come prima)
  const data = await getUserMailBootstrap(String(role));

  // ✅ QUI: arricchisco templates con eventAuto dal DB
  try {
    await ensureDb();

    const templates = Array.isArray((data as any)?.templates) ? (data as any).templates : [];
    const keys = templates.map((t: any) => String(t.key || "").trim()).filter(Boolean);

    if (keys.length) {
      const rows = await MailTemplateModel.find({ key: { $in: keys } })
        .select({ key: 1, eventAuto: 1 })
        .lean();

      const map = new Map<string, any>();
      for (const r of rows as any[]) map.set(String(r.key), r.eventAuto);

      const enriched = templates.map((t: any) => ({
        ...t,
        // ✅ se non c’è, resta undefined (come gli altri campi “opzionali”)
        eventAuto: map.get(String(t.key)) ?? undefined,
      }));

      return NextResponse.json(
        { ok: true, role, ...data, templates: enriched },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
  } catch (e) {
    // se fallisce l’enrichment NON blocco il bootstrap
    console.error("bootstrap templates enrichment error:", e);
  }

  return NextResponse.json(
    { ok: true, role, ...data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
