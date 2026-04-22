import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { loadSprintTimelineBoard } from "@/server-utils/service/sprintTimeline";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sprintId: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;
  const { auth } = authResult;

  const canViewSprint = hasPermission(auth, "aula.view", {
    resourceType: "sprint",
  });
  const canViewTask = hasPermission(auth, "anagrafica.view", {
    resourceType: "task",
  });
  const canViewTimelineEvent = hasPermission(auth, "evento.view", {
    resourceType: "avanzamento-task",
  });

  if (!canViewSprint || !canViewTask || !canViewTimelineEvent) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { sprintId } = await ctx.params;

  try {
    const board = await loadSprintTimelineBoard({
      sprintId,
      auth,
    });

    return NextResponse.json({ board });
  } catch (error: any) {
    if (error instanceof Error && error.message === "SPRINT_NOT_FOUND") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    throw error;
  }
}
