// src/app/api/barcodes/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { getActionByUserId } from "@/server-utils/service/barcodeQuery";
import { getBarcodeActionConfig } from "@/config/barcode.config";

export const runtime = "nodejs";

function extractFromBarcode(
  barcode: string,
  ex: { kind: "slice"; start: number; len: number } | { kind: "regex"; pattern: string; group?: number },
): string {
  if (ex.kind === "slice") return barcode.slice(ex.start, ex.start + ex.len);

  const re = new RegExp(ex.pattern);
  const m = barcode.match(re);
  if (!m) return "";
  const idx = ex.group ?? 1;
  return String(m[idx] ?? "");
}

type ReportItem = { id: string; displayName?: string; subtitle?: string | null };

// helper per fetch interno mantenendo cookie/sessione
async function internalFetch(req: NextRequest, url: string, init?: RequestInit) {
  const cookie = req.headers.get("cookie") ?? "";
  const headers = new Headers(init?.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  return fetch(url, { ...init, headers });
}

/**
 * POST /api/barcodes/execute
 * body: { barcode: string }
 *
 * Usa API esistenti:
 * - GET  /api/anagrafiche/:type?query=...
 * - GET  /api/anagrafiche/:type/:id
 * - PATCH /api/anagrafiche/:type/:id
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const token = auth.token;
  const userId = (token as any)?.id ?? (token as any)?.sub;
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const barcode = String(body?.barcode || "").trim();
  if (!barcode) {
    return NextResponse.json({ message: "barcode obbligatorio" }, { status: 400 });
  }

  const actionIdRaw = await getActionByUserId(userId);
  const actionId = actionIdRaw ? String(actionIdRaw).trim() : "";
  if (!actionId) {
    return NextResponse.json({ message: "Nessuna azione barcode associata all'utente" }, { status: 404 });
  }

  const cfg = getBarcodeActionConfig(actionId);
  if (!cfg) {
    return NextResponse.json({ message: `Azione barcode non valida in config: ${actionId}` }, { status: 400 });
  }

  // read-only
  if (cfg.action.kind === "read_only") {
    return NextResponse.json({ ok: true, actionId, skipped: true });
  }

  // update anagrafica
  const targetType = cfg.action.targetType;
  const matchField = cfg.action.matchField;
  const extractedValue = extractFromBarcode(barcode, cfg.action.extractedFromBarcode).trim();

  if (!extractedValue) {
    return NextResponse.json(
      { message: "Valore estratto dal barcode vuoto", actionId, targetType },
      { status: 400 },
    );
  }

  const origin = req.nextUrl.origin;

  // 1) leggo il "report" (lista) come fai già nel client: /api/anagrafiche/:type?query=...
  const reportUrl =
    `${origin}/api/anagrafiche/${encodeURIComponent(targetType)}` +
    `?query=${encodeURIComponent(extractedValue)}` +
    `&page=1&pageSize=50`;

  const reportRes = await internalFetch(req, reportUrl, { method: "GET" });
  if (!reportRes.ok) {
    const j = await reportRes.json().catch(() => null);
    return NextResponse.json(
      { message: j?.message || "Errore lettura report anagrafiche", status: reportRes.status },
      { status: 500 },
    );
  }

  const reportJson = await reportRes.json().catch(() => ({}));
  const items = (reportJson.items || reportJson || []) as ReportItem[];

  if (!items.length) {
    return NextResponse.json(
      { message: "Nessun record trovato nel report", targetType, query: extractedValue },
      { status: 404 },
    );
  }

  // 2) prendo il record giusto verificando data[matchField] === extractedValue
  let targetId: string | null = null;
  let targetPreview: any = null;

  for (const it of items) {
    if (!it?.id) continue;

    const detailUrl =
      `${origin}/api/anagrafiche/${encodeURIComponent(targetType)}/${encodeURIComponent(it.id)}`;

    const detailRes = await internalFetch(req, detailUrl, { method: "GET" });
    if (!detailRes.ok) continue;

    const detail = await detailRes.json().catch(() => null);
    const data = (detail as any)?.data ?? {};
    const current = String(data?.[matchField] ?? "").trim();

    if (current === extractedValue) {
      targetId = it.id;
      targetPreview = { id: it.id, displayName: it.displayName ?? null, subtitle: it.subtitle ?? null };
      break;
    }
  }

  // fallback: se non ho match perfetto, uso il primo del report
  if (!targetId) {
    targetId = items[0].id;
    targetPreview = { id: items[0].id, displayName: items[0].displayName ?? null, subtitle: items[0].subtitle ?? null };
  }

  if (!targetId) {
    return NextResponse.json({ message: "Impossibile risolvere targetId" }, { status: 500 });
  }

  // 3) PATCH usando LA TUA route (condizioni + auto-actions) ✅
  const patchUrl =
    `${origin}/api/anagrafiche/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`;

  const patchRes = await internalFetch(req, patchUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { [cfg.action.setField]: cfg.action.setValue },
    }),
  });

  if (!patchRes.ok) {
    const j = await patchRes.json().catch(() => null);
    return NextResponse.json(
      { message: j?.message || "Errore aggiornamento anagrafica", status: patchRes.status },
      { status: 400 },
    );
  }

  const updated = await patchRes.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    actionId,
    targetType,
    match: { field: matchField, value: extractedValue },
    applied: { field: cfg.action.setField, value: cfg.action.setValue },
    target: targetPreview,
    updated,
  });
}
