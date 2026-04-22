import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { loadAggregateSprintTimelineBoard } from "@/server-utils/service/sprintTimeline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

  const result = await loadAggregateSprintTimelineBoard({ auth });
  return NextResponse.json(result);
}
