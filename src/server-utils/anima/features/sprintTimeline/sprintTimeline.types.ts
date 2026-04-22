import type { SprintTaskPriority, SprintTimelineLane, TimelineSemaforo } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

export type SprintTimelineReadMode =
  | "active_tasks"
  | "due_tasks"
  | "priority_advice"
  | "owner_overview"
  | "delay_overview"
  | "task_breakdown";

export type SprintTimelineReadScope =
  | "company"
  | "me_owner"
  | "me_reviewer"
  | "person";

export type SprintTimelineSignalFilter =
  | "red"
  | "yellow"
  | "purple"
  | "blue"
  | "orange";

export type SprintTimelineReadQuery = {
  mode: SprintTimelineReadMode;
  scope?: SprintTimelineReadScope | null;
  personNames?: string[];
  signals?: SprintTimelineSignalFilter[];
  priority?: SprintTaskPriority | null;
  dueWithinDays?: number | null;
  taskQuery?: string | null;
  aggregateByOwner?: boolean;
};

export type SprintTimelineReadIntent = {
  type: "sprint_timeline_read";
  query: SprintTimelineReadQuery;
  explanation: string;
  debug: {
    matchedBy: string;
  };
};

export type SprintTimelineListingPresentation = {
  mode: "verbatim_list" | "summarized";
  header: string;
  listBlock: string | null;
  summaryText: string | null;
  footer: string | null;
};

export type SprintTimelineTaskSnapshot = {
  laneId: string;
  sprintId: string | null;
  sprintLabel: string | null;
  title: string;
  subtitle?: string;
  description?: string;
  objectives?: string;
  ownerName?: string;
  referenteName?: string;
  priority: SprintTaskPriority;
  signal: TimelineSemaforo;
  stateLabel: string;
  expectedEnd?: string;
  daysRemaining: number | null;
  openCheckpointCount: number;
  blockedCheckpointCount: number;
  completedCheckpointCount: number;
  totalCheckpointCount: number;
  openCheckpointTitles: string[];
  blockedCheckpointTitles: string[];
  nextPassageLabel?: string | null;
  viewerNeedsToAct: boolean;
  viewerVisibility?: SprintTimelineLane["viewerVisibility"];
  summaryReason: string;
  schedulerRank?: number;
  schedulerReason?: string;
};

export type SprintTimelineReadResult = {
  header: string;
  text: string;
  total: number;
  items: SprintTimelineTaskSnapshot[];
  presentation: SprintTimelineListingPresentation;
  distinctOwnerCount?: number;
  ownerNames?: string[];
};
