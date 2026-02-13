// src/app/api/eventi/[type]/[id]/attachments/[attachmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { removeAttachmentFromEvento } from "@/server-utils/service/eventiQuery";

export const runtime = "nodejs";

function originFrom(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

// DELETE /api/eventi/:type/:id/attachments/:attachmentId?removeDocument=1
export async function DELETE(
  req: NextRequest,
  ctx: {
    params: Promise<{
      type: string;
      id: string;
      attachmentId: string;
    }>;
  },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.token;

  const updatedById = (token as any)?.id ?? (token as any)?.sub;
  if (!updatedById) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type, id, attachmentId } = await ctx.params;
  const removeDocument =
    new URL(req.url).searchParams.get("removeDocument") === "1";

  const removed = await removeAttachmentFromEvento({
    type,
    id,
    attachmentId,
    updatedById,
  });

  if (!removed) {
    return NextResponse.json(
      { message: "Attachment not found" },
      { status: 404 },
    );
  }

  if (removeDocument) {
    try {
      const origin = originFrom(req);
      await fetch(`${origin}/api/documents/${removed.documentId}`, {
        method: "DELETE",
        headers: {
          cookie: req.headers.get("cookie") ?? "",
        },
      });
    } catch {
      // log se vuoi ma non bloccare la risposta
    }
  }

  return NextResponse.json(
    {
      ok: true,
      removedAttachment: {
        id: removed.id,
        documentId: removed.documentId,
        type: removed.type,
      },
    },
    { status: 200 },
  );
}
