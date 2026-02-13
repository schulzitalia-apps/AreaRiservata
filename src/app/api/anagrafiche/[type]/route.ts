// src/app/api/anagrafiche/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";

import { listAnagrafiche, type ListSortKey } from "@/server-utils/service/Anagrafiche/list";
import { createAnagrafica } from "@/server-utils/service/Anagrafiche/mutations";

import { hasPermission } from "@/server-utils/access/access-engine";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

import { runAnagraficaAutoActionsOnSave } from "@/server-utils/actions-engine/anagraficheActions.engine";

import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import { parseFieldsInput } from "@/server-utils/service/Anagrafiche/list/utils/parse-fields";

export const runtime = "nodejs";

/**
 * API — Anagrafiche (endpoint “collection” per tipo)
 * =================================================
 *
 * Route:
 *   /api/anagrafiche/:type
 *
 * `:type` è lo slug config-driven (es. "clienti", "fornitori", "articoli"...).
 * Ogni slug punta a UNA collection specifica (via factory model).
 *
 * Espone:
 * - GET  -> list (pipeline nuova: filter/search/ACL/projection/sort/pagination/join/map)
 * - POST -> create (mutation)
 *
 * Sicurezza:
 * - richiede autenticazione (requireAuth)
 * - verifica permesso su resourceType = type (hasPermission)
 *
 * Validazione:
 * - `type` deve esistere nel registry (getAnagraficaDef) altrimenti 404.
 */

/* -------------------------------------------------------------------------- */
/* Helpers: parsing e mapping dei query params                                */
/* -------------------------------------------------------------------------- */

/**
 * Converte (sortKey, sortDir) della API in ListSortKey della service.
 *
 * Regole:
 * - se mancano => undefined (la service usa default updatedAt_desc)
 * - updatedAt / createdAt => updatedAt_desc/asc ecc.
 * - title0/title1 => preview:<def.preview.title[i]>:<dir>
 * - subtitle0/subtitle1 => preview:<def.preview.subtitle[i]>:<dir>
 * - search0/search1/... => preview:<def.preview.searchIn[i]>:<dir>
 *
 * Sicurezza:
 * - non permette sort su campi arbitrari: solo su preview fields (indicizzati via ensureIndexes).
 */
function toListSortKey(def: any, sortKey?: string, sortDir?: "asc" | "desc"): ListSortKey | undefined {
  if (!sortKey) return undefined;

  const dir = sortDir === "asc" ? "asc" : "desc";

  // sort core temporali
  if (sortKey === "updatedAt") return (`updatedAt_${dir}` as ListSortKey);
  if (sortKey === "createdAt") return (`createdAt_${dir}` as ListSortKey);

  // helper per estrarre indice dal suffisso numerico (es. title0 -> 0)
  const pickIndex = (raw: string, prefix: string) => {
    if (!raw.startsWith(prefix)) return null;
    const n = Number(raw.slice(prefix.length));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // titleN -> def.preview.title[N]
  {
    const idx = pickIndex(sortKey, "title");
    if (idx !== null) {
      const field = def?.preview?.title?.[idx];
      if (field) return (`preview:${String(field)}:${dir}` as ListSortKey);
      return undefined;
    }
  }

  // subtitleN -> def.preview.subtitle[N]
  {
    const idx = pickIndex(sortKey, "subtitle");
    if (idx !== null) {
      const field = def?.preview?.subtitle?.[idx];
      if (field) return (`preview:${String(field)}:${dir}` as ListSortKey);
      return undefined;
    }
  }

  // searchN -> def.preview.searchIn[N]
  {
    const idx = pickIndex(sortKey, "search");
    if (idx !== null) {
      const field = def?.preview?.searchIn?.[idx];
      if (field) return (`preview:${String(field)}:${dir}` as ListSortKey);
      return undefined;
    }
  }

  // qualunque altro valore => ignorato (fallback default della service)
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* GET /api/anagrafiche/:type                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Listing (preview) anagrafiche.
 *
 * Query params supportati:
 *
 * - query: string
 * - docType: string
 * - visibilityRole: string
 * - page: number (default 1)
 * - pageSize: number (default 25, max 200)
 *
 * Sort:
 * - sortKey: string
 * - sortDir: "asc" | "desc"
 *
 * Projection dinamica (opzionale):
 * - fields: string
 *     formato CSV: fields=ragioneSociale,piva,email
 *     oppure ripetuto: fields=ragioneSociale&fields=piva&fields=email
 *
 * Nota:
 * - la whitelist vera dei campi è applicata dalla service (su def.fields)
 * - qui facciamo solo parsing "safe" della querystring.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  // 1) Auth (bloccante)
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  // 2) Param route: type
  const { type } = await ctx.params;

  // 3) Validazione type: deve esistere nel registry
  let def: any;
  try {
    def = getAnagraficaDef(type as any);
  } catch {
    return NextResponse.json({ message: "Unknown type" }, { status: 404 });
  }

  // 4) Permission check (view su quello slug)
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // 5) Parse query params
  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim() || undefined;
  const docType = (searchParams.get("docType") || "").trim() || undefined;

  // filtro dominio: array contains su visibilityRoles
  const visibilityRole =
    (searchParams.get("visibilityRole") || "").trim() || undefined;

  // paginazione offset
  const pageRaw = Number(searchParams.get("page") || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number(searchParams.get("pageSize") || 25);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 25;

  // cap hard per evitare paginazioni “killer”
  const safePageSize = Math.min(Math.max(pageSize, 1), 200);
  const offset = (page - 1) * safePageSize;

  // sort (opzionale)
  const sortKeyRaw = (searchParams.get("sortKey") || "").trim() || undefined;
  const sortDirRaw = (searchParams.get("sortDir") || "").trim().toLowerCase();
  const sortDir =
    sortDirRaw === "asc" || sortDirRaw === "desc" ? (sortDirRaw as "asc" | "desc") : undefined;

  // mapping API sort -> service sort
  const sort = toListSortKey(def, sortKeyRaw, sortDir);

  // projection dinamica (opzionale)
  // supporta: fields=... (csv) e fields=...&fields=... (ripetuto)
  const fieldsRaw = searchParams.getAll("fields");
  const fields = parseFieldsInput(fieldsRaw.length ? fieldsRaw : (searchParams.get("fields") as any)) as FieldKey[] | undefined;

  // 6) Call service (pipeline nuova)
  const { items, total } = await listAnagrafiche({
    type,
    query,
    limit: safePageSize,
    offset,
    docType,
    visibilityRole,
    sort,
    fields,
    auth,
  });

  // 7) Response
  return NextResponse.json({
    items,
    total,
    page,
    pageSize: safePageSize,
    sort: sort ?? "updatedAt_desc",     // utile al FE per ripetere in UI cosa è stato applicato davvero
    fields: fields && fields.length ? fields : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* POST /api/anagrafiche/:type                                                */
/* -------------------------------------------------------------------------- */
/**
 * Create (mutation) anagrafiche.
 *
 * Route:
 *   /api/anagrafiche/:type
 *
 * `:type` è lo slug config-driven (es. "clienti", "fornitori", "articoli"...).
 * Ogni slug punta a UNA collection specifica (via factory model + registry).
 *
 * Body supportato:
 * - data: Record<string, any>
 * - visibilityRoles?: string[]        // preferito
 * - visibilityRole?: string           // legacy / shortcut (singolo ruolo)
 *
 * Sicurezza (pattern nuovo):
 * - richiede autenticazione (requireAuth)
 * - verifica permesso esplicito "anagrafica.create" su resourceType = type (hasPermission)
 * - la mutation create NON applica ACL byFilter (niente accessFilter nel writer)
 *   → quindi i check devono stare QUI (API).
 *
 * Pipeline (alto livello):
 * 1) Auth
 * 2) Validazione type (registry)
 * 3) Permission check (create)
 * 4) Parse & normalize body
 * 5) Call mutation create
 * 6) Auto-actions post-save (eventuale business engine)
 * 7) Response { id }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  /* ---------------------------------------------------------------------- */
  /* 1) Auth (bloccante)                                                     */
  /* ---------------------------------------------------------------------- */
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  /* ---------------------------------------------------------------------- */
  /* 2) Param route: type                                                    */
  /* ---------------------------------------------------------------------- */
  const { type } = await ctx.params;

  /* ---------------------------------------------------------------------- */
  /* 3) Validazione type: deve esistere nel registry                          */
  /* ---------------------------------------------------------------------- */
  // Nota: teniamo def se serve per eventuali whitelist (ruoli, fields, ecc.)
  let def: any;
  try {
    def = getAnagraficaDef(type as any);
  } catch {
    return NextResponse.json({ message: "Unknown type" }, { status: 404 });
  }

  /* ---------------------------------------------------------------------- */
  /* 4) Permission check (create su quello slug)                              */
  /* ---------------------------------------------------------------------- */
  // Regola: VIEW ≠ EDIT/DELETE/CREATE → il permesso è esplicito a livello API.
  if (!hasPermission(auth, "anagrafica.create", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  /* ---------------------------------------------------------------------- */
  /* 5) Parse body                                                           */
  /* ---------------------------------------------------------------------- */
  // .json() può throware: in quel caso trattiamo come body vuoto (400 opzionale).
  const body = await req.json().catch(() => ({}));

  // payload principale: blob "data" (Mixed)
  // Il casting serio avviene nella mutation (builders/data.ts) via registry def.fields.
  const data = body?.data ?? {};

  /* ---------------------------------------------------------------------- */
  /* 6) Normalizza visibilità -> visibilityRoles: string[]                    */
  /* ---------------------------------------------------------------------- */
  // Supportiamo:
  // - visibilityRoles: string[] (nuovo)
  // - visibilityRole: string    (compat / singolo ruolo)
  //
  // Nota: dedup semplice per non salvare doppioni.
  const rawVisibilityRoles: string[] = Array.isArray(body?.visibilityRoles)
    ? body.visibilityRoles
      .filter((x: any) => typeof x === "string")
      .map((x: string) => x.trim())
      .filter(Boolean)
    : typeof body?.visibilityRole === "string" && body.visibilityRole.trim() !== ""
      ? [body.visibilityRole.trim()]
      : [];

  const visibilityRoles = Array.from(new Set(rawVisibilityRoles));

  // (opzionale) whitelist dei ruoli ammessi dal def
  // Abilitala SOLO se hai una lista chiara dove leggere i ruoli consentiti.
  //
  // const allowed = new Set(def?.acl?.visibilityRoles ?? []);
  // const visibilityRoles = Array.from(new Set(rawVisibilityRoles)).filter((r) => allowed.has(r));

  /* ---------------------------------------------------------------------- */
  /* 7) Create (mutation nuova)                                              */
  /* ---------------------------------------------------------------------- */
  // La mutation:
  // - normalizza input (builders/input.ts)
  // - cast data in modo config-driven (builders/data.ts)
  // - aggiunge audit create fields (builders/audit.ts)
  // - scrive su DB (writers/create.ts)
  // - ritorna tipicamente { id }
  const created = await createAnagrafica({
    type,
    userId: auth.userId,
    data,
    visibilityRoles,
  });

  /* ---------------------------------------------------------------------- */
  /* 8) Auto-actions post-save                                               */
  /* ---------------------------------------------------------------------- */
  // Engine business opzionale: triggera azioni config-driven dopo il salvataggio.
  // Nota: se serve usare "created full" invece che il body, dovresti:
  // - far tornare dalla mutation un doc mappato (AnagraficaFull)
  // - oppure fare una read by id qui (se serve davvero).
  await runAnagraficaAutoActionsOnSave({
    anagraficaType: type as AnagraficaTypeSlug,
    anagraficaId: created.id,
    userId: auth.userId,
    data,
  });

  /* ---------------------------------------------------------------------- */
  /* 9) Response                                                             */
  /* ---------------------------------------------------------------------- */
  return NextResponse.json({ id: created.id }, { status: 201 });
}
