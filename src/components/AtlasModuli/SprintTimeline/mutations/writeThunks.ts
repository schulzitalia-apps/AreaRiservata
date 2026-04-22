"use client";

import { createAsyncThunk } from "@reduxjs/toolkit";

import { loadSingleSprintBoard } from "@/components/AtlasModuli/SprintTimeline/joins/loadBoard";
import { resolveOwnerIdByName } from "@/components/AtlasModuli/SprintTimeline/joins/owners";

import {
  asString,
  buildEventDateFromUnitIndex,
  getCurrentLocalTimeString,
  getDateIndex,
  getIsoDateForUnitIndex,
  getTodayIndexFromSprintStart,
  randomId,
  sortEvents,
} from "@/components/AtlasModuli/SprintTimeline/mutations/domain";
import {
  attachTaskToSprint,
  createTaskRecord,
  createTimelineEventRecord,
  deleteTimelineEventRecord,
  getTimelineEventFull,
  patchTaskData,
  updateTimelineEventRecord,
  updateTaskRecord,
  deleteTaskEvents,
  deleteTaskRecord,
} from "@/components/AtlasModuli/SprintTimeline/mutations/persistence";
import { resolveActorsByNamesClient } from "@/components/AtlasModuli/SprintTimeline/mutations/resolveWriteActors";
import type {
  SprintTimelineBlockCheckpointArgs,
  SprintTimelineCompleteCheckpointArgs,
  SprintTimelineConfigureValidationArgs,
  SprintTimelineCreateEventArgs,
  SprintTimelineCreateQuickTaskArgs,
  SprintTimelineCreateSprintArgs,
  SprintTimelineCreateTaskArgs,
  SprintTimelineDecideValidationArgs,
  SprintTimelineDeleteEventArgs,
  SprintTimelineManualReopenTaskArgs,
  SprintTimelinePromoteTaskArgs,
  SprintTimelineRemoteBoardResult,
  SprintTimelineResolveCheckpointBlockArgs,
  SprintTimelineResolveTaskBlockArgs,
  SprintTimelineStartTaskArgs,
  SprintTimelineToggleChecklistArgs,
  SprintTimelineUpdateTaskArgs,
  SprintTimelineDeleteTaskArgs,
  SprintTimelineCompleteAndRequestValidationArgs,
} from "@/components/AtlasModuli/SprintTimeline/mutations/types";
import { getTimelinePayloadFromEvento } from "@/components/AtlasModuli/SprintTimeline/codecs/timelinePayload";
import { isOperationalCheckpoint, getEventTitle } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.helpers";
import {
  SPRINT_AULA_TYPE,
} from "@/components/AtlasModuli/SprintTimeline/constants";

function resolveTaskIdForSprint(taskLikeId: string, sprintId?: string): string {
  if (!taskLikeId) return taskLikeId;
  if (!taskLikeId.includes("::")) return taskLikeId;

  const parts = taskLikeId.split("::").filter(Boolean);
  if (!parts.length) return taskLikeId;

  if (sprintId) {
    const sprintParts = sprintId.split("::").filter(Boolean);
    const sprintClean = sprintParts[sprintParts.length - 1];
    const withoutSprint = parts.filter((part) => part !== sprintClean);
    if (withoutSprint.length) {
      return withoutSprint[0];
    }
  }

  return parts[0];
}

import type {
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineEventKind,
  SprintTimelineLane,
  SprintTimelineParticipantReference,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { saveAulaApi } from "@/components/Store/services/auleService";

function buildChecklistCodecs(labels?: string[]) {
  return (labels ?? []).map((label, index) => ({
    id: `chk-${index}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    done: false,
  }));
}

/**
 * Normalizza i partecipanti in riferimenti strutturati (tipo + ID)
 * se arrivano come semplici stringhe (ID).
 */
function normalizeParticipantRefs(
  refs?: (string | SprintTimelineParticipantReference)[],
): SprintTimelineParticipantReference[] {
  return (refs ?? []).map((ref) => {
    if (typeof ref === "string") {
      return { anagraficaType: "evolver", anagraficaId: ref };
    }
    return ref;
  });
}

function getLatestEventByKinds(
  lane: SprintTimelineLane,
  kinds: SprintTimelineEventKind[],
): SprintTimelineEvent | undefined {
  return sortEvents(lane.events)
    .filter((event) => kinds.includes(event.kind))
    .slice(-1)[0];
}

function getEventChainId(event?: SprintTimelineEvent | null) {
  if (!event) return "";
  return event.chainId || event.sourceEventId || event.id;
}

function getLaneChainEvents(lane: SprintTimelineLane, chainId: string) {
  return sortEvents(
    lane.events.filter((event) => getEventChainId(event) === chainId),
  );
}

function getCheckpointChainStatusFromLane(
  lane: SprintTimelineLane,
  chainId: string,
): "open" | "blocked" | "completed" {
  const chainEvents = getLaneChainEvents(lane, chainId).filter((event) =>
    ["block-update", "completion-update"].includes(event.kind),
  );
  const latest = chainEvents.slice(-1)[0];
  if (!latest) return "open";
  if (latest.kind === "block-update") return "blocked";
  if (latest.kind === "completion-update") return "completed";
  return "open";
}

function getLastReopenIndex(lane: SprintTimelineLane) {
  return getLatestEventByKinds(lane, ["reopen"])?.dateIndex ?? -1;
}

function getCurrentCycleEvents(lane: SprintTimelineLane) {
  const events = sortEvents(lane.events);
  const lastReopenPosition = [...events]
    .map((event) => event.kind)
    .lastIndexOf("reopen");

  if (lastReopenPosition < 0) return events;
  return events.slice(lastReopenPosition + 1);
}

function getActionTimeForUnitIndex(
  sprintStartDate: string | undefined,
  unitIndex: number,
  fallbackTime: string,
  offsetSeconds = 0,
) {
  const todayIndex = getTodayIndexFromSprintStart(sprintStartDate);
  return unitIndex === todayIndex
    ? getCurrentLocalTimeString(offsetSeconds)
    : fallbackTime;
}

function getTitleTail(title?: string) {
  const parts = String(title || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[2];
}

async function syncTaskSystemEvents(args: {
  lane: SprintTimelineLane;
  sprintStartDate?: string;
  title: string;
  priority: string;
  plannedStartIndex: number;
  expectedEndIndex: number;
}) {
  const plannedStartEvent = args.lane.events.find(
    (event) =>
      event.kind === "planned-start" ||
      event.systemCheckpointType === "planned-start",
  );

  const expectedCompletionEvent = args.lane.events.find(
    (event) =>
      event.kind === "expected-completion" ||
      event.systemCheckpointType === "expected-completion",
  );

  const updates: Promise<void>[] = [];

  if (plannedStartEvent) {
    updates.push(
      updateTimelineEventRecord({
        eventId: plannedStartEvent.id,
        patchData: {
          titolo: getEventTitle(args.title, "planned-start"),
          descrizione:
            "Checkpoint automatico di sistema: avvio atteso del task.",
          priorita: args.priority,
        },
        startAt: buildEventDateFromUnitIndex(
          args.sprintStartDate,
          args.plannedStartIndex,
          "09:00:00",
        ),
      }),
    );
  }

  if (expectedCompletionEvent) {
    updates.push(
      updateTimelineEventRecord({
        eventId: expectedCompletionEvent.id,
        patchData: {
          titolo: getEventTitle(args.title, "expected-completion"),
          descrizione:
            "Checkpoint automatico di sistema: target atteso di chiusura del task.",
          priorita: args.priority,
        },
        startAt: buildEventDateFromUnitIndex(
          args.sprintStartDate,
          args.expectedEndIndex,
          "18:00:00",
        ),
      }),
    );
  }

  const taskScopedEvents = args.lane.events.filter(
    (event) =>
      !event.systemCheckpointType &&
      event.kind !== "completion" &&
      event.kind !== "reopen" &&
      event.kind !== "start",
  );

  for (const event of taskScopedEvents) {
    const tail = getTitleTail(event.title);
    if (!tail) continue;

    updates.push(
      updateTimelineEventRecord({
        eventId: event.id,
        patchData: {
          titolo: getEventTitle(args.title, event.kind, tail),
          priorita: args.priority,
        },
      }),
    );
  }

  await Promise.all(updates);
}

function getCurrentCycleCheckpointBases(lane: SprintTimelineLane) {
  return getCurrentCycleEvents(lane).filter((event) => isOperationalCheckpoint(event));
}

function getLatestCheckpointCompletionIndexFromLane(
  lane: SprintTimelineLane,
): number | null {
  const checkpointBases = getCurrentCycleCheckpointBases(lane);
  const chainIds = Array.from(
    new Set(checkpointBases.map((event) => getEventChainId(event)).filter(Boolean)),
  );

  const completionIndexes = chainIds.flatMap((chainId) =>
    getLaneChainEvents(lane, chainId)
      .filter((event) => event.kind === "completion-update")
      .map((event) => event.dateIndex),
  );

  return completionIndexes.length ? Math.max(...completionIndexes) : null;
}

function getValidationRequestIndexFromLane(
  lane: SprintTimelineLane,
  todayIndex: number,
) {
  const latestCompletionIndex = getLatestCheckpointCompletionIndexFromLane(lane);
  if (latestCompletionIndex === null) return todayIndex + 1;
  return latestCompletionIndex + 1;
}

function shouldAutoCreateValidation(lane: SprintTimelineLane): boolean {
  const checkpointBases = getCurrentCycleCheckpointBases(lane);
  const chainIds = Array.from(
    new Set(checkpointBases.map((event) => getEventChainId(event)).filter(Boolean)),
  );

  if (!chainIds.length) return false;

  const allCompleted = chainIds.every(
    (chainId) => getCheckpointChainStatusFromLane(lane, chainId) === "completed",
  );
  if (!allCompleted) return false;

  const hasPendingValidation = getCurrentCycleEvents(lane).some(
    (event) => event.kind === "validation" && event.validationState === "requested",
  );

  return !hasPendingValidation;
}

async function maybeCreateValidationAfterCheckpointCompletion(args: {
  sprintId: string;
  taskId: string;
}): Promise<SprintTimelineBoardData> {
  const board = await loadSingleSprintBoard(args.sprintId);
  const lane = board.lanes.find(
    (item) => item.id === args.taskId || item.taskId === args.taskId,
  );

  if (!lane) return board;
  if (!shouldAutoCreateValidation(lane)) return board;

  const todayIndex = getTodayIndexFromSprintStart(board.sprint.startDate);
  const unitIndex = getValidationRequestIndexFromLane(lane, todayIndex);

  await createTimelineEventRecord({
    sprintId: args.sprintId,
    taskId: args.taskId,
    kind: "validation",
    title: getEventTitle(lane.title, "validation", "Richiesta"),
    note: "",
    sprintStartDate: board.sprint.startDate,
    unitIndex,
    time: "18:30:00",
    chainId: randomId("validation"),
    validators: [],
    validationState: "requested",
    validationResult: "pending",
    decisionLocked: false,
    stato: "programmato",
  });

  return loadSingleSprintBoard(args.sprintId);
}

export const createSprintTimelineSprint = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCreateSprintArgs
>("sprintTimeline/createSprint", async ({ payload }) => {
  const aula = await saveAulaApi({
    type: SPRINT_AULA_TYPE,
    campi: {
      sprintLabel: payload.label,
      descrizioneSprint: payload.description || "",
      inizioSprint: payload.startDate,
      fineSprint: payload.endDate,
      startDate: payload.startDate,
      endDate: payload.endDate,
      statoAvanzamento: "programmato",
    },
    partecipanti: [],
    visibilityRole: null,
  });

  const board = await loadSingleSprintBoard(aula.id);
  return { sprintId: aula.id, board };
});

export const createSprintTimelineQuickTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCreateQuickTaskArgs
>("sprintTimeline/createQuickTask", async ({ sprintId, payload }) => {
  const taskId = await createTaskRecord({
    title: payload.title.trim(),
    description: payload.description?.trim() || "",
    statoTask: "backlog",
  });

  await attachTaskToSprint(sprintId, taskId);

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const createSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCreateTaskArgs
>("sprintTimeline/createTask", async ({ sprintId, payload, baseStartDate }) => {
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const targetStartDate = sprintBoard.sprint.startDate;
  const effectiveBaseDate = baseStartDate || targetStartDate;

  const actualPlannedStartAt = getIsoDateForUnitIndex(
    effectiveBaseDate,
    payload.plannedStartIndex,
  );
  const actualExpectedEndAt = getIsoDateForUnitIndex(
    effectiveBaseDate,
    payload.expectedEndIndex,
  );

  // Normalizziamo gli indici per la board di destinazione
  const normalizedPlannedStartIndex = getDateIndex(
    targetStartDate,
    actualPlannedStartAt,
  ) ?? payload.plannedStartIndex;

  const normalizedExpectedEndIndex = getDateIndex(
    targetStartDate,
    actualExpectedEndAt,
  ) ?? payload.expectedEndIndex;

  const taskId = await createTaskRecord({
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim() || "",
    description: payload.description?.trim() || "",
    objectives: payload.objectives?.trim() || "",
    ownerId: payload.ownerId,
    referenteId: payload.referenteId,
    ownerName: payload.ownerName?.trim() || "",
    referenteName: payload.referenteName?.trim() || "",
    taskType: payload.taskType,
    priority: payload.priority,
    expectedEnd: actualExpectedEndAt,
    statoTask: "pianificato",
  });

  await attachTaskToSprint(sprintId, taskId);

  await createTimelineEventRecord({
    sprintId,
    taskId,
    kind: "planned-start",
    title: getEventTitle(payload.title, "planned-start"),
    note: "Checkpoint automatico di sistema: avvio atteso del task.",
    sprintStartDate: targetStartDate,
    unitIndex: normalizedPlannedStartIndex,
    time: "09:00:00",
    color: "gray",
    systemCheckpointType: "planned-start",
    stato: "programmato",
    priorita: payload.priority,
  });

  await createTimelineEventRecord({
    sprintId,
    taskId,
    kind: "expected-completion",
    title: getEventTitle(payload.title, "expected-completion"),
    note: "Checkpoint automatico di sistema: target atteso di chiusura del task.",
    sprintStartDate: targetStartDate,
    unitIndex: normalizedExpectedEndIndex,
    time: "18:00:00",
    color: "orange",
    systemCheckpointType: "expected-completion",
    stato: "programmato",
    priorita: payload.priority,
  });

  for (const milestone of payload.milestones ?? []) {
    await createTimelineEventRecord({
      sprintId,
      taskId,
      kind: "checkpoint",
      title: getEventTitle(payload.title, "checkpoint", milestone.title),
      note: milestone.note,
      sprintStartDate: targetStartDate,
      unitIndex:
        getDateIndex(
          targetStartDate,
          getIsoDateForUnitIndex(effectiveBaseDate, milestone.unitIndex),
        ) ?? milestone.unitIndex,
      time: "10:00:00",
      chainId: randomId("chain"),
      participants: normalizeParticipantRefs(milestone.participants),
      checklist: buildChecklistCodecs(milestone.checklistItems),
      stato: "programmato",
      priorita: payload.priority,
    });
  }

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const promoteSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelinePromoteTaskArgs
>("sprintTimeline/promoteTask", async ({ sprintId, laneId, payload, baseStartDate }) => {
  const taskId = resolveTaskIdForSprint(laneId, sprintId);
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const targetStartDate = sprintBoard.sprint.startDate;
  const effectiveBaseDate = baseStartDate || targetStartDate;

  const actualPlannedStartAt = getIsoDateForUnitIndex(
    effectiveBaseDate,
    payload.plannedStartIndex,
  );
  const actualExpectedEndAt = getIsoDateForUnitIndex(
    effectiveBaseDate,
    payload.expectedEndIndex,
  );

  // Normalizziamo gli indici per la board di destinazione
  const normalizedPlannedStartIndex = getDateIndex(
    targetStartDate,
    actualPlannedStartAt,
  ) ?? payload.plannedStartIndex;

  const normalizedExpectedEndIndex = getDateIndex(
    targetStartDate,
    actualExpectedEndAt,
  ) ?? payload.expectedEndIndex;

  let ownerId = payload.ownerId;
  let referenteId = payload.referenteId;

  if (!ownerId && payload.ownerName) {
    ownerId = await resolveOwnerIdByName(payload.ownerName);
  }
  if (!referenteId && payload.referenteName) {
    referenteId = await resolveOwnerIdByName(payload.referenteName);
  }

  await updateTaskRecord(taskId, {
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim() || "",
    description: payload.description?.trim() || "",
    objectives: payload.objectives?.trim() || "",
    ownerId,
    referenteId,
    taskType: payload.taskType,
    priority: payload.priority,
    expectedEnd: actualExpectedEndAt,
    actualEnd: null,
    statoTask: "pianificato",
  });

  await attachTaskToSprint(sprintId, taskId);

  await createTimelineEventRecord({
    sprintId,
    taskId: taskId,
    kind: "planned-start",
    title: getEventTitle(payload.title, "planned-start"),
    note: "Checkpoint automatico di sistema: avvio atteso del task.",
    sprintStartDate: targetStartDate,
    unitIndex: normalizedPlannedStartIndex,
    time: "09:00:00",
    color: "gray",
    systemCheckpointType: "planned-start",
    stato: "programmato",
    priorita: payload.priority,
  });

  await createTimelineEventRecord({
    sprintId,
    taskId: taskId,
    kind: "expected-completion",
    title: getEventTitle(payload.title, "expected-completion"),
    note: "Checkpoint automatico di sistema: target atteso di chiusura del task.",
    sprintStartDate: targetStartDate,
    unitIndex: normalizedExpectedEndIndex,
    time: "18:00:00",
    color: "orange",
    systemCheckpointType: "expected-completion",
    stato: "programmato",
    priorita: payload.priority,
  });

  for (const milestone of payload.milestones ?? []) {
    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "checkpoint",
      title: getEventTitle(payload.title, "checkpoint", milestone.title),
      note: milestone.note,
      sprintStartDate: targetStartDate,
      unitIndex:
        getDateIndex(
          targetStartDate,
          getIsoDateForUnitIndex(effectiveBaseDate, milestone.unitIndex),
        ) ?? milestone.unitIndex,
      time: "10:00:00",
      chainId: randomId("chain"),
      participants: normalizeParticipantRefs(milestone.participants),
      checklist: buildChecklistCodecs(milestone.checklistItems),
      stato: "programmato",
      priorita: payload.priority,
    });
  }

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const createSprintTimelineEvent = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCreateEventArgs
>("sprintTimeline/createEvent", async ({ sprintId, payload }) => {
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const lane = sprintBoard.lanes.find(l => l.id === payload.laneId || l.taskId === payload.laneId);
  const laneTitle = lane?.title || "Task";

  await createTimelineEventRecord({
    sprintId,
    taskId: payload.laneId,
    kind: payload.kind,
    title: getEventTitle(laneTitle, payload.kind, payload.title),
    note: payload.note?.trim() || "",
    sprintStartDate: sprintBoard.sprint.startDate,
    unitIndex: payload.unitIndex,
    date: payload.date,
    time: getActionTimeForUnitIndex(
      sprintBoard.sprint.startDate,
      payload.unitIndex,
      payload.kind === "task-block" ? "11:00:00" : "10:00:00",
    ),
    chainId: payload.kind === "checkpoint" ? randomId("chain") : undefined,
    participants:
      payload.kind === "checkpoint" || payload.kind === "task-block"
        ? normalizeParticipantRefs(payload.participants)
        : undefined,
    checklist:
      payload.kind === "checkpoint" || payload.kind === "task-block"
        ? buildChecklistCodecs(payload.checklistItems)
        : undefined,
    stato: "programmato",
  });

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const deleteSprintTimelineEvent = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineDeleteEventArgs
>("sprintTimeline/deleteEvent", async ({ sprintId, laneId, eventId }) => {
  const taskId = resolveTaskIdForSprint(laneId, sprintId);
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const lane = sprintBoard.lanes.find((item) => item.id === laneId || item.taskId === taskId);
  const targetEvent = lane?.events.find((item) => item.id === eventId);

  if (lane && targetEvent?.kind === "checkpoint") {
    const chainId = getEventChainId(targetEvent);
    const chainEvents = lane.events.filter(
      (item) => getEventChainId(item) === chainId,
    );

    await Promise.all(
      chainEvents.map((item) => deleteTimelineEventRecord(item.id)),
    );
  } else {
    await deleteTimelineEventRecord(eventId);
  }

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const startSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineStartTaskArgs
>(
  "sprintTimeline/startTask",
  async ({ sprintId, laneId, sourceEventId, currentUserName }) => {
    const taskId = resolveTaskIdForSprint(laneId, sprintId);
    const sprintBoard = await loadSingleSprintBoard(sprintId);
    const lane = sprintBoard.lanes.find((item) => item.id === laneId || item.taskId === taskId);
    if (!lane) {
      const board = await loadSingleSprintBoard(sprintId);
      return { sprintId, board };
    }

    const alreadyStarted = lane.events.some((event) => event.kind === "start");
    if (!alreadyStarted) {
      const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);

      await createTimelineEventRecord({
        sprintId,
        taskId: taskId,
        kind: "start",
        title: getEventTitle(lane.title, "start", "Eseguita"),
        note: currentUserName
          ? `Task avviato da ${currentUserName}.`
          : "Task avviato.",
        sprintStartDate: sprintBoard.sprint.startDate,
        unitIndex: todayIndex,
        time: getActionTimeForUnitIndex(
          sprintBoard.sprint.startDate,
          todayIndex,
          "09:30:00",
        ),
        sourceEventId,
        stato: "in_corso",
      });

      await patchTaskData(taskId, {
        statoTask: "in_corso",
      });
    }

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const toggleSprintTimelineChecklistItem = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineToggleChecklistArgs
>(
  "sprintTimeline/toggleChecklistItem",
  async ({ sprintId, eventId, itemId, checked, currentUserName }) => {
    const full = await getTimelineEventFull(eventId);
    const payload = getTimelinePayloadFromEvento(full);

    const nextChecklist = (payload.checklist ?? []).map((item) =>
      item.id === itemId
        ? {
          ...item,
          done: checked,
          doneBy: checked ? currentUserName || item.doneBy : undefined,
          doneAt: checked ? new Date().toISOString() : undefined,
        }
        : item,
    );

    await updateTimelineEventRecord({
      eventId,
      patchPayload: {
        checklist: nextChecklist,
      },
    });

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const completeSprintTimelineCheckpoint = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCompleteCheckpointArgs
>(
  "sprintTimeline/completeCheckpoint",
  async ({ sprintId, laneId, eventId, currentUserName }) => {
    const taskId = resolveTaskIdForSprint(laneId, sprintId);
    const sprintBoard = await loadSingleSprintBoard(sprintId);
    const lane = sprintBoard.lanes.find((l) => l.id === laneId || l.taskId === taskId);
    if (!lane) throw new Error("LANE_NOT_FOUND");

    const source = await getTimelineEventFull(eventId);
    const sourcePayload = getTimelinePayloadFromEvento(source);

    const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);
    const sourceIndex = getDateIndex(sprintBoard.sprint.startDate, source.startAt);
    const completionDays = Math.max(0, todayIndex - sourceIndex);

    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "completion-update",
      title: getEventTitle(lane.title, "completion-update", "Completato"),
      note: `Checkpoint chiuso da ${currentUserName || "utente"
        } in ${completionDays} giorni.`,
      sprintStartDate: sprintBoard.sprint.startDate,
      unitIndex: todayIndex,
      time: getActionTimeForUnitIndex(
        sprintBoard.sprint.startDate,
        todayIndex,
        "17:30:00",
      ),
      chainId: sourcePayload.chainId || eventId,
      sourceEventId: eventId,
      completionDays,
      stato: "completato",
    });

    const board = await maybeCreateValidationAfterCheckpointCompletion({
      sprintId,
      taskId: taskId,
    });

    return { sprintId, board };
  },
);

export const completeCheckpointAndRequestValidationThunk = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineCompleteAndRequestValidationArgs
>(
  "sprintTimeline/completeAndRequestValidation",
  async ({ sprintId, laneId, eventId, validators, note, currentUserName }) => {
    const taskId = resolveTaskIdForSprint(laneId, sprintId);
    const sprintBoard = await loadSingleSprintBoard(sprintId);
    const lane = sprintBoard.lanes.find((l) => l.id === laneId || l.taskId === taskId);
    if (!lane) throw new Error("LANE_NOT_FOUND");

    const source = await getTimelineEventFull(eventId);
    const sourcePayload = getTimelinePayloadFromEvento(source);

    const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);
    const sourceIndex = getDateIndex(sprintBoard.sprint.startDate, source.startAt);
    const completionDays = Math.max(0, todayIndex - sourceIndex);

    // 1. Completion Update Record
    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "completion-update",
      title: getEventTitle(lane.title, "completion-update", "Completato"),
      note: `Checkpoint chiuso da ${currentUserName || "utente"} in ${completionDays} giorni.`,
      sprintStartDate: sprintBoard.sprint.startDate,
      unitIndex: todayIndex,
      time: getActionTimeForUnitIndex(
        sprintBoard.sprint.startDate,
        todayIndex,
        "17:30:00",
      ),
      chainId: sourcePayload.chainId || eventId,
      sourceEventId: eventId,
      completionDays,
      stato: "completato",
    });

    // 2. Validation Request Record
    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "validation",
      title: getEventTitle(lane.title, "validation", "Richiesta"),
      note: note?.trim() || "",
      sprintStartDate: sprintBoard.sprint.startDate,
      unitIndex: todayIndex, 
      time: getActionTimeForUnitIndex(
        sprintBoard.sprint.startDate,
        todayIndex,
        "18:00:00",
        1,
      ),
      chainId: randomId("validation"),
      validators: normalizeParticipantRefs(validators),
      validationState: "requested",
      validationResult: "pending",
      decisionLocked: false,
      stato: "programmato",
    });

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const blockSprintTimelineCheckpoint = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineBlockCheckpointArgs
>(
  "sprintTimeline/blockCheckpoint",
  async ({
    sprintId,
    laneId,
    eventId,
    note,
    participants,
    checklistItems,
  }) => {
    const taskId = resolveTaskIdForSprint(laneId, sprintId);
    const sprintBoard = await loadSingleSprintBoard(sprintId);
    const lane = sprintBoard.lanes.find(l => l.id === laneId || l.taskId === laneId);
    if (!lane) throw new Error("LANE_NOT_FOUND");

    const source = await getTimelineEventFull(eventId);
    const sourcePayload = getTimelinePayloadFromEvento(source);

    const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);

    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "block-update",
      title: getEventTitle(lane.title, "block-update", "Bloccato"),
      note:
        note?.trim() ||
        asString(source.data?.descrizione) ||
        "Checkpoint bloccato.",
      sprintStartDate: sprintBoard.sprint.startDate,
      unitIndex: todayIndex,
      time: getActionTimeForUnitIndex(
        sprintBoard.sprint.startDate,
        todayIndex,
        "11:00:00",
      ),
      chainId: sourcePayload.chainId || eventId,
      sourceEventId: eventId,
      participants: participants ?? [],
      checklist: buildChecklistCodecs(checklistItems),
      stato: "in_corso",
    });

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const resolveSprintTimelineCheckpointBlock = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineResolveCheckpointBlockArgs
>(
  "sprintTimeline/resolveCheckpointBlock",
  async ({ sprintId, eventId }) => {
    await deleteTimelineEventRecord(eventId);
    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const configureSprintTimelineValidation = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineConfigureValidationArgs
>(
  "sprintTimeline/configureValidation",
  async ({ sprintId, eventId, validators, note }) => {
    await updateTimelineEventRecord({
      eventId,
      patchData: {
        descrizione: note?.trim() || "",
      },
      patchPayload: {
        validators: validators.map((item) => item.anagraficaId),
      },
      validators,
    });

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const decideSprintTimelineValidation = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineDecideValidationArgs
>(
  "sprintTimeline/decideValidation",
  async ({
    sprintId,
    laneId,
    eventId,
    outcome,
    decisionNote,
    currentUserName,
  }) => {
    const taskId = resolveTaskIdForSprint(laneId, sprintId);
    const sprintBoard = await loadSingleSprintBoard(sprintId);
    const validation = await getTimelineEventFull(eventId);
    const validationPayload = getTimelinePayloadFromEvento(validation);

    const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);
    const outcomeIndex = todayIndex;
    const outcomeIso = getIsoDateForUnitIndex(
      sprintBoard.sprint.startDate,
      outcomeIndex,
    );

    const lane = sprintBoard.lanes.find((item) => item.id === laneId || item.taskId === taskId);

    const latestExpected = lane?.events
      .filter((event) => event.kind === "expected-completion" || event.systemCheckpointType === "expected-completion")
      .slice(-1)[0];

    const delayDays =
      latestExpected && outcomeIndex > latestExpected.dateIndex
        ? outcomeIndex - latestExpected.dateIndex
        : 0;

    await updateTimelineEventRecord({
      eventId,
      patchData: {
        titolo: getEventTitle(lane?.title || "Task", "validation", outcome === "approved" ? "Approvata" : "Respinta"),
      },
      patchPayload: {
        ...validationPayload,
        validationState: "decided",
        validationResult: outcome,
        decisionLocked: true,
        decidedBy: currentUserName,
        decidedAt: buildEventDateFromUnitIndex(
          sprintBoard.sprint.startDate,
          todayIndex,
          getActionTimeForUnitIndex(
            sprintBoard.sprint.startDate,
            todayIndex,
            "17:00:00",
          ),
        ),
        decisionNote: decisionNote.trim(),
      },
    });

    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: outcome === "approved" ? "completion" : "reopen",
      title: getEventTitle(lane?.title || "Task", outcome === "approved" ? "completion" : "reopen", "Eseguita"),
      note:
        outcome === "approved"
          ? "Esito automatico della validazione approvata."
          : "Esito automatico della validazione respinta.",
      sprintStartDate: sprintBoard.sprint.startDate,
      unitIndex: outcomeIndex,
      time: getActionTimeForUnitIndex(
        sprintBoard.sprint.startDate,
        outcomeIndex,
        "19:00:00",
        1,
      ),
      chainId: validationPayload.chainId || validation.id,
      createdByValidationId: validation.id,
      delayDays,
      stato: outcome === "approved" ? "completato" : "in_corso",
    });

    await patchTaskData(taskId, {
      conclusioneEffettiva: outcome === "approved" ? outcomeIso : null,
      statoTask: outcome === "approved" ? "completato" : "in_corso",
    });

    const board = await loadSingleSprintBoard(sprintId);
    return { sprintId, board };
  },
);

export const resolveSprintTimelineTaskBlock = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineResolveTaskBlockArgs
>("sprintTimeline/resolveTaskBlock", async ({ sprintId, laneId, eventId }) => {
  const taskId = resolveTaskIdForSprint(laneId, sprintId);
  await deleteTimelineEventRecord(eventId);

  await patchTaskData(taskId, {
    conclusioneEffettiva: null,
    statoTask: "in_corso",
  });

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const manualReopenSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineManualReopenTaskArgs
>("sprintTimeline/manualReopenTask", async ({ sprintId, laneId }) => {
  const taskId = resolveTaskIdForSprint(laneId, sprintId);
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const lane = sprintBoard.lanes.find((l) => l.id === laneId || l.taskId === taskId);
  const todayIndex = getTodayIndexFromSprintStart(sprintBoard.sprint.startDate);

  await createTimelineEventRecord({
    sprintId,
    taskId: taskId,
    kind: "reopen",
    title: "Task riaperto",
    note: "Riapertura manuale eseguita dal proprietario del task.",
    sprintStartDate: sprintBoard.sprint.startDate,
    unitIndex: todayIndex,
    time: getActionTimeForUnitIndex(
      sprintBoard.sprint.startDate,
      todayIndex,
      "10:00:00",
    ),
    stato: "in_corso",
  });

  await patchTaskData(taskId, {
    conclusioneEffettiva: null,
    statoTask: "in_corso",
  });

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const updateSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineUpdateTaskArgs
>("sprintTimeline/updateTask", async ({ sprintId, laneId, payload }) => {
  const taskId = resolveTaskIdForSprint(laneId, sprintId);
  const sprintBoard = await loadSingleSprintBoard(sprintId);
  const targetStartDate = sprintBoard.sprint.startDate;
  const lane = sprintBoard.lanes.find((item) => item.id === laneId || item.taskId === taskId);

  const expectedEndIso = getIsoDateForUnitIndex(
    targetStartDate,
    payload.expectedEndIndex,
  );

  await updateTaskRecord(taskId, {
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim() || "",
    description: payload.description?.trim() || "",
    objectives: payload.objectives?.trim() || "",
    ownerId: payload.ownerId,
    referenteId: payload.referenteId,
    taskType: payload.taskType,
    priority: payload.priority,
    expectedEnd: expectedEndIso,
  });

  if (lane) {
    await syncTaskSystemEvents({
      lane,
      sprintStartDate: targetStartDate,
      title: payload.title.trim(),
      priority: payload.priority,
      plannedStartIndex: payload.plannedStartIndex,
      expectedEndIndex: payload.expectedEndIndex,
    });
  }

  // Aggiorna i checkpoint operativi esistenti e crea solo le milestone nuove.
  for (const milestone of payload.milestones ?? []) {
    if (milestone.eventId) {
      await updateTimelineEventRecord({
        eventId: milestone.eventId,
        patchData: {
          titolo: getEventTitle(payload.title, "checkpoint", milestone.title),
          descrizione: milestone.note || "",
          priorita: payload.priority,
          stato: "programmato",
        },
        patchPayload: {
          checklist: buildChecklistCodecs(milestone.checklistItems),
        },
        participants: normalizeParticipantRefs(milestone.participants),
        startAt: buildEventDateFromUnitIndex(
          targetStartDate,
          milestone.unitIndex,
          "10:00:00"
        ),
      });
      continue;
    }

    await createTimelineEventRecord({
      sprintId,
      taskId: taskId,
      kind: "checkpoint",
      title: getEventTitle(payload.title, "checkpoint", milestone.title),
      note: milestone.note,
      sprintStartDate: targetStartDate,
      unitIndex: milestone.unitIndex,
      time: "10:00:00",
      chainId: randomId("chain"),
      participants: normalizeParticipantRefs(milestone.participants),
      checklist: buildChecklistCodecs(milestone.checklistItems),
      stato: "programmato",
      priorita: payload.priority,
    });
  }

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const deleteSprintTimelineTask = createAsyncThunk<
  SprintTimelineRemoteBoardResult,
  SprintTimelineDeleteTaskArgs
>("sprintTimeline/deleteTask", async ({ sprintId, laneId }) => {
  await deleteTaskEvents(sprintId, laneId);
  await deleteTaskRecord(laneId);

  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

