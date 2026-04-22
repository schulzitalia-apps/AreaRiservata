"use client";

import type { SprintTimelineViewer } from "./permissions";

export type TimelineSemaforo =
  | "gray"
  | "blue"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "green"
  | "teal";
export type SprintTaskPriority = "urgent" | "high" | "medium" | "low";
export type SprintTaskType =
  | "operations"
  | "delivery"
  | "support"
  | "analysis"
  | "scrum"
  | (string & {});

export type SprintTimelineZoom = "roadmap" | "month" | "sprint-focus" | "week";

export type SprintTimelineEventKind =
  | "planned-start"
  | "start"
  | "checkpoint"
  | "completion-update"
  | "block-update"
  | "expected-completion"
  | "validation"
  | "completion"
  | "task-block"
  | "reopen"
  | "note";

export type SprintQuickAddAction = "new-task";

export type SprintTimelineParticipant = {
  id: string;
  name: string;
  userIds?: string[];
  referenceType?: string;
  referenceId?: string;
};

export type SprintTimelineViewerVisibility =
  | "owned"
  | "participating"
  | "extended";

export type SprintTimelineChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
};

export type SprintTimelineValidationState = "requested" | "decided";
export type SprintTimelineValidationOutcome = "approved" | "rejected" | "pending";

export type SprintTimelineEvent = {
  id: string;
  chainId?: string;
  sourceEventId?: string;
  kind: SprintTimelineEventKind;
  title: string;
  date: string;
  dateIndex: number;
  note?: string;
  participants?: SprintTimelineParticipant[];
  checklist?: SprintTimelineChecklistItem[];
  completionDays?: number;
  viewerCanAct?: boolean;
  viewerCanValidate?: boolean;
  viewerIsParticipant?: boolean;
  viewerIsValidator?: boolean;

  validationState?: SprintTimelineValidationState;
  validationResult?: SprintTimelineValidationOutcome;
  validators?: SprintTimelineParticipant[];
  decisionLocked?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;

  createdByValidationId?: string;
  delayDays?: number;

  color?: TimelineSemaforo;
  systemCheckpointType?: "planned-start" | "expected-completion" | "taken-over";
};

export type SprintTimelineLane = {
  id: string;
  taskId: string;
  title: string;
  subtitle?: string;
  description?: string;
  objectives?: string;
  ownerName?: string;
  ownerId?: string;
  ownerUserIds?: string[];
  referenteName?: string;
  referenteId?: string;
  referenteUserIds?: string[];
  viewerCanManage?: boolean;
  viewerIsOwner?: boolean;
  /** true se il viewer è il revisore (referenteTask) del task */
  viewerIsReferente?: boolean;
  viewerIsParticipant?: boolean;
  viewerVisibility?: SprintTimelineViewerVisibility | null;
  taskType: SprintTaskType;
  priority: SprintTaskPriority;
  expectedEnd?: string;
  actualEnd?: string;
  lineEndIndex?: number;
  events: SprintTimelineEvent[];
  /** ID dello sprint di origine (solo per board aggregate) */
  sourceSprintId?: string;
  /** ID del task originale (solo per board aggregate) */
  sourceLaneId?: string;
};

export type SprintTimelineSegment = {
  id: string;
  label: string;
  description?: string;
  startIndex: number;
  endIndex: number;
  startDate?: string;
  endDate?: string;
};

export type SprintTimelineSprint = {
  id: string;
  label: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  statoAvanzamento?: string;
  valutazioneSprint?: string;
};

export type SprintTimelineBoardData = {
  sprint: SprintTimelineSprint;
  totalUnits: number;
  segments: SprintTimelineSegment[];
  lanes: SprintTimelineLane[];
};

export type SprintTimelineColumn = {
  id: string;
  centerIndex: number;
  isoDate?: string;
  labelTop: string;
  labelBottom: string;
  monthKey: string;
  monthLabel: string;
  weekKey: string;
  weekLabel: string;
};

export type SprintTimelineViewport = {
  zoom: SprintTimelineZoom;
  title: string;
  startIndex: number;
  endIndex: number;
  unitWidth: number;
  columns: SprintTimelineColumn[];
};

export type SprintTimelineSelection =
  | { kind: "lane"; laneId: string }
  | { kind: "event"; laneId: string; eventId: string }
  | null;

export type SprintTimelineMenuPayload =
  | {
  kind: "day";
  laneId: string;
  unitIndex: number;
  isoDate?: string;
}
  | {
  kind: "event";
  laneId: string;
  eventId: string;
  unitIndex: number;
  isoDate?: string;
};

export type SprintTimelineFilters = {
  query: string;
  signal: "" | TimelineSemaforo;
  taskType: string;
  ownerOnly: boolean;
  visibilityMode: "all" | "mine" | "reviewer";
};

export type SprintTimelineSegmentVisual = {
  startIndex: number;
  endIndex: number;
  tone: TimelineSemaforo;
  dashed?: boolean;
  label?: string;
  description?: string;
};

export type SprintTimelineDerivedLaneState = {
  signal: TimelineSemaforo;
  stateLabel: string;
  openCheckpointCount: number;
  blockedCheckpointCount: number;
  completedCheckpointCount: number;
  elapsedDays: number;
  daysRemaining: number | null;
  viewerNeedsToAct?: boolean;
  expectedEndIndex?: number;
};

export type SprintTimelineParticipantReference = {
  anagraficaId: string;
  anagraficaType: string;
};

export type SprintTimelineMilestoneDraft = {
  eventId?: string;
  title: string;
  unitIndex: number;
  note?: string;
  /** Partecipanti al checkpoint (strutturato: tipo + ID) */
  participants: SprintTimelineParticipantReference[];
  checklistItems: string[];
};

export type SprintTimelineCreateTaskPayload = {
  title: string;
  subtitle?: string;
  description?: string;
  objectives?: string;
  /** ID anagrafica evolver proprietario (titolareTask) – preferito */
  ownerId?: string;
  /** ID anagrafica evolver revisore (referenteTask) – preferito */
  referenteId?: string;
  /** @deprecated Usare ownerId. Mantenuto per compat. lettura dati legacy. */
  ownerName?: string;
  /** @deprecated Usare referenteId. Mantenuto per compat. lettura dati legacy. */
  referenteName?: string;
  taskType: SprintTaskType;
  priority: SprintTaskPriority;
  plannedStartIndex: number;
  expectedEndIndex: number;
  milestones: SprintTimelineMilestoneDraft[];
};

export type SprintTimelineCreateEventPayload = {
  laneId: string;
  kind: "checkpoint" | "task-block" | "note";
  title?: string;
  note?: string;
  date?: string;
  unitIndex: number;
  /** Partecipanti all'evento (strutturato: tipo + ID) */
  participants: SprintTimelineParticipantReference[];
  checklistItems: string[];
};
