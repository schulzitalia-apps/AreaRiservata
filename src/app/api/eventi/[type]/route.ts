import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
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

  const { type } = await ctx.params;
  if (!hasPermission(auth, "evento.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim() || undefined;
  const visibilityRole =
    (searchParams.get("visibilityRole") || "").trim() || undefined;
  const timeFrom = (searchParams.get("timeFrom") || "").trim() || undefined;
  const timeTo = (searchParams.get("timeTo") || "").trim() || undefined;
  const anagraficaType =
    (searchParams.get("anagraficaType") || "").trim() || undefined;
  const anagraficaId =
    (searchParams.get("anagraficaId") || "").trim() || undefined;
  const gruppoType =
    (searchParams.get("gruppoType") || "").trim() || undefined;
  const gruppoId = (searchParams.get("gruppoId") || "").trim() || undefined;

  const pageRaw = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number(searchParams.get("pageSize") || "100");
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 100;

  const includeData = searchParams.get("includeData") === "1";
  const includePartecipanti = searchParams.get("includePartecipanti") === "1";
  const includeGruppo = searchParams.get("includeGruppo") === "1";
  const includeAllDay = searchParams.get("includeAllDay") === "1";

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
    includeData,
    includePartecipanti,
    includeGruppo,
    includeAllDay,
    auth,
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

  if (!hasPermission(auth, "evento.create")) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  if (!hasPermission(auth, "evento.create", { resourceType: type })) {
    return NextResponse.json(
      { message: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json();

  const data: Record<string, any> = body?.data ?? body?.campi ?? {};
  const timeKind = body?.timeKind as any;
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
