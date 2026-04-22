import type { SprintTimelineBoardData } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

export const sprintTimelineService = {
  async getBoard(args: { sprintId: string }): Promise<SprintTimelineBoardData> {
    const res = await fetch(`/api/sprint-timeline/${args.sprintId}`, {
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    return json.board as SprintTimelineBoardData;
  },

  async getAggregateBoard(): Promise<{
    aggregateBoard: SprintTimelineBoardData | null;
    items: { sprintId: string; board: SprintTimelineBoardData }[];
    failures: { sprintId: string; error: string }[];
  }> {
    const res = await fetch("/api/sprint-timeline/aggregate", {
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json();
  },
};
