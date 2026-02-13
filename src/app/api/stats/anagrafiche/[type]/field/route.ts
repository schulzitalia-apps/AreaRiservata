import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { getAnagraficaFieldStats } from "@/server-utils/service/anagraficaStatsQuery";

export const runtime = "nodejs";

/**
 * POST /api/stats/anagrafiche/:type/field
 * Body:
 *  {
 *    "fieldKey": "statoAvanzamento",
 *    "pivot": "Taglio" | "2026-01-01" | 123
 *  }
 *
 * Il kind NON viene passato: viene dedotto dal registry del tipo.
 * ACL: sempre visibile all'utente (buildMongoAccessFilter)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  const { type } = await ctx.params;

  // stesso permesso della list: view
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const fieldKey =
    typeof body?.fieldKey === "string" ? body.fieldKey.trim() : "";

  if (!fieldKey) {
    return NextResponse.json(
      { message: "fieldKey is required" },
      { status: 400 },
    );
  }

  const pivot = body?.pivot;

  try {
    const stats = await getAnagraficaFieldStats({
      type,
      fieldKey,
      pivot,
      auth,
    });

    return NextResponse.json(stats);
  } catch (e: any) {
    const msg = String(e?.message || "ERROR");

    // errori “buoni” (client-side)
    if (
      msg === "FIELD_NOT_FOUND" ||
      msg === "FIELD_KIND_NOT_SUPPORTED" ||
      msg === "PIVOT_INVALID_DATE" ||
      msg === "PIVOT_INVALID_NUMBER"
    ) {
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    // fallback server
    console.error("stats field error:", e);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 },
    );
  }
}
