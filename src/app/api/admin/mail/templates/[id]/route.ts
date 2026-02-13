// src/app/api/admin/mail/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import MailTemplateModel from "@/server-utils/models/MailTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ✅ evita caching route handler

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();

    const { id } = await params;
    const body = await req.json();

    let oid: mongoose.Types.ObjectId;
    try {
      oid = new mongoose.Types.ObjectId(id);
    } catch {
      return NextResponse.json(
        { ok: false, error: "BAD_ID" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const $set: any = {};
    const $unset: any = {};

    if (body.name !== undefined) $set.name = String(body.name).trim();
    if (body.subject !== undefined) $set.subject = String(body.subject);
    if (body.html !== undefined) $set.html = String(body.html);
    if (body.enabled !== undefined) $set.enabled = !!body.enabled;
    if (body.description !== undefined)
      $set.description = body.description ? String(body.description) : undefined;

    /**
     * ✅ eventAuto:
     * - undefined => non tocco nulla
     * - null      => unset vero
     * - {} / obj  => set raw (anche vuoto)
     */
    if (body.eventAuto !== undefined) {
      if (body.eventAuto === null) {
        $unset.eventAuto = 1;
      } else if (isPlainObject(body.eventAuto)) {
        $set.eventAuto = body.eventAuto; // anche {}
      } else {
        // tipo errato: ignoro (se vuoi, puoi fare 400)
      }
    }

    const updateDoc: any = {};
    if (Object.keys($set).length) updateDoc.$set = $set;
    if (Object.keys($unset).length) updateDoc.$unset = $unset;

    if (!Object.keys(updateDoc).length) {
      return NextResponse.json(
        { ok: false, error: "NO_CHANGES" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // ✅ BYPASS MONGOOSE: update RAW sulla collection
    const result = await MailTemplateModel.collection.findOneAndUpdate(
      { _id: oid },
      updateDoc,
      { returnDocument: "after" }
    );

    // ✅ fix TS: result può essere null e value può essere null
    const doc = result?.value ?? null;

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const item = toJsonSafe(doc);

    return NextResponse.json(
      { ok: true, item },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    console.error("PATCH template error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();

    const { id } = await params;

    let oid: mongoose.Types.ObjectId;
    try {
      oid = new mongoose.Types.ObjectId(id);
    } catch {
      return NextResponse.json(
        { ok: false, error: "BAD_ID" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    await MailTemplateModel.collection.deleteOne({ _id: oid });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    console.error("DELETE template error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
