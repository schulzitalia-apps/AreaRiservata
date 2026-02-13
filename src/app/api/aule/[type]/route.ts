// src/app/api/aule/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { getAulaDef } from "@/config/aule.registry";
import type { AulaTypeSlug } from "@/config/aule.types.public";

import {
  listAuleByType,
  createAula,
  AulaPartecipanteDetail,
} from "@/server-utils/service/auleQuery";

import {
  runAulaAutoActionsOnSave,
  AulaPartecipanteLite,
} from "@/server-utils/actions-engine/auleActions.engine";

import { hasPermission } from "@/server-utils/access/access-engine";

export const runtime = "nodejs";

// GET /api/aule/:type?query=&docType=&visibilityRole=&page=&pageSize=
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  // permesso di lettura sulle aule (motore generico)
  const { type } = await ctx.params;
  if (!hasPermission(auth, "aula.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim() || undefined;
  const docType = (searchParams.get("docType") || "").trim() || undefined;
  const visibilityRole =
    (searchParams.get("visibilityRole") || "").trim() || undefined;

  const pageRaw = Number(searchParams.get("page") || "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number(searchParams.get("pageSize") || "25");
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 25;

  const { items, total } = await listAuleByType({
    type,
    query,
    docType,
    visibilityRole,
    page,
    pageSize,
    // 🔐 ACL centralizzata (owner/visibilityRole) dentro auleQuery
    auth,
  });

  return NextResponse.json({ items, total, page, pageSize });
}

// POST /api/aule/:type
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;
  const userId = auth.userId;

  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type } = await ctx.params;
  // permesso di creazione aule (motore generico, *unico* gate)
  if (!hasPermission(auth, "aula.create")) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  if (!hasPermission(auth, "aula.create", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const def = getAulaDef(type);

  const body = await req.json();

  // accettiamo sia body.dati che body.campi (come prima)
  const campi: Record<string, any> = body?.dati ?? body?.campi ?? {};

  const partecipantiRaw: any[] = body?.partecipanti ?? [];
  const partecipanti: AulaPartecipanteDetail[] = partecipantiRaw.map((p) => ({
    anagraficaId: String(p.anagraficaId),
    joinedAt: p.joinedAt ?? new Date().toISOString(),
    dati: p.dati ?? {},
  }));

  const visibilityRole =
    typeof body?.visibilityRole === "string"
      ? body.visibilityRole
      : null;

  const aula = await createAula({
    type,
    ownerId: userId,
    campi,
    partecipanti,
    visibilityRole,
  });

  // Motore auto-actions AULE (CREATE)
  const aulaPartecipantiLite: AulaPartecipanteLite[] = partecipanti.map(
    (p) => ({
      anagraficaType: def.anagraficaSlug,
      anagraficaId: p.anagraficaId,
    }),
  );

  const aulaId =
    (aula as any)?._id
      ? String((aula as any)._id)
      : String((aula as any)?.id);

  await runAulaAutoActionsOnSave({
    aulaType: type as AulaTypeSlug,
    aulaId,
    userId,
    data: campi,
    partecipanti: aulaPartecipantiLite,
    partecipantiDettaglio: partecipanti,
  });

  return NextResponse.json({ aula }, { status: 201 });
}
