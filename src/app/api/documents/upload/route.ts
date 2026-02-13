// src/app/api/documents/aa/route.ts  (POST = upload)
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/server-utils/lib/r2";
import DocumentModel from "@/server-utils/models/Document";
import {
  mimeToDocType,
  extFromFilename,
  inferCategoryFromName,
} from "@/utils/doc-utils";
import { platformConfig } from "@/config/platform.config";

export const runtime = "nodejs";

type AllowedCategory = (typeof platformConfig.documentTypes)[number];

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB, adatta a tuo gusto

function normalizeCategory(
  input: string | null | undefined,
  titleOrName: string
): AllowedCategory {
  const allowed = platformConfig.documentTypes as readonly string[];

  if (!input || input === "auto") {
    const inferred = inferCategoryFromName(titleOrName);
    return (allowed.includes(inferred as string) ? inferred : "other") as AllowedCategory;
  }
  return (allowed.includes(input) ? input : "other") as AllowedCategory;
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1) Parse form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    // 2) Limite dimensione lato server (hard limit)
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { message: "File too large to upload" },
        { status: 413 }
      );
    }

    const title = (form.get("title") as string) || file.name;
    const visibilityRaw = (form.get("visibility") as string) || "personal";
    const visibility = (visibilityRaw === "public" ? "public" : "personal") as
      | "public"
      | "personal";
    const summary = (form.get("summary") as string) || null;
    const requestedOwnerId = (form.get("ownerId") as string) || null;
    const catRaw = (form.get("category") as string) || "auto";

    const resolvedCategory = normalizeCategory(catRaw, title || file.name);

    await connectToDatabase();

    // NB: se è "personal", l'owner è quello richiesto (se presente) o l'utente loggato
    const ownerIdToSave =
      visibility === "personal" ? requestedOwnerId || String(token.id) : null;

    const ext = extFromFilename(file.name);
    const keyBase =
      visibility === "personal" ? `${ownerIdToSave}/docs` : `public/docs`;
    const key = `${keyBase}/${crypto.randomUUID()}.${ext}`;

    // 3) Carico il file in memoria e lo mando a R2
    // (qui ancora non streammiamo, ma abbiamo un limite di dimensione sopra)
    const arrayBuffer = await file.arrayBuffer();
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );

    // 4) Creo il documento in DB
    const doc = new DocumentModel({
      title,
      type: mimeToDocType(file.type),
      visibility,
      sizeBytes: file.size,
      summary,
      mimeType: file.type || null,
      r2Key: key,
      url: null,
      thumbnailUrl: null,
      category: resolvedCategory,
      ownerId: ownerIdToSave,
      createdBy: token.id,
    });

    await doc.validate();

    let created;
    try {
      created = await doc.save();
    } catch (dbErr: any) {
      // Se fallisce il salvataggio in DB, provo a cancellare il file da R2 per non lasciare orfani
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
          })
        );
      } catch (cleanupErr) {
        console.error(
          "[documents/upload] failed to cleanup orphaned R2 object:",
          cleanupErr
        );
      }
      throw dbErr;
    }

    // 5) Risposta pulita al client (stessa shape che avevi già)
    return NextResponse.json(
      {
        ok: true,
        document: {
          id: String(created._id),
          title: created.title,
          type: created.type,
          visibility: created.visibility,
          sizeKB: Math.round(created.sizeBytes / 1024),
          updatedAt: created.updatedAt.toISOString(),
          owner: created.ownerId
            ? { id: String(created.ownerId), name: "" }
            : { id: "", name: "" },
          url: created.url || undefined,
          thumbnailUrl: created.thumbnailUrl || undefined,
          summary: created.summary || null,
          category: created.category,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[documents/upload] error:", err);
    return NextResponse.json(
      { message: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
