import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { forwardGeocode } from "@/server-utils/service/Maps";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const { searchParams } = new URL(req.url);
  const query = String(searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json({ message: "Missing query" }, { status: 400 });
  }

  const limitRaw = Number(searchParams.get("limit") ?? 5);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 5;
  const country = String(searchParams.get("country") ?? "").trim() || undefined;
  const language = String(searchParams.get("language") ?? "").trim() || undefined;

  try {
    const items = await forwardGeocode({ query, limit, country, language });
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Errore geocoding Mapbox" },
      { status: 502 },
    );
  }
}
