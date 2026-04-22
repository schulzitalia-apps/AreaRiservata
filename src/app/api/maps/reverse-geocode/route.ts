import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { reverseGeocode } from "@/server-utils/service/Maps";

export const runtime = "nodejs";

function parseCoordinate(raw: string | null) {
  if (!raw) return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const { searchParams } = new URL(req.url);
  const lat = parseCoordinate(searchParams.get("lat"));
  const lng = parseCoordinate(searchParams.get("lng"));

  if (lat === null || lng === null) {
    return NextResponse.json({ message: "Missing or invalid lat/lng" }, { status: 400 });
  }

  const country = String(searchParams.get("country") ?? "").trim() || undefined;
  const language = String(searchParams.get("language") ?? "").trim() || undefined;

  try {
    const item = await reverseGeocode({
      geoPoint: { lat, lng },
      country,
      language,
    });
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Errore reverse geocoding Mapbox" },
      { status: 502 },
    );
  }
}
