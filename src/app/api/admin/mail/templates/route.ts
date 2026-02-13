// src/app/api/admin/mail/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import MailTemplateModel from "@/server-utils/models/MailTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);
}

function isPlainObject(v: any) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function toJsonSafe(doc: any) {
  // Mongo driver restituisce _id ObjectId: convertiamolo in string per il client
  if (!doc || typeof doc !== "object") return doc;
  const out: any = { ...doc };
  if (out._id && typeof out._id !== "string") out._id = String(out._id);
  return out;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDb();

    // ✅ BYPASS MONGOOSE: prendo i documenti RAW dalla collection
    const raw = await MailTemplateModel.collection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();

    const items = raw.map(toJsonSafe);

    return NextResponse.json(
      { ok: true, items },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("GET templates error:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    const body = await req.json();

    const key = String(body.key || "").trim();
    const name = String(body.name || "").trim();
    const subject = String(body.subject || "");
    const html = String(body.html || "");
    const enabled = body.enabled === false ? false : true;
    const description = body.description ? String(body.description) : undefined;

    // ✅ eventAuto: se arriva oggetto lo salvo anche se {}
    const eventAuto =
      body.eventAuto === undefined ? undefined : isPlainObject(body.eventAuto) ? body.eventAuto : undefined;

    if (!key || !name || !subject || !html) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Creo via mongoose (va bene). Poi rileggo raw dalla collection per essere coerenti al 100%.
    const created = await MailTemplateModel.create({
      key,
      name,
      subject,
      html,
      enabled,
      description,
      eventAuto,
    });

    const raw = await MailTemplateModel.collection.findOne({ _id: created._id });
    const item = toJsonSafe(raw);

    return NextResponse.json(
      { ok: true, item },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    console.error("POST template error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
