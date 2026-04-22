"use client";

import type { AnagraficaFull } from "@/components/Store/models/anagrafiche";
import type { AulaDetail } from "@/components/Store/models/aule";
import type { EventoFull } from "@/components/Store/models/eventi";

import type {
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineEventKind,
  SprintTimelineLane,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import {
  getTimelinePayloadFromEvento,
  TIMELINE_CHAIN_ID_FIELD,
  TIMELINE_KIND_FIELD,
  TIMELINE_SOURCE_EVENT_ID_FIELD,
} from "@/components/AtlasModuli/SprintTimeline/codecs/timelinePayload";

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
}

function dateOnly(value?: string | null): string | undefined {
  return normalizeIsoDate(value)?.slice(0, 10);
}

function computeTotalUnits(startDate?: string, endDate?: string): number {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (!start || !end) return 30;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function getDateIndex(
  sprintStartDate?: string,
  isoDateTime?: string | null,
): number {
  const start = dateOnly(sprintStartDate);
  const current = dateOnly(isoDateTime);
  if (!start || !current) return 0;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${current}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function mapNamesToParticipants(names?: string[]) {
  return (names ?? [])
    .filter(Boolean)
    .map((name, index) => ({
      id: `p-${index}-${name}`,
      name,
    }));
}

function normalizeEventKind(raw?: string): SprintTimelineEventKind {
  const allowed: SprintTimelineEventKind[] = [
    "planned-start",
    "start",
    "checkpoint",
    "completion-update",
    "block-update",
    "expected-completion",
    "validation",
    "completion",
    "task-block",
    "reopen",
    "note",
  ];

  if (raw && allowed.includes(raw as SprintTimelineEventKind)) {
    return raw as SprintTimelineEventKind;
  }

  return "note";
}

function sortEvents(events: SprintTimelineEvent[]) {
  return [...events].sort((a, b) => {
    if (a.dateIndex !== b.dateIndex) return a.dateIndex - b.dateIndex;
    const aTime = a.date || "";
    const bTime = b.date || "";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.title.localeCompare(b.title);
  });
}

function mapEventoToTimelineEvent(
  evento: EventoFull,
  sprintStartDate?: string,
): SprintTimelineEvent {
  const payload = getTimelinePayloadFromEvento(evento);

  const date =
    normalizeIsoDate(evento.startAt) ||
    normalizeIsoDate(evento.endAt) ||
    "";

  const title = asString(evento.data?.titolo) || "Evento";

  const kindFromField = asString(evento.data?.[TIMELINE_KIND_FIELD]);
  const chainIdFromField = asString(evento.data?.[TIMELINE_CHAIN_ID_FIELD]);
  const sourceEventIdFromField = asString(
    evento.data?.[TIMELINE_SOURCE_EVENT_ID_FIELD],
  );

  return {
    id: evento.id,
    kind: normalizeEventKind(kindFromField || payload.kind),
    title,
    date,
    dateIndex: getDateIndex(sprintStartDate, date),
    note: asString(evento.data?.descrizione),
    chainId: chainIdFromField || payload.chainId,
    sourceEventId: sourceEventIdFromField || payload.sourceEventId,
    createdByValidationId: payload.createdByValidationId,
    participants: mapNamesToParticipants(payload.participants),
    validators: mapNamesToParticipants(payload.validators),
    checklist: payload.checklist?.map((item, index) => ({
      id: item.id || `chk-${index}`,
      label: item.label,
      done: !!item.done,
      doneBy: item.doneBy,
      doneAt: item.doneAt,
    })),
    validationState: payload.validationState,
    validationResult: payload.validationResult,
    decisionLocked: payload.decisionLocked,
    decidedBy: payload.decidedBy,
    decidedAt: payload.decidedAt,
    decisionNote: payload.decisionNote,
    completionDays: payload.completionDays,
    delayDays: payload.delayDays,
    color: payload.color as any,
    systemCheckpointType: title.includes("| Conclusione attesa |") ? "expected-completion" : undefined,
  };
}

function buildSyntheticEvent(
  id: string,
  kind: SprintTimelineEventKind,
  title: string,
  date: string | undefined,
  sprintStartDate?: string,
  note?: string,
): SprintTimelineEvent | null {
  const iso = normalizeIsoDate(date);
  if (!iso) return null;

  return {
    id,
    kind,
    title,
    date: iso,
    dateIndex: getDateIndex(sprintStartDate, iso),
    note,
  };
}

function mapTaskToLane(args: {
  task: AnagraficaFull | null;
  sprintStartDate?: string;
  events: EventoFull[];
  ownerNameMap?: Record<string, string | null>;
}): SprintTimelineLane {
  const { task, sprintStartDate, events, ownerNameMap } = args;

  const title = asString(task?.data?.titoloTask) || "Task";

  const taskEvents = events.map((evento) =>
    mapEventoToTimelineEvent(evento, sprintStartDate),
  );

  const expectedEnd = asString(task?.data?.conclusioneAttesa);
  const actualEnd = asString(task?.data?.conclusioneEffettiva);

  const syntheticExpected = buildSyntheticEvent(
    `expected:${task?.id}`,
    "expected-completion",
    `${title} | Conclusione attesa | Pianificata`,
    expectedEnd,
    sprintStartDate,
    "Target atteso di chiusura del task.",
  );

  const syntheticCompletion = buildSyntheticEvent(
    `completion:${task?.id}`,
    "completion",
    `${title} | Chiusura task | Completato`,
    actualEnd,
    sprintStartDate,
    "Task chiuso.",
  );

  const hasRealCompletion = taskEvents.some((event) => event.kind === "completion");
  const hasRealPlannedStart = taskEvents.some((event) => event.kind === "planned-start" || event.systemCheckpointType === "planned-start");

  const allEvents = sortEvents([
    ...taskEvents.map(e => e.systemCheckpointType === "expected-completion" ? { ...e, kind: "expected-completion" as const } : e),
    ...(!hasRealCompletion && syntheticCompletion ? [syntheticCompletion] : []),
  ]);

  const ownerRef = asString(task?.data?.titolareTask);
  const ownerName =
    (ownerRef && ownerNameMap?.[ownerRef]) ||
    asString(task?.data?.titolareTaskNome) ||
    ownerRef ||
    undefined;

  const lineEndIndex =
    syntheticCompletion?.dateIndex ??
    allEvents.slice(-1)[0]?.dateIndex ??
    0;

  return {
    id: task?.id || randomId("lane"),
    taskId: task?.id || randomId("task"),
    title,
    subtitle: asString(task?.data?.capitoloTask),
    description: asString(task?.data?.descrizioneTask),
    objectives: asString(task?.data?.antologiaTask),
    ownerName,
    taskType: (asString(task?.data?.ambitoTask) || "operations") as any,
    priority: ((asString(task?.data?.prioritaTask) ||
      asString(task?.data?.priority) ||
      "medium") as any),
    expectedEnd: dateOnly(expectedEnd),
    actualEnd: dateOnly(actualEnd),
    lineEndIndex,
    events: allEvents,
  };
}

export function buildSprintTimelineBoard(args: {
  sprint: AulaDetail;
  tasks: AnagraficaFull[];
  taskEventsByTaskId: Record<string, EventoFull[]>;
  ownerNameMap?: Record<string, string | null>;
}): SprintTimelineBoardData {
  const { sprint, tasks, taskEventsByTaskId, ownerNameMap } = args;

  const sprintStartDate = normalizeIsoDate(
    asString(sprint.campi?.inizioSprint) ||
    asString((sprint.campi as any)?.startDate),
  );

  const sprintEndDate = normalizeIsoDate(
    asString(sprint.campi?.fineSprint) ||
    asString((sprint.campi as any)?.endDate),
  );

  const totalUnits = computeTotalUnits(sprintStartDate, sprintEndDate);

  const lanes = tasks.map((task) =>
    mapTaskToLane({
      task,
      sprintStartDate,
      events: taskEventsByTaskId[task.id] || [],
      ownerNameMap,
    }),
  );

  return {
    sprint: {
      id: sprint.id,
      label:
        asString(sprint.campi?.sprintLabel) ||
        asString((sprint as any).label) ||
        "Sprint",
      description: asString(sprint.campi?.descrizioneSprint),
      startDate: sprintStartDate,
      endDate: sprintEndDate,
      statoAvanzamento: asString(sprint.campi?.statoAvanzamento),
      valutazioneSprint: asString(sprint.campi?.valutazioneSprint),
    },
    totalUnits,
    segments: [
      {
        id: `segment:${sprint.id}`,
        label:
          asString(sprint.campi?.sprintLabel) ||
          asString((sprint as any).label) ||
          "Sprint",
        description: asString(sprint.campi?.descrizioneSprint),
        startIndex: 0,
        endIndex: totalUnits,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
      },
    ],
    lanes,
  };
}
