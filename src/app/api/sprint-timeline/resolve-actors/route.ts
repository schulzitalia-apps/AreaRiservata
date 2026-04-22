import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { resolveActorsByNames } from "@/server-utils/service/sprintTimeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  try {
    const { names } = await req.json();
    if (!Array.isArray(names)) {
      return NextResponse.json({ message: "Invalid names" }, { status: 400 });
    }

    const actors = await resolveActorsByNames(names);
    return NextResponse.json({ actors });
  } catch (error) {
    console.error("Error resolving actors:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
