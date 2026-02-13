import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";

import { hasPermission } from "@/server-utils/access/access-engine";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

import { runAnagraficaAutoActionsOnSave } from "@/server-utils/actions-engine/anagraficheActions.engine";

/**
 * NOTE IMPORT:
 * - GET by id può rimanere dove sta (query layer), ma idealmente andrebbe spostata in service dedicata.
 * - UPDATE/DELETE qui sotto sono adattate al nuovo pattern "mutations/*"
 *
 * Scegli UNO dei due stili di import (barrel o diretto).
 */
import { getAnagraficaById } from "@/server-utils/service/Anagrafiche/anagraficaQuery"; // (ok per ora)
import { updateAnagrafica, deleteAnagrafica } from "@/server-utils/service/Anagrafiche/mutations";
// oppure:
// import { updateAnagrafica } from "@/server-utils/service/Anagrafiche/mutations/update";
// import { deleteAnagrafica } from "@/server-utils/service/Anagrafiche/mutations/delete";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ type: string; id: string }> };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */
/**
 * Normalizza la visibilità:
 * - supporta payload legacy: { visibilityRole: "X" }
 * - supporta payload nuovo:   { visibilityRoles: ["X","Y"] } oppure string
 * - undefined => non cambiare
 * - null => svuota
 */
function normalizeVisibilityRoles(
  body: any,
): { visibilityRoles?: string[] | null } {
  if (!body || typeof body !== "object") return {};

  if ("visibilityRoles" in body) {
    const v = body.visibilityRoles;
    if (v == null) return { visibilityRoles: null };

    if (Array.isArray(v)) {
      const arr = v
        .map((x) => (x == null ? "" : String(x).trim()))
        .filter(Boolean);
      return { visibilityRoles: arr };
    }

    const s = String(v).trim();
    return { visibilityRoles: s ? [s] : [] };
  }

  // legacy fallback
  if ("visibilityRole" in body) {
    const v = body.visibilityRole;
    if (v == null) return { visibilityRoles: null };

    const s = String(v).trim();
    return { visibilityRoles: s ? [s] : [] };
  }

  return {};
}

/* -------------------------------------------------------------------------- */
/* GET /api/anagrafiche/:type/:id                                             */
/* -------------------------------------------------------------------------- */
/**
 * Read singolo record (by id).
 *
 * Sicurezza (consigliata):
 * - auth obbligatoria
 * - check permesso "anagrafica.view" su resourceType=type
 *
 * Nota:
 * - Se vuoi anche garantire “non puoi leggere ciò che non vedi”, il getById deve
 *   applicare l’ACL list (accessFilter) o una variante "exists/accessFilter".
 * - Qui lascio la logica com’è (getAnagraficaById), perché tu hai chiesto update/delete,
 *   ma considera di allinearla allo stesso modello della list.
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  const { type, id } = await ctx.params;

  // Validazione type (registry)
  try {
    getAnagraficaDef(type as any);
  } catch {
    return NextResponse.json({ message: "Unknown type" }, { status: 404 });
  }

  // Permission check (view)
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const data = await getAnagraficaById({ type, id });
  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

/* -------------------------------------------------------------------------- */
/* PATCH /api/anagrafiche/:type/:id                                           */
/* -------------------------------------------------------------------------- */
/**
 * Update patch-like (mutation nuova).
 *
 * Sicurezza (pattern nuovo):
 * - auth obbligatoria
 * - check permesso esplicito "anagrafica.update" su resourceType=type
 * - la mutation UPDATE non usa ACL byFilter nel writer
 *   → quindi i check devono stare QUI (API).
 *
 * Pipeline:
 * 1) Auth
 * 2) Validazione type
 * 3) Permission check (update)
 * 4) Read "before" (serve per auto-actions ON_CHANGE/ON_FIRST_SET)
 * 5) Parse body (data patch + visibilityRoles patch)
 * 6) Call update mutation (atomica)
 * 7) Auto-actions (con previousData)
 * 8) Response DTO
 */
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  /* ---------------------------------------------------------------------- */
  /* 1) Auth                                                                 */
  /* ---------------------------------------------------------------------- */
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  /* ---------------------------------------------------------------------- */
  /* 2) Route params                                                         */
  /* ---------------------------------------------------------------------- */
  const { type, id } = await ctx.params;

  /* ---------------------------------------------------------------------- */
  /* 3) Validazione type + permission check                                  */
  /* ---------------------------------------------------------------------- */
  try {
    getAnagraficaDef(type as any);
  } catch {
    return NextResponse.json({ message: "Unknown type" }, { status: 404 });
  }

  if (!hasPermission(auth, "anagrafica.edit", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // userId “canonico” per audit / actions
  const updatedById = auth.userId;
  if (!updatedById) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  /* ---------------------------------------------------------------------- */
  /* 4) Stato PRIMA (serve per auto-actions)                                 */
  /* ---------------------------------------------------------------------- */
  const before = await getAnagraficaById({ type, id });
  if (!before) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  /* ---------------------------------------------------------------------- */
  /* 5) Parse body                                                          */
  /* ---------------------------------------------------------------------- */
  const body = await req.json().catch(() => ({}));

  // data patch: deve essere oggetto; se non c'è → undefined (non toccare data)
  const data =
    body?.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data
      : undefined;

  // visibility patch:
  // - undefined => non toccare
  // - null => svuota
  // - string[] => set
  const { visibilityRoles } = normalizeVisibilityRoles(body);

  /* ---------------------------------------------------------------------- */
  /* 6) Update (mutation nuova)                                              */
  /* ---------------------------------------------------------------------- */
  const updated = await updateAnagrafica({
    type,
    id,
    updatedById,
    data,
    visibilityRoles, // <<< importante: prima lo calcolavi ma non lo passavi
  });

  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  /* ---------------------------------------------------------------------- */
  /* 7) Auto-actions post-save (EDIT)                                        */
  /* ---------------------------------------------------------------------- */
  await runAnagraficaAutoActionsOnSave({
    anagraficaType: type as AnagraficaTypeSlug,
    anagraficaId: (updated as any).id,
    userId: updatedById,
    data: (updated as any).data ?? {},
    previousData: (before as any).data ?? {},
  });

  /* ---------------------------------------------------------------------- */
  /* 8) Response                                                             */
  /* ---------------------------------------------------------------------- */
  return NextResponse.json(updated);
}

/* -------------------------------------------------------------------------- */
/* DELETE /api/anagrafiche/:type/:id                                          */
/* -------------------------------------------------------------------------- */
/**
 * Delete (mutation nuova).
 *
 * Sicurezza (pattern nuovo):
 * - auth obbligatoria
 * - check permesso esplicito "anagrafica.delete" su resourceType=type
 * - la mutation DELETE non usa ACL byFilter nel writer
 *   → quindi i check devono stare QUI (API).
 *
 * Scelta operativa:
 * - possiamo leggere "before" prima del delete se servisse per log/audit/actions.
 *   Qui non è strettamente necessario, quindi lo evito per costo/latency.
 */
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  /* ---------------------------------------------------------------------- */
  /* 1) Auth                                                                 */
  /* ---------------------------------------------------------------------- */
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  /* ---------------------------------------------------------------------- */
  /* 2) Route params                                                         */
  /* ---------------------------------------------------------------------- */
  const { type, id } = await ctx.params;

  /* ---------------------------------------------------------------------- */
  /* 3) Validazione type + permission check                                  */
  /* ---------------------------------------------------------------------- */
  try {
    getAnagraficaDef(type as any);
  } catch {
    return NextResponse.json({ message: "Unknown type" }, { status: 404 });
  }

  if (!hasPermission(auth, "anagrafica.delete", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  /* ---------------------------------------------------------------------- */
  /* 4) Delete (mutation nuova)                                              */
  /* ---------------------------------------------------------------------- */
  try {
    const result = await deleteAnagrafica({ type, id });

    // contract suggerito dalla doc: { ok: false } se non trovato
    if (!result?.ok || !result?.id) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    /* ------------------------------------------------------------------ */
    /* 5) Response                                                         */
    /* ------------------------------------------------------------------ */
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err: any) {
    // Se nella mutation normalizeDeleteInput lanci "INVALID_ID"
    if (err instanceof Error && err.message === "INVALID_ID") {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }
    throw err;
  }
}
