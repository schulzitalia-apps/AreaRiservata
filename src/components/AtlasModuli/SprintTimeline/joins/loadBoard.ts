"use client";

import type {
  SprintTimelineBoardData,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { sprintTimelineService } from "@/components/Store/services/sprintTimelineService";

export async function loadSingleSprintBoard(
  sprintId: string,
): Promise<SprintTimelineBoardData> {
  return sprintTimelineService.getBoard({ sprintId });
}
