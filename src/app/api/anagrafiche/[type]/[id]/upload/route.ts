import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { addAttachmentToAnagrafica } from "@/server-utils/service/Anagrafiche/anagraficaQuery";

export const runtime = "nodejs";

function originFrom(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

// POST /api/anagrafiche/:type/:id/upload
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const token = auth.token as any;
  const updatedById = token?.id ?? token?.sub;
  if (!updatedById) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await ctx.params;
  const def = getAnagraficaDef(type);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const attachmentType = (form.get("attachmentType") as string) || "altro";
  const title = (form.get("title") as string) || file.name;
  const summary = (form.get("summary") as string) || null;

  // category: se arriva dal form usala, altrimenti fallback su attachmentType
  const rawCategory = (form.get("category") as string) || attachmentType;

  // valida attachmentType (come facevi)
  if (!def.documentTypes.includes(attachmentType)) {
    return NextResponse.json(
      { message: `attachmentType non valido per ${type}` },
      { status: 400 }
    );
  }

  // ✅ Regola di business: gli allegati sono SEMPRE PRIVATI
  // Ignora qualsiasi visibility inviata dal client
  const visibility: "personal" = "personal";

  // upload documento passando attraverso le API dei documents
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("title", title);
  fd.append("visibility", visibility);
  if (summary) fd.append("summary", summary);

  // Evita di mandare category = "auto" (se qualcuno te la manda)
  if (rawCategory && rawCategory !== "auto") {
    fd.append("category", rawCategory);
  }

  const origin = originFrom(req);

  // Propaga cookie + eventuale authorization
  const headers: Record<string, string> = {
    cookie: req.headers.get("cookie") ?? "",
  };
  const authz = req.headers.get("authorization");
  if (authz) headers["authorization"] = authz;

  const res = await fetch(`${origin}/api/documents/upload`, {
    method: "POST",
    body: fd,
    headers,
  });

  if (!res.ok) {
    return NextResponse.json(
      { message: (await res.text().catch(() => "")) || "Upload failed" },
      { status: 400 }
    );
  }

  const { document } = (await res.json()) as { document: any };

  // aggiungi l'allegato all'anagrafica
  await addAttachmentToAnagrafica({
    type,
    id,
    updatedById,
    attachment: {
      type: attachmentType,
      documentId: document.id,
      uploadedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, document }, { status: 200 });
}
