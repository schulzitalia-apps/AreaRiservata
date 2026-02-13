import { NextRequest, NextResponse } from "next/server";
import { listAllBarcodes, createBarcode } from "@/server-utils/service/barcodeQuery";
import { getBarcodeActionConfig } from "@/config/barcode.config";

export const runtime = "nodejs";

// 1) LISTA TUTTO
// GET /api/barcodes
export async function GET() {
  const items = await listAllBarcodes();

  // arricchisco con label dalla config (senza rompere nulla)
  const enriched = (items ?? []).map((it: any) => {
    const actionId = String(it?.action || "").trim();
    const cfg = actionId ? getBarcodeActionConfig(actionId) : null;

    return {
      ...it,
      actionId,                 // alias comodo
      actionLabel: cfg?.label ?? null,
    };
  });

  return NextResponse.json(enriched);
}

// 2) CREA NUOVO COLLEGAMENTO
// POST /api/barcodes
// body: { userId: string; actionId: string }   (accetto anche {action} per retrocompatibilità)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const userId = String(body?.userId || "").trim();

  // retrocompat: se arriva "action" lo tratto come actionId
  const actionId = String(body?.actionId ?? body?.action ?? "").trim();

  if (!userId || !actionId) {
    return NextResponse.json(
      { message: "userId e actionId sono obbligatori" },
      { status: 400 },
    );
  }

  // validate actionId against config
  const cfg = getBarcodeActionConfig(actionId);
  if (!cfg) {
    return NextResponse.json(
      { message: `actionId non valido: ${actionId}` },
      { status: 400 },
    );
  }

  const created = await createBarcode({ userId, action: actionId });

  return NextResponse.json(
    {
      ...created,
      actionId,
      actionLabel: cfg.label,
    },
    { status: 201 },
  );
}
