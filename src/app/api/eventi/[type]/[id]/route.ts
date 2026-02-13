// src/app/api/eventi/[type]/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";
import { getEventoDef } from "@/config/eventi.registry";
import {
  getEventoById,
  updateEvento,
  deleteEvento,
  EventoPartecipanteView,
} from "@/server-utils/service/eventiQuery";

export const runtime = "nodejs";

/**
 * GET /api/eventi/:type/:id
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const { type, id } = await ctx.params;

  const evento = await getEventoById({ type, id });
  if (!evento) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ evento });
}

/**
 * PUT /api/eventi/:type/:id
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
  const def = getEventoDef(type);

  // stesso discorso di permessi del POST
  if (!def.visibilityOptions.some(([r]) => r === (role as any)) &&
    role !== "Super" &&
    role !== "Amministrazione") {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();

  const data: Record<string, any> = body?.data ?? body?.campi ?? {};

  const timeKind = body?.timeKind as any; // opzionale
  const startAt =
    "startAt" in body ? (body.startAt ?? null) : undefined;
  const endAt =
    "endAt" in body ? (body.endAt ?? null) : undefined;
  const allDay =
    "allDay" in body ? !!body.allDay : undefined;

  const recurrence =
    "recurrence" in body
      ? body.recurrence
        ? {
          rrule: body.recurrence.rrule ?? null,
          until: body.recurrence.until ?? null,
          count: body.recurrence.count ?? null,
          masterId: body.recurrence.masterId ?? null,
        }
        : null
      : undefined;

  const gruppo =
    "gruppo" in body
      ? body.gruppo
        ? {
          gruppoType: String(body.gruppo.gruppoType),
          gruppoId: String(body.gruppo.gruppoId),
        }
        : null
      : undefined;

  const partecipantiRaw: any[] =
    "partecipanti" in body ? body.partecipanti ?? [] : undefined;

  const partecipanti: EventoPartecipanteView[] | undefined =
    typeof partecipantiRaw === "undefined"
      ? undefined
      : partecipantiRaw.map((p: any) => ({
        anagraficaType: String(p.anagraficaType),
        anagraficaId: String(p.anagraficaId),
        role: p.role ?? null,
        status: p.status ?? null,
        quantity:
          typeof p.quantity === "number" ? p.quantity : undefined,
        note: p.note ?? null,
      }));

  const visibilityRole =
    "visibilityRole" in body
      ? (body.visibilityRole ?? null)
      : undefined;

  const evento = await updateEvento({
    type,
    id,
    updatedById: userId,
    data,
    timeKind,
    startAt,
    endAt,
    allDay,
    recurrence,
    gruppo,
    partecipanti,
    visibilityRole,
  });

  if (!evento) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ evento });
}

/**
 * DELETE /api/eventi/:type/:id
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
  const def = getEventoDef(type);

  if (!def.visibilityOptions.some(([r]) => r === (role as any)) &&
    role !== "Super" &&
    role !== "Amministrazione") {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const { ok } = await deleteEvento({ type, id });
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
