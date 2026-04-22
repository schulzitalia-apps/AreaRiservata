import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { getMapsRuntimeConfig } from "@/server-utils/service/Maps";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const config = getMapsRuntimeConfig();

  return NextResponse.json({
    provider: config.provider,
    enabled: config.enabled,
    publicToken: config.publicToken,
    staticStyle: config.staticStyle ?? null,
    defaultCenter: config.defaultCenter ?? null,
  });
}
