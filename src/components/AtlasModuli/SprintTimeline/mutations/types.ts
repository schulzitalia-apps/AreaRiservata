import type {
  SprintTimelineBoardData,
  SprintTimelineCreateEventPayload,
  SprintTimelineCreateTaskPayload,
  SprintTimelineParticipantReference,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

export type SprintTimelineRemoteBoardResult = {
  sprintId: string;
  board: SprintTimelineBoardData;
};

export type SprintTimelineCreateSprintArgs = {
  payload: {
    label: string;
    description?: string;
    startDate: string;
    endDate: string;
  };
};

export type SprintTimelineCreateQuickTaskArgs = {
  sprintId: string;
  payload: {
    title: string;
    description?: string;
  };
};

export type SprintTimelineCreateTaskArgs = {
  sprintId: string;
  payload: SprintTimelineCreateTaskPayload;
  baseStartDate?: string;
};

export type SprintTimelinePromoteTaskArgs = {
  sprintId: string;
  laneId: string;
  payload: SprintTimelineCreateTaskPayload;
  baseStartDate?: string;
};

export type SprintTimelineCreateEventArgs = {
  sprintId: string;
  payload: SprintTimelineCreateEventPayload;
};

export type SprintTimelineDeleteEventArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
};

export type SprintTimelineStartTaskArgs = {
  sprintId: string;
  laneId: string;
  sourceEventId: string;
  currentUserName?: string;
};

export type SprintTimelineToggleChecklistArgs = {
  sprintId: string;
  eventId: string;
  itemId: string;
  checked: boolean;
  currentUserName?: string;
};

export type SprintTimelineCompleteCheckpointArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  currentUserName?: string;
};

export type SprintTimelineBlockCheckpointArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  currentUserName?: string;
  note?: string;
  participants?: SprintTimelineParticipantReference[];
  checklistItems?: string[];
};

export type SprintTimelineResolveCheckpointBlockArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  currentUserName?: string;
};

export type SprintTimelineConfigureValidationArgs = {
  sprintId: string;
  eventId: string;
  validators: SprintTimelineParticipantReference[];
  note?: string;
};

export type SprintTimelineDecideValidationArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  outcome: "approved" | "rejected";
  decisionNote: string;
  currentUserName?: string;
};

export type SprintTimelineResolveTaskBlockArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  currentUserName?: string;
};

export type SprintTimelineManualReopenTaskArgs = {
  sprintId: string;
  laneId: string;
  currentUserName?: string;
};

export type SprintTimelineUpdateTaskArgs = {
  sprintId: string;
  laneId: string;
  payload: SprintTimelineCreateTaskPayload;
};

export type SprintTimelineDeleteTaskArgs = {
  sprintId: string;
  laneId: string;
};

export type SprintTimelineCompleteAndRequestValidationArgs = {
  sprintId: string;
  laneId: string;
  eventId: string;
  validators: SprintTimelineParticipantReference[];
  note?: string;
  currentUserName?: string;
};

export type SprintTimelineCompleteCheckpointAndRequestValidationArgs =
  SprintTimelineCompleteAndRequestValidationArgs;
