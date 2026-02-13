/* src/app/api/documents/[id]/view/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { r2Client } from "@/server-utils/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DocumentItemModel from "@/server-utils/models/Document";
import { nodeReadableToWebReadable } from "@/server-utils/lib/streams";

export const runtime = "nodejs";

const INLINE_MIME_WHITELIST = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function normalizeContentType(ct?: string | null) {
  if (!ct) return "";
  return ct.split(";")[0].trim().toLowerCase();
}

function extFromMime(mime: string) {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function buildFilename(base: string, mime: string) {
  const safeBase = (base || "document").trim() || "document";
  const ext = extFromMime(mime);
  if (ext && !safeBase.toLowerCase().endsWith(ext)) return `${safeBase}${ext}`;
  return safeBase;
}

function contentDisposition(
  disposition: "inline" | "attachment",
  filename: string
) {
  const safe = filename.replace(/"/g, "");
  const encoded = encodeURIComponent(safe);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await connectToDatabase();
  const doc = await DocumentItemModel.findById(id).lean();
  if (!doc) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  //if (doc.visibility !== "public" && String(doc.ownerId) !== String(token.id)) {
    //return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  //}

  const obj = await r2Client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: doc.r2Key,
    })
  );

  if (!obj.Body) {
    return NextResponse.json({ message: "Empty file" }, { status: 500 });
  }

  const MAX_BYTES = 50 * 1024 * 1024;
  if (obj.ContentLength && obj.ContentLength > MAX_BYTES) {
    return NextResponse.json(
      { message: "File too large to be viewed" },
      { status: 413 }
    );
  }

  const webStream = nodeReadableToWebReadable(obj.Body as any);

  const rawContentType =
    obj.ContentType || doc.mimeType || "application/octet-stream";
  const contentType = normalizeContentType(rawContentType);

  const inlineAllowed = INLINE_MIME_WHITELIST.has(contentType);

  const filenameBase =
    doc.title && doc.title.trim().length > 0 ? doc.title.trim() : "document";
  const filename = buildFilename(filenameBase, contentType);

  const cacheControl =
    doc.visibility === "public" ? "private, max-age=60" : "private, no-store";

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": rawContentType,
      "Content-Disposition": contentDisposition(
        inlineAllowed ? "inline" : "attachment",
        filename
      ),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
