import { NextResponse } from "next/server";
import { getActionByUserId } from "@/server-utils/service/barcodeQuery";
import { getBarcodeActionConfig } from "@/config/barcode.config";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ userId: string }> };

// GET /api/barcodes/action-by-user/:userId
export async function GET(_: Request, ctx: Ctx) {
  const { userId } = await ctx.params;

  // Questo oggi ritorna string|null. Da ora quella string è actionId.
  const actionId = await getActionByUserId(userId);

  const cfg = actionId ? getBarcodeActionConfig(String(actionId)) : null;

  return NextResponse.json({
    userId,
    actionId: actionId ? String(actionId) : null,
    actionLabel: cfg?.label ?? null,
  });
}
