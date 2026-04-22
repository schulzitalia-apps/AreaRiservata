import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { resetAnimaSessionMemory } from "@/server-utils/anima/memory/resetSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const body = await req.json().catch(() => ({}));
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : null;

  if (!sessionId) {
    return NextResponse.json(
      { message: "sessionId is required" },
      { status: 400 },
    );
  }

  await resetAnimaSessionMemory(sessionId);

  return NextResponse.json(
    {
      ok: true,
      sessionId,
      reset: ["summary", "conversationState", "operationState", "taskState"],
    },
    { status: 200 },
  );
}
