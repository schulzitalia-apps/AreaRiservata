import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { getSpeseAnalytics } from "@/server-utils/service/speseAnalytics";

export const runtime = "nodejs";

// GET /api/anagrafiche/spese/analytics?monthsBack=24
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const { auth } = authResult;

  // permesso minimo coerente con lettura anagrafiche "spese"
  if (!hasPermission(auth, "anagrafica.view", { resourceType: "spese" })) {
    console.warn("[spese/analytics] Forbidden", {
      userId: String((auth as any)?.user?._id ?? (auth as any)?.user?.id ?? "n/a"),
      resourceType: "spese",
    });
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const monthsBackRaw = Number(searchParams.get("monthsBack") || 24);
  const monthsBack =
    Number.isFinite(monthsBackRaw) && monthsBackRaw > 0
      ? Math.min(monthsBackRaw, 60)
      : 24;


  try {
    const data = await getSpeseAnalytics({ auth, monthsBack });



    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error("[spese/analytics] ERROR", {
      message: e?.message ?? "INTERNAL_ERROR",
      stack: e?.stack,
    });

    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
