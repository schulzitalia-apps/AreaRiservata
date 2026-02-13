import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";
import { getAulaDef } from "@/config/aule.registry";
import {
  getAulaById,
  updateAula,
  deleteAula,
  AulaPartecipanteDetail,
} from "@/server-utils/service/auleQuery";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import {
  runAulaAutoActionsOnSave,
  AulaPartecipanteLite,
} from "@/server-utils/actions-engine/auleActions.engine";

export const runtime = "nodejs";

/**
 * GET /api/aule/:type/:id
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const { type, id } = await ctx.params;

  const aula = await getAulaById({ type, id });
  if (!aula) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ aula });
}

/**
 * PUT /api/aule/:type/:id
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.token;

  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = (token as any)?.role as AppRole | undefined;

  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type, id } = await ctx.params;
  const def = getAulaDef(type);

  if (!def.creatorRoles.includes(role as any)) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  // Stato PRIMA dell'update (serve per trigger ON_CHANGE / ON_FIRST_SET)
  const aulaBefore = await getAulaById({ type, id });
  if (!aulaBefore) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 },
    );
  }

  const body = await req.json();

  const campi: Record<string, any> = body?.dati ?? body?.campi ?? {};

  const partecipantiRaw: any[] = body?.partecipanti ?? [];
  const partecipanti: AulaPartecipanteDetail[] = partecipantiRaw.map((p) => ({
    anagraficaId: String(p.anagraficaId),
    joinedAt: p.joinedAt ?? new Date().toISOString(),
    dati: p.dati ?? {},
  }));

  const visibilityRole =
    "visibilityRole" in body
      ? (body.visibilityRole ?? null)
      : undefined;

  const aula = await updateAula({
    type,
    id,
    updatedById: userId,
    campi,
    partecipanti,
    visibilityRole,
  });

  if (!aula) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 },
    );
  }

  // Motore auto-actions AULE (EDIT)
  const aulaPartecipantiLite: AulaPartecipanteLite[] = aula.partecipanti.map(
    (p) => ({
      anagraficaType: def.anagraficaSlug,
      anagraficaId: p.anagraficaId,
    }),
  );

  await runAulaAutoActionsOnSave({
    aulaType: type as AulaTypeSlug,
    aulaId: aula.id,
    userId,
    data: aula.campi,                        // stato "dopo"
    previousData: aulaBefore.campi,          // stato "prima"
    partecipanti: aulaPartecipantiLite,
    partecipantiDettaglio: aula.partecipanti,
    previousPartecipantiDettaglio: aulaBefore.partecipanti,
  });

  return NextResponse.json({ aula });
}

/**
 * DELETE /api/aule/:type/:id
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.token;

  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = (token as any)?.role as AppRole | undefined;

  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type, id } = await ctx.params;
  const def = getAulaDef(type);

  if (!def.creatorRoles.includes(role as any)) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const { ok } = await deleteAula({ type, id });
    if (!ok) {
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 },
      );
    }
  } catch (err: any) {
    if (err instanceof Error && err.message === "INVALID_ID") {
      return NextResponse.json(
        { message: "Invalid id" },
        { status: 400 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
