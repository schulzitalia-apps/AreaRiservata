// src/app/api/eventi/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";
import { getEventoDef } from "@/config/eventi.registry";
import {
  listEventi,
  createEvento,
  EventoPartecipanteView,
} from "@/server-utils/service/eventiQuery";
import { hasPermission } from "@/server-utils/access/access-engine";

export const runtime = "nodejs";

// GET /api/eventi/:type?query=&visibilityRole=&timeFrom=&timeTo=&anagraficaType=&anagraficaId=&gruppoType=&gruppoId=&page=&pageSize=
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  // permesso di lettura sugli eventi (usando il PermissionKey generico)
  const { type } = await ctx.params;
  if (!hasPermission(auth, "evento.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }


  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim() || undefined;
  const visibilityRole =
    (searchParams.get("visibilityRole") || "").trim() || undefined;

  const timeFrom =
    (searchParams.get("timeFrom") || "").trim() || undefined;
  const timeTo =
    (searchParams.get("timeTo") || "").trim() || undefined;

  const anagraficaType =
    (searchParams.get("anagraficaType") || "").trim() || undefined;
  const anagraficaId =
    (searchParams.get("anagraficaId") || "").trim() || undefined;

  const gruppoType =
    (searchParams.get("gruppoType") || "").trim() || undefined;
  const gruppoId =
    (searchParams.get("gruppoId") || "").trim() || undefined;

  // 🔢 paginazione
  const pageRaw = Number(searchParams.get("page") || "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number(searchParams.get("pageSize") || "25");
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 25;

  const { items, total } = await listEventi({
    type,
    query,
    visibilityRole,
    timeFrom,
    timeTo,
    anagraficaFilter:
      anagraficaType && anagraficaId
        ? { anagraficaType, anagraficaId }
        : undefined,
    gruppoFilter:
      gruppoType && gruppoId ? { gruppoType, gruppoId } : undefined,
    page,
    pageSize,
    auth, // 👈 unico pezzo di contesto che serve alla query
  });

  return NextResponse.json({ items, total, page, pageSize });
}

// POST /api/eventi/:type
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

  // permesso di creazione eventi (motore generico)
  if (!hasPermission(auth, "evento.create")) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  // permesso specifico per questo tipo di evento (slug)
  if (!hasPermission(auth, "evento.create", { resourceType: type })) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();

  // dati dinamici evento (titolo, descrizione, ecc.)
  const data: Record<string, any> = body?.data ?? body?.campi ?? {};

  // core temporale
  const timeKind = body?.timeKind as any; // TimeKind
  const startAt = body?.startAt ?? null;
  const endAt = body?.endAt ?? null;
  const allDay = !!body?.allDay;

  const recurrence = body?.recurrence
    ? {
      rrule: body.recurrence.rrule ?? null,
      until: body.recurrence.until ?? null,
      count: body.recurrence.count ?? null,
      masterId: body.recurrence.masterId ?? null,
    }
    : null;

  const gruppo = body?.gruppo
    ? {
      gruppoType: String(body.gruppo.gruppoType),
      gruppoId: String(body.gruppo.gruppoId),
    }
    : null;

  const partecipantiRaw: any[] = body?.partecipanti ?? [];
  const partecipanti: EventoPartecipanteView[] = partecipantiRaw.map((p) => ({
    anagraficaType: String(p.anagraficaType),
    anagraficaId: String(p.anagraficaId),
    role: p.role ?? null,
    status: p.status ?? null,
    quantity:
      typeof p.quantity === "number" ? p.quantity : undefined,
    note: p.note ?? null,
  }));

  const visibilityRole =
    typeof body?.visibilityRole === "string"
      ? body.visibilityRole
      : null;

  const evento = await createEvento({
    type,
    userId,
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

  return NextResponse.json({ evento }, { status: 201 });
}
