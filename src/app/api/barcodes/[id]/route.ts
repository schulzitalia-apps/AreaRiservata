import { NextRequest, NextResponse } from "next/server";
import { updateBarcodeById } from "@/server-utils/service/barcodeQuery";
import { getBarcodeActionConfig } from "@/config/barcode.config";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/barcodes/:id
// body: { userId?: string; actionId?: string } (accetto anche action per retrocompat)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();

  const patch: { userId?: string; action?: string } = {};

  if (typeof body?.userId === "string") {
    patch.userId = body.userId.trim();
  }

  // retrocompat: actionId || action
  if (typeof body?.actionId === "string" || typeof body?.action === "string") {
    const actionId = String(body?.actionId ?? body?.action ?? "").trim();

    const cfg = getBarcodeActionConfig(actionId);
    if (!cfg) {
      return NextResponse.json(
        { message: `actionId non valido: ${actionId}` },
        { status: 400 },
      );
    }

    patch.action = actionId;
  }

  const updated = await updateBarcodeById({ id, patch });

  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const actionId = String((updated as any)?.action || "").trim();
  const cfg = actionId ? getBarcodeActionConfig(actionId) : null;

  return NextResponse.json({
    ...updated,
    actionId: actionId || null,
    actionLabel: cfg?.label ?? null,
  });
}
