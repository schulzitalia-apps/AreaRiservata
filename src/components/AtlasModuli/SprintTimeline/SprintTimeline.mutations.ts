"use client";

import {
  getCheckpointChainStatus,
  getCurrentCycleCheckpointBases,
  getEventChainId,
  getIsoDateForUnitIndex,
  getLaneChainEvents,
  getLatestValidationEvent,
  getValidationRequestIndex,
   getEventTitle,
   isCheckpointReadyForCompletion,
   sortEvents,
 } from "./SprintTimeline.helpers";
import type {
  SprintTimelineBoardData,
  SprintTimelineCreateEventPayload,
  SprintTimelineCreateTaskPayload,
  SprintTimelineEvent,
  SprintTimelineLane,
  SprintTimelineParticipant,
  SprintTimelineParticipantReference,
  SprintTimelineValidationOutcome,
} from "./SprintTimeline.types";

import {
  blockSprintTimelineCheckpoint,
  completeSprintTimelineCheckpoint,
  configureSprintTimelineValidation,
  createSprintTimelineEvent,
  createSprintTimelineQuickTask,
  createSprintTimelineSprint,
  createSprintTimelineTask,
  decideSprintTimelineValidation,
  deleteSprintTimelineEvent,
  deleteSprintTimelineTask,
  manualReopenSprintTimelineTask,
  promoteSprintTimelineTask,
  resolveSprintTimelineCheckpointBlock,
  resolveSprintTimelineTaskBlock,
  startSprintTimelineTask,
  toggleSprintTimelineChecklistItem,
  updateSprintTimelineTask,
  completeCheckpointAndRequestValidationThunk,
} from "@/components/Store/slices/sprintTimelineSlice";

type SprintTimelineDispatch = (action: any) => Promise<unknown> | unknown;

export type SprintTimelineMutationResult =
  | SprintTimelineBoardData
  | {
  __remoteMutation: true;
  run: () => Promise<void>;
};

export function isSprintTimelineRemoteMutation(
  value: SprintTimelineMutationResult,
): value is Extract<SprintTimelineMutationResult, { __remoteMutation: true }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__remoteMutation" in value &&
    value.__remoteMutation === true
  );
}

function remoteMutation(run: () => Promise<void>): SprintTimelineMutationResult {
  return {
    __remoteMutation: true,
    run,
  };
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEventDate(
  startDate: string | undefined,
  unitIndex: number,
  time = "09:00:00",
) {
  const isoDay = getIsoDateForUnitIndex(startDate, unitIndex);
  return isoDay ? `${isoDay}T${time}` : "";
}

function createParticipants(
  refs: SprintTimelineParticipantReference[],
): SprintTimelineParticipant[] {
  return (refs ?? []).map((ref) => ({
    id: ref.anagraficaId,
    name: ref.anagraficaId, // Fallback, verrà risolto dal server
    userIds: [],
  }));
}

function createChecklist(labels: string[]) {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({ id: makeId("c"), label, done: false }));
}

function mapLane(
  data: SprintTimelineBoardData,
  laneId: string,
  updater: (lane: SprintTimelineLane) => SprintTimelineLane,
): SprintTimelineBoardData {
  return {
    ...data,
    lanes: data.lanes.map((lane) => (lane.id === laneId ? updater(lane) : lane)),
  };
}

function buildDefaultTitle(kind: SprintTimelineCreateEventPayload["kind"]) {
  switch (kind) {
    case "checkpoint":
      return "Nuovo checkpoint";
    case "task-block":
      return "Task bloccato";
    case "note":
    default:
      return "Nota operativa";
  }
}

function getAllCheckpointChainIds(lane: SprintTimelineLane) {
  return Array.from(
    new Set(
      getCurrentCycleCheckpointBases(lane)
        .filter((event) => event.kind === "checkpoint")
        .map((event) => getEventChainId(event))
        .filter(Boolean),
    ),
  );
}

function maybeAppendValidationEventLocal(
  lane: SprintTimelineLane,
  sprintStartDate: string | undefined,
  todayIndex: number,
) {
  const chainIds = getAllCheckpointChainIds(lane);
  if (!chainIds.length) return lane;

  const allClosed = chainIds.every(
    (chainId) => getCheckpointChainStatus(lane, chainId) === "completed",
  );
  if (!allClosed) return lane;

  const latestValidation = getLatestValidationEvent(lane);
  if (latestValidation?.validationState === "requested") return lane;
  if (latestValidation?.validationState === "decided") return lane;

  const unitIndex = getValidationRequestIndex(lane, todayIndex);

  const validationEvent: SprintTimelineEvent = {
    id: makeId("evt"),
    chainId: makeId("validation"),
    kind: "validation",
    title: "Richiesta validazione",
    dateIndex: unitIndex,
    date: buildEventDate(sprintStartDate, unitIndex, "18:30:00"),
    note: "",
    validationState: "requested",
    validationResult: "pending",
    decisionLocked: false,
    validators: [],
  };

  return {
    ...lane,
    events: sortEvents([...lane.events, validationEvent]),
  };
}

function createBacklogTaskOnBoardLocal(
  data: SprintTimelineBoardData,
  payload: {
    title: string;
    description?: string;
  },
): SprintTimelineBoardData {
  const lane: SprintTimelineLane = {
    id: makeId("lane"),
    taskId: makeId("task"),
    title: payload.title.trim(),
    subtitle: "",
    description: payload.description?.trim() || "",
    objectives: "",
    ownerName: "",
    taskType: "operations",
    priority: "medium",
    expectedEnd: "",
    lineEndIndex: 0,
    events: [],
  };

  return {
    ...data,
    lanes: [lane, ...data.lanes],
  };
}

function createSprintOnBoardLocal(
  data: SprintTimelineBoardData,
  payload: {
    label: string;
    description?: string;
    startDate: string;
    endDate: string;
  },
): SprintTimelineBoardData {
  const boardStart = data.sprint.startDate?.slice(0, 10);
  if (!boardStart) return data;

  const boardStartDate = new Date(`${boardStart}T00:00:00`);
  const startDate = new Date(`${payload.startDate}T00:00:00`);
  const endDate = new Date(`${payload.endDate}T00:00:00`);

  const startIndex = Math.floor(
    (startDate.getTime() - boardStartDate.getTime()) / 86400000,
  );
  const endIndex =
    Math.floor((endDate.getTime() - boardStartDate.getTime()) / 86400000) + 1;

  const nextSegment = {
    id: makeId("segment"),
    label: payload.label.trim(),
    description: payload.description?.trim() || "",
    startIndex,
    endIndex,
    startDate: `${payload.startDate}T00:00:00.000Z`,
    endDate: `${payload.endDate}T23:59:00.000Z`,
  };

  const nextSegments = [...data.segments, nextSegment].sort(
    (a, b) => a.startIndex - b.startIndex,
  );

  const nextTotalUnits = Math.max(data.totalUnits, endIndex);

  return {
    ...data,
    totalUnits: nextTotalUnits,
    segments: nextSegments,
  };
}

function createTaskOnBoardLocal(
  data: SprintTimelineBoardData,
  payload: SprintTimelineCreateTaskPayload,
): SprintTimelineBoardData {
  const laneId = makeId("lane");
  const taskId = makeId("task");

  const chainMilestones = payload.milestones.map((milestone) => ({
    id: makeId("evt"),
    chainId: makeId("chain"),
    kind: "checkpoint" as const,
    title: milestone.title,
    dateIndex: milestone.unitIndex,
    date: buildEventDate(
      data.sprint.startDate?.slice(0, 10),
      milestone.unitIndex,
      "10:00:00",
    ),
    note: milestone.note,
    participants: createParticipants(milestone.participants),
    checklist: createChecklist(milestone.checklistItems),
  }));

  const plannedDate = getIsoDateForUnitIndex(
    data.sprint.startDate?.slice(0, 10),
    payload.plannedStartIndex,
  );
  const expectedEndDate = getIsoDateForUnitIndex(
    data.sprint.startDate?.slice(0, 10),
    payload.expectedEndIndex,
  );

  const baseEvents: SprintTimelineEvent[] = [
    {
      id: makeId("evt"),
      kind: "planned-start",
      systemCheckpointType: "planned-start",
      color: "gray",
      title: getEventTitle(payload.title, "planned-start"),
      dateIndex: payload.plannedStartIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        payload.plannedStartIndex,
        "09:00:00",
      ),
      note: "Checkpoint automatico di sistema: avvio atteso del task.",
    },
    {
      id: makeId("evt"),
      kind: "expected-completion",
      systemCheckpointType: "expected-completion",
      color: "orange",
      title: getEventTitle(payload.title, "expected-completion"),
      dateIndex: payload.expectedEndIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        payload.expectedEndIndex,
        "18:00:00",
      ),
      note: "Checkpoint automatico di sistema: target atteso di chiusura del task.",
    },
    ...chainMilestones,
  ];

  const lane: SprintTimelineLane = {
    id: laneId,
    taskId,
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim(),
    description: payload.description?.trim(),
    objectives: payload.objectives?.trim(),
    ownerName: payload.ownerName?.trim(),
    taskType: payload.taskType,
    priority: payload.priority,
    expectedEnd: expectedEndDate || plannedDate,
    lineEndIndex: payload.expectedEndIndex,
    events: sortEvents(baseEvents),
  };

  return {
    ...data,
    lanes: [...data.lanes, lane],
  };
}

function promoteBacklogTaskToSprintLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  payload: SprintTimelineCreateTaskPayload,
): SprintTimelineBoardData {
  const sourceLane = data.lanes.find((lane) => lane.id === laneId);
  if (!sourceLane) return data;

  const dataWithoutBacklogLane: SprintTimelineBoardData = {
    ...data,
    lanes: data.lanes.filter((lane) => lane.id !== laneId),
  };

  return createTaskOnBoardLocal(dataWithoutBacklogLane, {
    ...payload,
    title: payload.title?.trim() || sourceLane.title,
    subtitle: payload.subtitle?.trim() || sourceLane.subtitle || "",
    description: payload.description?.trim() || sourceLane.description || "",
    objectives: payload.objectives?.trim() || sourceLane.objectives || "",
    ownerName: payload.ownerName?.trim() || sourceLane.ownerName || "",
    taskType: payload.taskType || sourceLane.taskType || "operations",
    priority: payload.priority || sourceLane.priority || "medium",
  });
}

function createEventOnLaneLocal(
  data: SprintTimelineBoardData,
  payload: SprintTimelineCreateEventPayload,
): SprintTimelineBoardData {
  return mapLane(data, payload.laneId, (lane) => {
    const event: SprintTimelineEvent = {
      id: makeId("evt"),
      kind: payload.kind,
      title: getEventTitle(lane.title, payload.kind, payload.title),
      dateIndex: payload.unitIndex,
      date: payload.date || buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        payload.unitIndex,
        payload.kind === "task-block" ? "11:00:00" : "10:00:00",
      ),
      note: payload.note?.trim() || undefined,
      participants:
        payload.kind === "checkpoint" || payload.kind === "task-block"
          ? createParticipants(payload.participants)
          : undefined,
      checklist:
        payload.kind === "checkpoint" || payload.kind === "task-block"
          ? createChecklist(payload.checklistItems)
          : undefined,
      chainId: payload.kind === "checkpoint" ? makeId("chain") : undefined,
    };

    const nextLane: SprintTimelineLane = {
      ...lane,
      events: sortEvents([...lane.events, event]),
    };

    return nextLane;
  });
}

function deleteEventFromLaneLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  eventId: string,
): SprintTimelineBoardData {
  return mapLane(data, laneId, (lane) => {
    const removedEvent = lane.events.find((event) => event.id === eventId);
    const removedChainId =
      removedEvent?.kind === "checkpoint" ? getEventChainId(removedEvent) : "";
    const events = lane.events.filter((event) => {
      if (removedEvent?.kind === "checkpoint" && removedChainId) {
        return getEventChainId(event) !== removedChainId;
      }
      return event.id !== eventId;
    });

    const latestCompletion = sortEvents(events)
      .filter((event) => event.kind === "completion")
      .slice(-1)[0];

    const latestExpected = sortEvents(events)
      .filter((event) => event.kind === "expected-completion" || event.systemCheckpointType === "expected-completion")
      .slice(-1)[0];

    return {
      ...lane,
      actualEnd:
        removedEvent?.kind === "completion"
          ? latestCompletion?.date?.slice(0, 10) || undefined
          : latestCompletion?.date?.slice(0, 10) || lane.actualEnd,
      expectedEnd:
        removedEvent?.kind === "expected-completion" || removedEvent?.systemCheckpointType === "expected-completion"
          ? latestExpected?.date?.slice(0, 10) || undefined
          : latestExpected?.date?.slice(0, 10) || lane.expectedEnd,
      lineEndIndex:
        latestCompletion?.dateIndex ??
        latestExpected?.dateIndex ??
        lane.lineEndIndex,
      events,
    };
  });
}

function startTaskOnLaneLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  sourceEventId: string,
  todayIndex: number,
  currentUserName?: string,
): SprintTimelineBoardData {
  return mapLane(data, laneId, (lane) => {
    const sourceEvent = lane.events.find(
      (event) => event.id === sourceEventId && (event.kind === "planned-start" || event.systemCheckpointType === "planned-start"),
    );
    if (!sourceEvent) return lane;

    const hasStart = lane.events.some((event) => event.kind === "start");
    if (hasStart) return lane;

    const startEvent: SprintTimelineEvent = {
      id: makeId("evt"),
      kind: "start",
      sourceEventId: sourceEvent.id,
      title: getEventTitle(lane.title, "start", "Eseguita"),
      dateIndex: todayIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        todayIndex,
        "09:30:00",
      ),
      note: currentUserName
        ? `Task avviato da ${currentUserName}.`
        : "Task avviato.",
    };

    return {
      ...lane,
      events: sortEvents([...lane.events, startEvent]),
    };
  });
}

function toggleChecklistItemLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  eventId: string,
  itemId: string,
  checked: boolean,
  currentUserName: string | undefined,
  todayIndex: number,
): SprintTimelineBoardData {
  return mapLane(data, laneId, (lane) => ({
    ...lane,
    events: lane.events.map((event) => {
      if (event.id !== eventId) return event;

      if (event.kind === "checkpoint") {
        const chainId = getEventChainId(event);
        const chainStatus = getCheckpointChainStatus(lane, chainId);
        if (chainStatus !== "open") return event;
      }

      return {
        ...event,
        checklist: event.checklist?.map((item) =>
          item.id === itemId
            ? {
              ...item,
              done: checked,
              doneBy: checked ? currentUserName || item.doneBy : undefined,
              doneAt: checked
                ? buildEventDate(
                  data.sprint.startDate?.slice(0, 10),
                  todayIndex,
                  "10:30:00",
                )
                : undefined,
            }
            : item,
        ),
      };
    }),
  }));
}

function appendChainUpdateLocal(
  data: SprintTimelineBoardData,
  args: {
    laneId: string;
    eventId: string;
    kind: "completion-update" | "block-update";
    todayIndex: number;
    currentUserName?: string;
    note?: string;
    participants?: SprintTimelineParticipantReference[];
    checklistItems?: string[];
  },
): SprintTimelineBoardData {
  return mapLane(data, args.laneId, (lane) => {
    const sourceEvent = lane.events.find((event) => event.id === args.eventId);
    if (!sourceEvent || sourceEvent.kind !== "checkpoint") return lane;

    const chainId = getEventChainId(sourceEvent);
    const currentStatus = getCheckpointChainStatus(lane, chainId);
    if (currentStatus !== "open") return lane;

    if (
      args.kind === "completion-update" &&
      !isCheckpointReadyForCompletion(sourceEvent)
    ) {
      return lane;
    }

    const completionDays = Math.max(0, args.todayIndex - sourceEvent.dateIndex);

    const newEvent: SprintTimelineEvent = {
      id: makeId("evt"),
      chainId,
      sourceEventId: sourceEvent.id,
      kind: args.kind,
      title: getEventTitle(lane.title, args.kind, args.kind === "completion-update" ? "Completato" : "Bloccato"),
      dateIndex: args.todayIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        args.todayIndex,
        args.kind === "completion-update" ? "17:30:00" : "11:00:00",
      ),
      completionDays:
        args.kind === "completion-update" ? completionDays : undefined,
      note:
        args.kind === "completion-update"
          ? `Checkpoint chiuso da ${
            args.currentUserName || "utente"
          } in ${completionDays || 0} giorni.`
          : args.note?.trim() || sourceEvent.note || "Checkpoint bloccato.",
      participants:
        args.kind === "block-update"
          ? createParticipants(args.participants ?? [])
          : undefined,
      checklist:
        args.kind === "block-update"
          ? createChecklist(args.checklistItems ?? [])
          : undefined,
    };

    const nextLane: SprintTimelineLane = {
      ...lane,
      events: sortEvents([...lane.events, newEvent]),
    };

    if (args.kind === "completion-update") {
      return maybeAppendValidationEventLocal(
        nextLane,
        data.sprint.startDate?.slice(0, 10),
        args.todayIndex,
      );
    }

    return nextLane;
  });
}

function resolveCheckpointBlockLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  eventId: string,
): SprintTimelineBoardData {
  const lane = data.lanes.find((item) => item.id === laneId);
  const blockEvent = lane?.events.find(
    (event) => event.id === eventId && event.kind === "block-update",
  );
  if (!blockEvent) return data;

  return deleteEventFromLaneLocal(data, laneId, eventId);
}

function appendLaneSystemEventLocal(
  data: SprintTimelineBoardData,
  laneId: string,
  kind: "completion" | "task-block" | "reopen",
  todayIndex: number,
  note?: string,
  participants?: SprintTimelineParticipantReference[],
  checklistItems?: string[],
): SprintTimelineBoardData {
  return mapLane(data, laneId, (lane) => {
    const event: SprintTimelineEvent = {
      id: makeId("evt"),
      kind,
      title: getEventTitle(lane.title, kind, "Eseguita"),
      dateIndex: todayIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        todayIndex,
        kind === "completion" ? "18:00:00" : "10:00:00",
      ),
      note:
        note?.trim() ||
        (kind === "completion"
          ? "Task chiuso con esito positivo."
          : kind === "task-block"
            ? "Blocco generico del task."
            : "Riapertura operativa."),
      participants:
        kind === "task-block"
          ? createParticipants(participants ?? [])
          : undefined,
      checklist:
        kind === "task-block"
          ? createChecklist(checklistItems ?? [])
          : undefined,
    };

    return {
      ...lane,
      actualEnd:
        kind === "completion"
          ? getIsoDateForUnitIndex(
            data.sprint.startDate?.slice(0, 10),
            todayIndex,
          )
          : kind === "reopen"
            ? undefined
            : lane.actualEnd,
      lineEndIndex: kind === "completion" ? todayIndex : lane.lineEndIndex,
      events: sortEvents([...lane.events, event]),
    };
  });
}

function configureValidationRequestOnLaneLocal(
  data: SprintTimelineBoardData,
  args: {
    laneId: string;
    eventId: string;
    validators: SprintTimelineParticipantReference[];
    note?: string;
  },
): SprintTimelineBoardData {
  return mapLane(data, args.laneId, (lane) => ({
    ...lane,
    events: lane.events.map((event) => {
      if (event.id !== args.eventId || event.kind !== "validation") return event;
      if (event.validationState !== "requested") return event;

      return {
        ...event,
        validators: createParticipants(args.validators),
        note: args.note?.trim() || event.note,
      };
    }),
  }));
}

function decideValidationOnLaneLocal(
  data: SprintTimelineBoardData,
  args: {
    laneId: string;
    eventId: string;
    outcome: Exclude<SprintTimelineValidationOutcome, "pending">;
    decisionNote: string;
    currentUserName?: string;
    todayIndex: number;
  },
): SprintTimelineBoardData {
  return mapLane(data, args.laneId, (lane) => {
    const validationEvent = lane.events.find(
      (event) => event.id === args.eventId && event.kind === "validation",
    );
    if (!validationEvent) return lane;
    if (validationEvent.validationState !== "requested") return lane;
    if (validationEvent.decisionLocked) return lane;

    const canDecide = (validationEvent.validators ?? []).some(
      (item) => item.name === args.currentUserName,
    );
    if (!canDecide) return lane;

    const updatedValidation: SprintTimelineEvent = {
      ...validationEvent,
      validationState: "decided",
      validationResult: args.outcome,
      decisionLocked: true,
      decidedBy: args.currentUserName,
      decidedAt: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        args.todayIndex,
        "17:00:00",
      ),
      decisionNote: args.decisionNote.trim(),
      title: getEventTitle(lane.title, "validation", args.outcome === "approved" ? "Approvata" : "Respinta"),
    };

    const withoutOriginal = lane.events.filter(
      (event) => event.id !== validationEvent.id,
    );

    const expectedCompletion = sortEvents(lane.events)
      .filter((event) => event.kind === "expected-completion" || event.systemCheckpointType === "expected-completion")
      .slice(-1)[0];

    const outcomeDayIndex = args.todayIndex;
    const delayDays =
      expectedCompletion && outcomeDayIndex > expectedCompletion.dateIndex
        ? outcomeDayIndex - expectedCompletion.dateIndex
        : 0;

    const autoOutcomeEvent: SprintTimelineEvent = {
      id: makeId("evt"),
      chainId: validationEvent.chainId || validationEvent.id,
      createdByValidationId: validationEvent.id,
      kind: args.outcome === "approved" ? "completion" : "reopen",
      title: getEventTitle(lane.title, args.outcome === "approved" ? "completion" : "reopen", "Eseguita"),
      dateIndex: outcomeDayIndex,
      date: buildEventDate(
        data.sprint.startDate?.slice(0, 10),
        outcomeDayIndex,
        "19:00:00",
      ),
      note:
        args.outcome === "approved"
          ? "Esito automatico della validazione approvata."
          : "Esito automatico della validazione respinta.",
      delayDays,
    };

    return {
      ...lane,
      actualEnd:
        args.outcome === "approved"
          ? getIsoDateForUnitIndex(
            data.sprint.startDate?.slice(0, 10),
            outcomeDayIndex,
          )
          : undefined,
      lineEndIndex:
        args.outcome === "approved" ? outcomeDayIndex : lane.lineEndIndex,
      events: sortEvents([...withoutOriginal, updatedValidation, autoOutcomeEvent]),
    };
  });
}

export function createSprintTimelineMutationBridge(args: {
  sprintId?: string;
  dispatch?: SprintTimelineDispatch;
  currentUserName?: string;
  todayIndex: number;
  onCreateSprint?: (payload: {
    label: string;
    description?: string;
    startDate: string;
    endDate: string;
  }) => Promise<unknown> | unknown;
  baseStartDate?: string;
}) {
  const { sprintId, dispatch, currentUserName, todayIndex, onCreateSprint, baseStartDate } = args;
  const canPersist = !!dispatch && !!sprintId;

  async function run(action: any) {
    await Promise.resolve(dispatch?.(action));
  }

  return {
    createBacklogTaskOnBoard(
      data: SprintTimelineBoardData,
      payload: {
        title: string;
        description?: string;
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return createBacklogTaskOnBoardLocal(data, payload);
      }

      return remoteMutation(async () => {
        await run(
          createSprintTimelineQuickTask({
            sprintId: sprintId!,
            payload,
          }),
        );
      });
    },

    createSprintOnBoard(
      data: SprintTimelineBoardData,
      payload: {
        label: string;
        description?: string;
        startDate: string;
        endDate: string;
      },
    ): SprintTimelineMutationResult {
      void data;

      if (onCreateSprint) {
        return remoteMutation(async () => {
          await Promise.resolve(onCreateSprint(payload));
        });
      }

      if (!canPersist) {
        return createSprintOnBoardLocal(data, payload);
      }

      return remoteMutation(async () => {
        await run(
          createSprintTimelineSprint({
            payload,
          }),
        );
      });
    },

    createTaskOnBoard(
      data: SprintTimelineBoardData,
      payload: SprintTimelineCreateTaskPayload,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return createTaskOnBoardLocal(data, payload);
      }

      return remoteMutation(async () => {
        await run(
          createSprintTimelineTask({
            sprintId: sprintId!,
            payload,
            baseStartDate,
          }),
        );
      });
    },

    promoteBacklogTaskToSprint(
      data: SprintTimelineBoardData,
      laneId: string,
      payload: SprintTimelineCreateTaskPayload,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return promoteBacklogTaskToSprintLocal(data, laneId, payload);
      }

      return remoteMutation(async () => {
        await run(
          promoteSprintTimelineTask({
            sprintId: sprintId!,
            laneId,
            payload,
            baseStartDate,
          }),
        );
      });
    },

    createEventOnLane(
      data: SprintTimelineBoardData,
      payload: SprintTimelineCreateEventPayload,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return createEventOnLaneLocal(data, payload);
      }

      return remoteMutation(async () => {
        await run(
          createSprintTimelineEvent({
            sprintId: sprintId!,
            payload,
          }),
        );
      });
    },

    deleteEventFromLane(
      data: SprintTimelineBoardData,
      laneId: string,
      eventId: string,
    ): SprintTimelineMutationResult {
      void laneId;

      if (!canPersist) {
        return deleteEventFromLaneLocal(data, laneId, eventId);
      }

      return remoteMutation(async () => {
        await run(
          deleteSprintTimelineEvent({
            sprintId: sprintId!,
            laneId,
            eventId,
          }),
        );
      });
    },

    startTaskOnLane(
      data: SprintTimelineBoardData,
      laneId: string,
      sourceEventId: string,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return startTaskOnLaneLocal(
          data,
          laneId,
          sourceEventId,
          todayIndex,
          currentUserName,
        );
      }

      return remoteMutation(async () => {
        await run(
          startSprintTimelineTask({
            sprintId: sprintId!,
            laneId,
            sourceEventId,
            currentUserName,
          }),
        );
      });
    },

    toggleChecklistItem(
      data: SprintTimelineBoardData,
      laneId: string,
      eventId: string,
      itemId: string,
      checked: boolean,
      currentUserNameArg: string | undefined,
      todayIndexArg: number,
    ): SprintTimelineMutationResult {
      void laneId;
      void todayIndexArg;

      if (!canPersist) {
        return toggleChecklistItemLocal(
          data,
          laneId,
          eventId,
          itemId,
          checked,
          currentUserNameArg,
          todayIndexArg,
        );
      }

      return remoteMutation(async () => {
        await run(
          toggleSprintTimelineChecklistItem({
            sprintId: sprintId!,
            eventId,
            itemId,
            checked,
            currentUserName: currentUserNameArg ?? currentUserName,
          }),
        );
      });
    },

    appendChainUpdate(
      data: SprintTimelineBoardData,
      params: {
        laneId: string;
        eventId: string;
        kind: "completion-update" | "block-update";
        todayIndex: number;
        currentUserName?: string;
        note?: string;
        participants?: SprintTimelineParticipantReference[];
        checklistItems?: string[];
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return appendChainUpdateLocal(data, params);
      }

      if (params.kind === "completion-update") {
        return remoteMutation(async () => {
          await run(
            completeSprintTimelineCheckpoint({
              sprintId: sprintId!,
              laneId: params.laneId,
              eventId: params.eventId,
              currentUserName: params.currentUserName ?? currentUserName,
            }),
          );
        });
      }

      return remoteMutation(async () => {
        await run(
          blockSprintTimelineCheckpoint({
            sprintId: sprintId!,
            laneId: params.laneId,
            eventId: params.eventId,
            currentUserName: params.currentUserName ?? currentUserName,
            note: params.note,
            participants: params.participants,
            checklistItems: params.checklistItems,
          }),
        );
      });
    },

    resolveCheckpointBlock(
      data: SprintTimelineBoardData,
      laneId: string,
      eventId: string,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return resolveCheckpointBlockLocal(data, laneId, eventId);
      }

      return remoteMutation(async () => {
        await run(
          resolveSprintTimelineCheckpointBlock({
            sprintId: sprintId!,
            laneId,
            eventId,
            currentUserName,
          }),
        );
      });
    },

    resolveTaskBlock(
      data: SprintTimelineBoardData,
      laneId: string,
      eventId: string,
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return deleteEventFromLaneLocal(data, laneId, eventId);
      }

      return remoteMutation(async () => {
        await run(
          resolveSprintTimelineTaskBlock({
            sprintId: sprintId!,
            laneId,
            eventId,
            currentUserName,
          }),
        );
      });
    },

    appendLaneSystemEvent(
      data: SprintTimelineBoardData,
      laneId: string,
      kind: "completion" | "task-block" | "reopen",
      dayIndex: number,
      note?: string,
      participants?: SprintTimelineParticipantReference[],
      checklistItems?: string[],
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return appendLaneSystemEventLocal(
          data,
          laneId,
          kind,
          dayIndex,
          note,
          participants,
          checklistItems,
        );
      }

      if (kind === "task-block") {
        return remoteMutation(async () => {
          await run(
            createSprintTimelineEvent({
              sprintId: sprintId!,
              payload: {
                laneId,
                kind: "task-block",
                unitIndex: dayIndex,
                note,
                participants: participants ?? [],
                checklistItems: checklistItems ?? [],
              },
            }),
          );
        });
      }

      if (kind === "reopen") {
        return remoteMutation(async () => {
          await run(
            manualReopenSprintTimelineTask({
              sprintId: sprintId!,
              laneId,
              currentUserName,
            }),
          );
        });
      }

      return appendLaneSystemEventLocal(
        data,
        laneId,
        kind,
        dayIndex,
        note,
        participants,
        checklistItems,
      );
    },

    completeCheckpointAndRequestValidation(
      data: SprintTimelineBoardData,
      params: {
        laneId: string;
        eventId: string;
        validators: SprintTimelineParticipantReference[];
        note?: string;
        todayIndex: number;
        currentUserName?: string;
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        // Implementazione locale semplificata che concatena le due azioni
        const step1 = appendChainUpdateLocal(data, {
          laneId: params.laneId,
          eventId: params.eventId,
          kind: "completion-update",
          todayIndex: params.todayIndex,
          currentUserName: params.currentUserName ?? currentUserName,
        });
        
        // Nota: in locale è complesso trovare l'ID dell'evento appena creato senza thunk,
        // ma per ora il requisito principale è il workflow remoto che funziona correttamente.
        // Facciamo un'approssimazione funzionale per il fallback.
        return step1;
      }

      return remoteMutation(async () => {
        await run(
          completeCheckpointAndRequestValidationThunk({
            sprintId: sprintId!,
            laneId: params.laneId,
            eventId: params.eventId,
            validators: params.validators,
            note: params.note,
            currentUserName: params.currentUserName ?? currentUserName,
          })
        );
      });
    },

    configureValidationRequestOnLane(
      data: SprintTimelineBoardData,
      params: {
        laneId: string;
        eventId: string;
        validators: SprintTimelineParticipantReference[];
        note?: string;
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return configureValidationRequestOnLaneLocal(data, params);
      }

      return remoteMutation(async () => {
        await run(
          configureSprintTimelineValidation({
            sprintId: sprintId!,
            eventId: params.eventId,
            validators: params.validators,
            note: params.note,
          }),
        );
      });
    },

    configureValidation(
      data: SprintTimelineBoardData,
      params: {
        laneId: string;
        eventId: string;
        validators: SprintTimelineParticipantReference[];
        note?: string;
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return configureValidationRequestOnLaneLocal(data, params);
      }

      return remoteMutation(async () => {
        await run(
          configureSprintTimelineValidation({
            sprintId: sprintId!,
            eventId: params.eventId,
            validators: params.validators,
            note: params.note,
          }),
        );
      });
    },

    decideValidationOnLane(
      data: SprintTimelineBoardData,
      params: {
        laneId: string;
        eventId: string;
        outcome: Exclude<SprintTimelineValidationOutcome, "pending">;
        decisionNote: string;
        currentUserName?: string;
        todayIndex: number;
      },
    ): SprintTimelineMutationResult {
      if (!canPersist) {
        return decideValidationOnLaneLocal(data, params);
      }

      return remoteMutation(async () => {
        await run(
          decideSprintTimelineValidation({
            sprintId: sprintId!,
            laneId: params.laneId,
            eventId: params.eventId,
            outcome: params.outcome,
            decisionNote: params.decisionNote,
            currentUserName: params.currentUserName ?? currentUserName,
          }),
        );
      });
    },

    deleteTaskFromBoard: (laneId: string): SprintTimelineMutationResult => {
      return remoteMutation(async () => {
        await run(deleteSprintTimelineTask({ sprintId: sprintId!, laneId }));
      });
    },

    updateTaskOnBoard: (
      laneId: string,
      payload: SprintTimelineCreateTaskPayload,
    ): SprintTimelineMutationResult => {
      return remoteMutation(async () => {
        await run(updateSprintTimelineTask({ sprintId: sprintId!, laneId, payload }));
      });
    },
  };
}

export const createBacklogTaskOnBoard = createBacklogTaskOnBoardLocal;
export const createSprintOnBoard = createSprintOnBoardLocal;
export const createTaskOnBoard = createTaskOnBoardLocal;
export const promoteBacklogTaskToSprint = promoteBacklogTaskToSprintLocal;
export const createEventOnLane = createEventOnLaneLocal;
export const deleteEventFromLane = deleteEventFromLaneLocal;
export const startTaskOnLane = startTaskOnLaneLocal;
export const toggleChecklistItem = toggleChecklistItemLocal;
export const appendChainUpdate = appendChainUpdateLocal;
export const resolveCheckpointBlock = resolveCheckpointBlockLocal;
export const appendLaneSystemEvent = appendLaneSystemEventLocal;
export const configureValidationRequestOnLane =
  configureValidationRequestOnLaneLocal;
export const decideValidationOnLane = decideValidationOnLaneLocal;
