"use client";

import type {
  SprintTaskPriority,
  SprintTaskType,
  SprintTimelineBoardData,
  SprintTimelineColumn,
  SprintTimelineDerivedLaneState,
  SprintTimelineEvent,
  SprintTimelineEventKind,
  SprintTimelineFilters,
  SprintTimelineLane,
  SprintTimelineSegment,
  SprintTimelineSegmentVisual,
  SprintTimelineSelection,
  SprintTimelineViewport,
  SprintTimelineZoom,
  TimelineSemaforo,
} from "./SprintTimeline.types";
import {
  isTaskOwner,
  isTaskReferente,
  isEventActionableByUser,
  isValidationActionableByUser,
  type SprintTimelineViewer,
} from "./permissions";

const DAY_MS = 24 * 60 * 60 * 1000;

export const TASK_TYPE_OPTIONS: Array<{ value: SprintTaskType | ""; label: string }> = [
  { value: "", label: "Tutti i tipi" },
  { value: "operations", label: "Operations" },
  { value: "delivery", label: "Delivery" },
  { value: "support", label: "Support" },
  { value: "analysis", label: "Analysis" },
  { value: "scrum", label: "Scrum" },
];

function parseDateOnly(iso?: string): Date | null {
  if (!iso) return null;
  const value = iso.slice(0, 10);
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateTime(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return parseDateOnly(value);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatWithIntl(
  value: string | Date | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : parseDateTime(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", options).format(date);
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / DAY_MS / 7);
}

function severity(signal: TimelineSemaforo) {
  switch (signal) {
    case "red":
      return 0;
    case "orange":
      return 1;
    case "yellow":
      return 2;
    case "purple":
      return 3;
    case "blue":
      return 4;
    case "teal":
      return 5;
    case "gray":
      return 6;
    case "green":
      return 7;
    default:
      return 8;
  }
}

function createDayColumn(
  sprintStartDate: string | undefined,
  unitIndex: number,
): SprintTimelineColumn {
  const isoDate = getIsoDateForUnitIndex(sprintStartDate, unitIndex);
  const date = parseDateOnly(isoDate);
  const labelTop = formatWithIntl(date ?? undefined, { weekday: "short", timeZone: "UTC" });
  const labelBottom = formatWithIntl(date ?? undefined, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const week = date ? getIsoWeek(date) : unitIndex + 1;
  const monthLabel = formatWithIntl(date ?? undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    id: `day-${unitIndex}`,
    centerIndex: unitIndex,
    isoDate,
    labelTop,
    labelBottom,
    weekKey: date ? `${date.getUTCFullYear()}-W${week}` : `week-${week}`,
    weekLabel: `Week ${week}`,
    monthKey: isoDate ? isoDate.slice(0, 7) : `month-${unitIndex}`,
    monthLabel,
  };
}

function getViewportWindowSize(zoom: SprintTimelineZoom, totalUnits: number, focusWindow: number) {
  switch (zoom) {
    case "roadmap":
      return totalUnits;
    case "month":
      return Math.min(totalUnits, 28);
    case "week":
      return Math.min(totalUnits, 7);
    case "sprint-focus":
    default:
      return Math.min(totalUnits, Math.max(14, focusWindow || 18));
  }
}

function getViewportUnitWidth(zoom: SprintTimelineZoom, isCompact = false) {
  if (isCompact) {
    switch (zoom) {
      case "roadmap":
        return 64;
      case "month":
        return 72;
      case "week":
        return 92;
      case "sprint-focus":
      default:
        return 84;
    }
  }

  switch (zoom) {
    case "roadmap":
      return 92;
    case "month":
      return 92;
    case "week":
      return 118;
    case "sprint-focus":
    default:
      return 106;
  }
}

function getViewportTitle(startIso: string | undefined, endIso: string | undefined, zoom: SprintTimelineZoom) {
  const startLabel = formatDateOnly(startIso);
  const endLabel = formatDateOnly(endIso);
  switch (zoom) {
    case "roadmap":
      return `Roadmap · ${startLabel} → ${endLabel}`;
    case "month":
      return `Mese · ${startLabel} → ${endLabel}`;
    case "week":
      return `Settimana · ${startLabel} → ${endLabel}`;
    case "sprint-focus":
    default:
      return `Sprint focus · ${startLabel} → ${endLabel}`;
  }
}

function getLatestTaskEventByKinds(
  lane: SprintTimelineLane,
  kinds: SprintTimelineEventKind[],
): SprintTimelineEvent | undefined {
  return sortEvents(lane.events)
    .filter((event) => kinds.includes(event.kind))
    .slice(-1)[0];
}

export function sortEvents(events: SprintTimelineEvent[]) {
  return [...events].sort((a, b) => {
    if (a.dateIndex !== b.dateIndex) return a.dateIndex - b.dateIndex;
    const aTime = parseDateTime(a.date)?.getTime() ?? 0;
    const bTime = parseDateTime(b.date)?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.title.localeCompare(b.title);
  });
}

export function formatDateOnly(value?: string) {
  if (!value) return "—";
  return formatWithIntl(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = parseDateTime(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatElapsedDays(days: number, completed?: boolean) {
  if (!days) return completed ? "chiuso oggi" : "oggi";
  if (days === 1) return completed ? "1 giorno" : "da 1 giorno";
  return completed ? `${days} giorni` : `da ${days} giorni`;
}

export function getSignalLabel(signal?: TimelineSemaforo) {
  switch (signal) {
    case "gray":
      return "Pianificato";
    case "blue":
      return "In corso";
    case "yellow":
      return "Checkpoint aperti";
    case "orange":
      return "A rischio";
    case "red":
      return "Bloccato";
    case "purple":
      return "In validazione";
    case "green":
      return "Completato";
    case "teal":
      return "Informativo";
    default:
      return "Operativo";
  }
}

/**
 * Genera il titolo standardizzato per un evento della timeline.
 * Formato: "NOME TASK | TIPO EVENTO | NOME / ESITO"
 */
export function getEventTitle(taskTitle: string, kind: SprintTimelineEventKind, actionOrCustomNature?: string): string {
  const kindLabel = getEventKindLabel(kind);
  const actionLabel =
    actionOrCustomNature?.trim() ||
    (() => {
      switch (kind) {
        case "planned-start":
          return "Pianificato";
        case "expected-completion":
          return "Pianificata";
        case "start":
          return "Avviato oggi";
        case "reopen":
          return "Riaperto";
        case "checkpoint":
          return "Operativo";
        case "completion-update":
        case "completion":
          return "Completato";
        case "block-update":
        case "task-block":
          return "Bloccato";
        case "validation":
          return "Richiesta";
        case "note":
        default:
          return "Nota";
      }
    })();

  return `${taskTitle.trim()} | ${kindLabel} | ${actionLabel}`;
}

export function getEventKindLabel(kind: SprintTimelineEventKind) {
  switch (kind) {
    case "planned-start":
      return "Avvio atteso";
    case "start":
      return "Presa in carico";
    case "checkpoint":
      return "Checkpoint";
    case "completion-update":
      return "Checkpoint chiuso";
    case "block-update":
      return "Checkpoint bloccato";
    case "expected-completion":
      return "Conclusione attesa";
    case "validation":
      return "Validazione";
    case "completion":
      return "Chiusura task";
    case "task-block":
      return "Blocco task";
    case "reopen":
      return "Riapertura";
    case "note":
      return "Nota";
    default:
      return kind;
  }
}

export function getValidationStatusLabel(event?: SprintTimelineEvent | null) {
  if (!event || event.kind !== "validation") return "";
  if (event.validationState === "requested") return "Richiesta validazione";
  if (event.validationResult === "approved") return "Validazione approvata";
  if (event.validationResult === "rejected") return "Validazione respinta";
  return "Validazione";
}

export function isValidationRequested(event?: SprintTimelineEvent | null) {
  return event?.kind === "validation" && event.validationState === "requested";
}

export function isValidationDecided(event?: SprintTimelineEvent | null) {
  return event?.kind === "validation" && event.validationState === "decided";
}

export function getTaskTypeLabel(taskType?: SprintTaskType) {
  return TASK_TYPE_OPTIONS.find((item) => item.value === taskType)?.label || taskType || "Task";
}

export function getPriorityMeta(priority?: SprintTaskPriority) {
  switch (priority) {
    case "urgent":
      return {
        label: "Urgent",
        accentClass: "from-rose-500 via-red-500 to-orange-500",
        surfaceClass:
          "border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200 dark:border-rose-400/30",
      };
    case "high":
      return {
        label: "High",
        accentClass: "from-fuchsia-500 via-violet-500 to-sky-500",
        surfaceClass:
          "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-200 dark:border-fuchsia-400/30",
      };
    case "low":
      return {
        label: "Low",
        accentClass: "from-slate-500 via-slate-400 to-slate-300",
        surfaceClass:
          "border-slate-400/25 bg-slate-500/10 text-slate-700 dark:text-slate-200 dark:border-slate-400/30",
      };
    case "medium":
    default:
      return {
        label: "Medium",
        accentClass: "from-amber-400 via-orange-400 to-yellow-400",
        surfaceClass:
          "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200 dark:border-amber-400/30",
      };
  }
}

export function getSemaforoAccentClass(signal?: TimelineSemaforo) {
  switch (signal) {
    case "green":
      return "from-emerald-500 via-emerald-400 to-teal-300";
    case "yellow":
      return "from-amber-400 via-yellow-300 to-orange-300";
    case "orange":
      return "from-orange-500 via-amber-400 to-yellow-300";
    case "red":
      return "from-rose-500 via-red-500 to-orange-400";
    case "blue":
      return "from-sky-500 via-cyan-400 to-blue-400";
    case "purple":
      return "from-violet-500 via-purple-500 to-fuchsia-500";
    case "teal":
      return "from-teal-500 via-cyan-400 to-sky-400";
    case "gray":
    default:
      return "from-slate-500 via-slate-400 to-slate-300";
  }
}

export function getSemaforoDotClasses(signal?: TimelineSemaforo) {
  switch (signal) {
    case "green":
      return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]";
    case "yellow":
      return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]";
    case "orange":
      return "bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.45)]";
    case "red":
      return "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.45)]";
    case "blue":
      return "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.45)]";
    case "purple":
      return "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.45)]";
    case "teal":
      return "bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.45)]";
    case "gray":
    default:
      return "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.30)]";
  }
}

export function getSemaforoSurfaceClasses(signal?: TimelineSemaforo) {
  switch (signal) {
    case "green":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 dark:border-emerald-400/30";
    case "yellow":
      return "border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200 dark:border-amber-400/30";
    case "orange":
      return "border-orange-400/25 bg-orange-500/10 text-orange-700 dark:text-orange-200 dark:border-orange-400/30";
    case "red":
      return "border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200 dark:border-rose-400/30";
    case "blue":
      return "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200 dark:border-sky-400/30";
    case "purple":
      return "border-violet-400/25 bg-violet-500/10 text-violet-700 dark:text-violet-200 dark:border-violet-400/30";
    case "teal":
      return "border-teal-400/25 bg-teal-500/10 text-teal-700 dark:text-teal-200 dark:border-teal-400/30";
    case "gray":
    default:
      return "border-slate-400/25 bg-slate-500/10 text-slate-700 dark:text-slate-200 dark:border-slate-400/30";
  }
}

export function getSemaforoClasses(signal?: TimelineSemaforo) {
  switch (signal) {
    case "green":
      return "border-emerald-300 bg-emerald-400/90 text-white";
    case "yellow":
      return "border-amber-300 bg-amber-300/95 text-slate-950";
    case "orange":
      return "border-orange-300 bg-orange-400/95 text-white";
    case "red":
      return "border-rose-300 bg-rose-400/95 text-white";
    case "blue":
      return "border-sky-300 bg-sky-400/95 text-white";
    case "purple":
      return "border-violet-300 bg-violet-500/90 text-white";
    case "teal":
      return "border-teal-300 bg-teal-400/95 text-white";
    case "gray":
    default:
      return "border-slate-400 bg-slate-400/90 text-white";
  }
}

export function getSprintArrowTone(index: number) {
  const tones = [
    "border-cyan-300/35 bg-[linear-gradient(90deg,rgba(6,182,212,0.95),rgba(14,165,233,0.88),rgba(99,102,241,0.92))] text-white",
    "border-violet-300/35 bg-[linear-gradient(90deg,rgba(124,58,237,0.95),rgba(168,85,247,0.92),rgba(236,72,153,0.90))] text-white",
    "border-emerald-300/35 bg-[linear-gradient(90deg,rgba(5,150,105,0.96),rgba(16,185,129,0.90),rgba(59,130,246,0.88))] text-white",
    "border-amber-300/35 bg-[linear-gradient(90deg,rgba(245,158,11,0.96),rgba(249,115,22,0.92),rgba(239,68,68,0.90))] text-white",
  ];
  return tones[index % tones.length];
}

export function getChecklistProgress(event?: SprintTimelineEvent | null) {
  const total = event?.checklist?.length ?? 0;
  const done = event?.checklist?.filter((item) => item.done).length ?? 0;
  return { total, done };
}


export function isSystemCheckpoint(event?: SprintTimelineEvent | null) {
  return !!(event && event.kind === "checkpoint" && event.systemCheckpointType);
}

export function isOperationalCheckpoint(event?: SprintTimelineEvent | null) {
  return !!(event && event.kind === "checkpoint" && !event.systemCheckpointType);
}

export function isExpectedSystemCheckpoint(event?: SprintTimelineEvent | null) {
  return event?.systemCheckpointType === "expected-completion";
}

export function isPlannedStartSystemCheckpoint(event?: SprintTimelineEvent | null) {
  return event?.systemCheckpointType === "planned-start";
}

export function isTakenOverSystemCheckpoint(event?: SprintTimelineEvent | null) {
  return event?.systemCheckpointType === "taken-over";
}

export function getEventChainId(event?: SprintTimelineEvent | null) {
  if (!event) return "";
  return event.chainId || event.sourceEventId || event.id;
}

export function getLaneChainEvents(lane: SprintTimelineLane, chainId: string) {
  return sortEvents(
    lane.events.filter((event) => {
      const eventChainId = getEventChainId(event);
      return eventChainId === chainId;
    }),
  );
}

export function isCheckpointReadyForCompletion(event?: SprintTimelineEvent | null) {
  if (!isOperationalCheckpoint(event)) return false;
  const checklist = event?.checklist ?? [];
  if (!checklist.length) return true;
  return checklist.every((item) => item.done);
}

export function isCheckpointBlockReadyForResolution(event?: SprintTimelineEvent | null) {
  if (!event || event.kind !== "block-update") return false;
  const checklist = event.checklist ?? [];
  if (!checklist.length) return true;
  return checklist.every((item) => item.done);
}

export function isTaskBlockReadyForResolution(event?: SprintTimelineEvent | null) {
  if (!event || event.kind !== "task-block") return false;
  const checklist = event.checklist ?? [];
  if (!checklist.length) return true;
  return checklist.every((item) => item.done);
}

export function getLastReopenIndex(lane: SprintTimelineLane) {
  return getLatestTaskEventByKinds(lane, ["reopen"])?.dateIndex ?? -1;
}

function getCurrentCycleEvents(lane: SprintTimelineLane) {
  const events = sortEvents(lane.events);
  const lastReopenPosition = [...events]
    .map((event) => event.kind)
    .lastIndexOf("reopen");

  if (lastReopenPosition < 0) return events;
  return events.slice(lastReopenPosition + 1);
}

export function getLatestValidationEvent(lane: SprintTimelineLane) {
  return getCurrentCycleEvents(lane)
    .filter((event) => event.kind === "validation")
    .slice(-1)[0];
}

export function getCurrentCycleCheckpointBases(lane: SprintTimelineLane) {
  return getCurrentCycleEvents(lane).filter((event) => isOperationalCheckpoint(event));
}

function getCheckpointChainStateEvents(lane: SprintTimelineLane, chainId: string) {
  return getLaneChainEvents(lane, chainId).filter((event) =>
    ["block-update", "completion-update"].includes(event.kind),
  );
}

export function getLatestCheckpointCompletionIndex(lane: SprintTimelineLane) {
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

export function getValidationRequestIndex(
  lane: SprintTimelineLane,
  todayIndex: number,
) {
  const latestCompletionIndex = getLatestCheckpointCompletionIndex(lane);
  if (latestCompletionIndex === null) return todayIndex + 1;
  return latestCompletionIndex + 1;
}

export function getCheckpointChainStatus(
  lane: SprintTimelineLane,
  chainId: string,
): "open" | "blocked" | "completed" {
  const latestState = getCheckpointChainStateEvents(lane, chainId).slice(-1)[0];
  if (!latestState) return "open";
  if (latestState.kind === "block-update") return "blocked";
  if (latestState.kind === "completion-update") return "completed";
  return "open";
}

export function getEventDisplaySignal(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent,
  todayIndex: number,
): TimelineSemaforo {
  switch (event.kind) {
    case "planned-start":
      return "gray";
    case "start":
    case "reopen":
      return "blue";
    case "checkpoint":
      if (event.systemCheckpointType === "planned-start") return "gray";
      if (event.systemCheckpointType === "expected-completion") return "orange";
      if (event.systemCheckpointType === "taken-over") return "blue";
      return "yellow";
    case "completion-update":
    case "completion":
      return "green";
    case "expected-completion":
      return "orange";
    case "block-update":
    case "task-block":
      return "red";
    case "validation":
      return "purple";
    case "note":
    default: {
      const chainId = getEventChainId(event);
      if (event.kind === "note" && chainId) {
        const status = getCheckpointChainStatus(lane, chainId);
        if (status === "blocked") return "red";
        if (status === "completed") return "green";
      }
      if (event.kind === "note") return "teal";
      if (event.dateIndex > todayIndex) return "gray";
      // Le note non devono ereditare l'arancione del task per non confondere con la scadenza
      return "blue";
    }
  }
}

export function getLaneFirstRelevantIndex(lane: SprintTimelineLane) {
  const indexes = lane.events.map((event) => event.dateIndex);
  return indexes.length ? Math.min(...indexes) : 0;
}

export function getLaneEffectiveEndIndex(lane: SprintTimelineLane, totalUnits: number) {
  const eventMax = lane.events.length ? Math.max(...lane.events.map((event) => event.dateIndex)) : 0;
  const computed = typeof lane.lineEndIndex === "number" ? lane.lineEndIndex : eventMax;
  return clamp(computed, 0, Math.max(0, totalUnits - 1));
}

function getSegmentToneForEvent(lane: SprintTimelineLane, event: SprintTimelineEvent): TimelineSemaforo {
  switch (event.kind) {
    case "planned-start":
      return "gray";
    case "start":
    case "reopen":
      return "blue";
    case "checkpoint":
      if (event.systemCheckpointType === "planned-start") return "gray";
      if (event.systemCheckpointType === "expected-completion") return "orange";
      if (event.systemCheckpointType === "taken-over") return "blue";
      return "yellow";
    case "completion-update":
    case "completion":
      return "green";
    case "expected-completion":
      return "orange";
    case "block-update":
    case "task-block":
      return "red";
    case "validation":
      return "purple";
    case "note":
    default:
      // Per i segmenti visuali (barre), manteniamo la logica di derivazione dello stato della lane
      return deriveLaneState(lane, event.dateIndex).signal;
  }
}

export function buildLaneVisualSegments(
  lane: SprintTimelineLane,
  totalUnits: number,
  todayIndex: number,
): SprintTimelineSegmentVisual[] {
  const effectiveEnd = getLaneEffectiveEndIndex(lane, totalUnits);
  const events = sortEvents(lane.events).filter((event) => event.kind !== "note");
  if (!events.length) return [];

  const segments: SprintTimelineSegmentVisual[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    const next = events[index + 1];
    const startIndex = current.dateIndex;
    const endIndex = next ? Math.max(next.dateIndex + 1, current.dateIndex + 1) : current.dateIndex + 1;
    segments.push({
      startIndex,
      endIndex,
      tone: getSegmentToneForEvent(lane, current),
      dashed:
        (current.kind === "validation" && current.validationState === "requested") ||
        current.kind === "expected-completion" || current.systemCheckpointType === "expected-completion",
      label: current.title,
      description:
        current.kind === "validation" && current.validationState === "requested"
          ? "Richiesta validazione"
          : current.kind === "expected-completion" || current.systemCheckpointType === "expected-completion"
            ? "Attesa chiusura task"
            : getEventKindLabel(current.kind),
    });
  }

  // I segmenti arancioni (Ritardo / Chiusura Attesa) sono stati rimossi 
  // su richiesta per mantenere solo il marker DASHED SOPRA la linea.
  // La mappatura degli eventi reali 'expected-completion' garantisce la visibilità della scadenza.
  
  const lastRealEvent = events.slice(-1)[0];
  if (!lastRealEvent) return segments;

  const projectionStart = Math.min(effectiveEnd + 1, Math.max(lastRealEvent.dateIndex + 1, 0));
  const projectionTone = getSegmentToneForEvent(lane, lastRealEvent);

  if (projectionStart <= effectiveEnd && projectionTone !== "green") {
    segments.push({
      startIndex: projectionStart,
      endIndex: effectiveEnd + 1,
      tone: projectionTone,
      dashed: true,
      label: "Proiezione",
      description: "Tratto futuro costruito dall'ultimo stato operativo utile.",
    });
  }

  return segments;
}

export function deriveLaneState(
  lane: SprintTimelineLane,
  todayIndex: number,
  viewer?: SprintTimelineViewer,
): SprintTimelineDerivedLaneState {
  const events = sortEvents(lane.events);
  const checkpointBases = getCurrentCycleCheckpointBases(lane);
  const uniqueCheckpointIds = Array.from(new Set(checkpointBases.map((event) => getEventChainId(event))));
  const statuses = uniqueCheckpointIds.map((chainId) => getCheckpointChainStatus(lane, chainId));

  const openCheckpointCount = statuses.filter((status) => status === "open").length;
  const blockedCheckpointCount = statuses.filter((status) => status === "blocked").length;
  const completedCheckpointCount = statuses.filter((status) => status === "completed").length;

  const latestCompletion = getLatestTaskEventByKinds(lane, ["completion"]);
  const latestReopen = getLatestTaskEventByKinds(lane, ["reopen"]);
  const latestTaskBlock = getLatestTaskEventByKinds(lane, ["task-block"]);
  const latestValidation = getLatestValidationEvent(lane);
  const latestStartLike = getLatestTaskEventByKinds(lane, ["start", "reopen"]);
  const latestExpectedCompletion = sortEvents(lane.events).filter((event) => event.kind === "expected-completion" || event.systemCheckpointType === "expected-completion").slice(-1)[0];

  const latestCompletionIndex = latestCompletion?.dateIndex ?? -1;
  const latestReopenIndex = latestReopen?.dateIndex ?? -1;
  const latestTaskBlockIndex = latestTaskBlock?.dateIndex ?? -1;
  const expectedIndex = latestExpectedCompletion?.dateIndex ?? -1;

  const allCurrentCycleCheckpointsCompleted =
    uniqueCheckpointIds.length > 0 &&
    uniqueCheckpointIds.every((chainId) => getCheckpointChainStatus(lane, chainId) === "completed");

  const hasPendingValidationWindow =
    allCurrentCycleCheckpointsCompleted &&
    (!latestValidation || latestValidation.validationState !== "decided");

  let signal: TimelineSemaforo = "gray";

  if (latestCompletionIndex > latestReopenIndex) {
    signal = "green";
  } else if (blockedCheckpointCount > 0 || latestTaskBlockIndex > latestReopenIndex) {
    signal = "red";
  } else if (
    latestValidation?.validationState === "requested" ||
    hasPendingValidationWindow
  ) {
    signal = "purple";
  } else if (expectedIndex >= 0 && todayIndex > expectedIndex) {
    signal = "orange";
  } else if (openCheckpointCount > 0) {
    signal = "yellow";
  } else if (latestStartLike) {
    signal = "blue";
  } else if (events.some((event) => event.kind === "note")) {
    signal = "teal";
  } else if (events.some((event) => event.kind === "planned-start" || event.systemCheckpointType === "planned-start")) {
    signal = "gray";
  }

  const firstRelevant =
    events.find((event) => ["planned-start", "start", "reopen"].includes(event.kind) || event.systemCheckpointType === "planned-start") || events[0];
  
  const elapsedDays = firstRelevant
    ? Math.max(
      0,
      (signal === "green" ? latestCompletion?.dateIndex ?? todayIndex : todayIndex) -
      firstRelevant.dateIndex,
    )
    : 0;

  const daysRemaining = (expectedIndex >= 0 && !latestCompletion) 
    ? expectedIndex - todayIndex 
    : null;

  const actionableEvents = events.filter((event) => {
    if (event.kind === "validation") {
      return isValidationActionableByUser(event, viewer);
    }

    if (event.kind === "block-update" || event.kind === "task-block") {
      return isEventActionableByUser(event, viewer);
    }

    if (!isOperationalCheckpoint(event)) return false;
    return (
      getCheckpointChainStatus(lane, getEventChainId(event)) === "open" &&
      isEventActionableByUser(event, viewer)
    );
  });

  const viewerNeedsToAct = actionableEvents.length > 0;

  return {
    signal,
    stateLabel: getSignalLabel(signal),
    openCheckpointCount,
    blockedCheckpointCount,
    completedCheckpointCount,
    elapsedDays,
    daysRemaining,
    viewerNeedsToAct,
    expectedEndIndex: expectedIndex >= 0 ? expectedIndex : undefined,
  };
}

export function getSelectedLane(data: SprintTimelineBoardData, selection: SprintTimelineSelection) {
  if (!selection) return null;
  return data.lanes.find((lane) => lane.id === selection.laneId) ?? null;
}

export function getSelectedEvent(data: SprintTimelineBoardData, selection: SprintTimelineSelection) {
  if (!selection || selection.kind !== "event") return null;
  const lane = getSelectedLane(data, selection);
  return lane?.events.find((event) => event.id === selection.eventId) ?? null;
}

export function getIsoDateForUnitIndex(sprintStartDate?: string, unitIndex = 0) {
  const start = parseDateOnly(sprintStartDate);
  if (!start) return "";
  const next = addUtcDays(start, unitIndex);
  return next.toISOString().slice(0, 10);
}

export function getUnitIndexForIsoDate(sprintStartDate?: string, isoDate?: string) {
  const start = parseDateOnly(sprintStartDate);
  const date = parseDateOnly(isoDate);
  if (!start || !date) return 0;
  return Math.max(0, Math.round((date.getTime() - start.getTime()) / DAY_MS));
}

export function getTodayUnitIndex(sprintStartDate?: string, sprintEndDate?: string) {
  const start = parseDateOnly(sprintStartDate);
  const end = parseDateOnly(sprintEndDate);
  if (!start || !end) return null;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const today = parseDateOnly(todayIso);
  if (!today) return null;
  if (today.getTime() < start.getTime()) return 0;
  if (today.getTime() > end.getTime()) {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  }
  return Math.round((today.getTime() - start.getTime()) / DAY_MS);
}

export function getTodayLabelForToolbar(sprintStartDate?: string, sprintEndDate?: string) {
  const start = parseDateOnly(sprintStartDate);
  const end = parseDateOnly(sprintEndDate);
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const today = parseDateOnly(todayIso);
  if (!today) return "oggi";

  if (start && today.getTime() < start.getTime()) return `inizio sprint · ${formatDateOnly(sprintStartDate)}`;
  if (end && today.getTime() > end.getTime()) return `fine sprint · ${formatDateOnly(sprintEndDate)}`;
  return `oggi · ${formatDateOnly(todayIso)}`;
}

export function countActiveFilters(filters: SprintTimelineFilters) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.signal) count += 1;
  if (filters.taskType) count += 1;
  if (filters.ownerOnly) count += 1;
  return count;
}

export function getViewportTodayX(viewport: SprintTimelineViewport, todayIndex: number | null) {
  if (todayIndex === null || todayIndex < viewport.startIndex || todayIndex >= viewport.endIndex) return null;
  return getUnitX(viewport.columns, viewport.unitWidth, todayIndex, "center");
}

export function getUnitX(
  columns: SprintTimelineColumn[],
  unitWidth: number,
  unitIndex: number,
  align: "start" | "center" | "end",
) {
  if (!columns.length) return 0;
  const startIndex = columns[0]?.centerIndex ?? 0;
  const offset = unitIndex - startIndex;
  const base = offset * unitWidth;
  if (align === "start") return base;
  if (align === "end") return base + unitWidth;
  return base + unitWidth / 2;
}

export function getDefaultSprintFocusWindow(data: SprintTimelineBoardData, todayIndex: number) {
  const base = Math.min(data.totalUnits, 18);
  if (todayIndex <= 4 || todayIndex >= data.totalUnits - 5) {
    return Math.min(data.totalUnits, 16);
  }
  return base;
}

export function buildTimelineViewport(
  data: SprintTimelineBoardData,
  zoom: SprintTimelineZoom,
  anchorIndex: number,
  todayIndex: number,
  focusWindow: number,
  isCompact = false,
): SprintTimelineViewport {
  const totalUnits = data.totalUnits;
  const viewportSize = getViewportWindowSize(zoom, totalUnits, focusWindow);
  const unitWidth = getViewportUnitWidth(zoom, isCompact);

  let startIndex = 0;
  if (zoom !== "roadmap") {
    const halfWindow = Math.floor(viewportSize / 2);
    startIndex = clamp(anchorIndex - halfWindow, 0, Math.max(0, totalUnits - viewportSize));
  }

  if (zoom !== "roadmap" && todayIndex >= 0 && totalUnits > 0 && anchorIndex === todayIndex) {
    const normalized = clamp(todayIndex, 0, Math.max(0, totalUnits - 1));
    const halfWindow = Math.floor(viewportSize / 2);
    startIndex = clamp(normalized - halfWindow, 0, Math.max(0, totalUnits - viewportSize));
  }

  const endIndex = Math.min(totalUnits, startIndex + viewportSize);
  const columns = Array.from({ length: endIndex - startIndex }, (_, offset) =>
    createDayColumn(data.sprint.startDate?.slice(0, 10), startIndex + offset),
  );
  const rangeStart = getIsoDateForUnitIndex(data.sprint.startDate?.slice(0, 10), startIndex);
  const rangeEnd = getIsoDateForUnitIndex(data.sprint.startDate?.slice(0, 10), Math.max(startIndex, endIndex - 1));

  return {
    zoom,
    startIndex,
    endIndex,
    unitWidth,
    columns,
    title: getViewportTitle(rangeStart, rangeEnd, zoom),
  };
}

export function shiftViewportAnchor(
  data: SprintTimelineBoardData,
  zoom: SprintTimelineZoom,
  current: number,
  direction: -1 | 1,
  focusWindow: number,
) {
  const step =
    zoom === "roadmap"
      ? 7
      : zoom === "month"
        ? 14
        : zoom === "week"
          ? 7
          : Math.max(7, Math.floor(focusWindow / 2));
  return clamp(current + direction * step, 0, Math.max(0, data.totalUnits - 1));
}

export function isUserInvolvedInLane(lane: SprintTimelineLane, viewer: SprintTimelineViewer | undefined) {
  if (!lane || !viewer) return false;
  if (lane.viewerIsParticipant) return true;
  if (isTaskOwner(lane, viewer)) return true;
  if (isTaskReferente(lane, viewer)) return true;
  return lane.events.some(event => isEventActionableByUser(event, viewer) || isValidationActionableByUser(event, viewer));
}

export function isUserReviewerOfLane(lane: SprintTimelineLane, viewer: SprintTimelineViewer | undefined) {
  if (!lane || !viewer) return false;
  if (viewer.userId && (lane.referenteId === viewer.userId || lane.referenteUserIds?.includes(viewer.userId))) return true;
  if (viewer.userName) {
    const nv = viewer.userName.trim().toLowerCase();
    const rn = lane.referenteName?.trim().toLowerCase();
    if (rn && (nv === rn || nv.includes(rn) || rn.includes(nv))) return true;
  }
  return false;
}

export function filterTimelineLanes(
  lanes: SprintTimelineLane[],
  filters: SprintTimelineFilters,
  viewer: SprintTimelineViewer | undefined,
  todayIndex: number,
) {
  const normalizedQuery = filters.query.trim().toLowerCase();
  return lanes.filter((lane) => {
    // Gestione visibilità
    if (filters.visibilityMode === "mine") {
      if (!isUserInvolvedInLane(lane, viewer)) return false;
    } else if (filters.visibilityMode === "reviewer") {
      if (!isUserReviewerOfLane(lane, viewer)) return false;
    }

    if (filters.taskType && lane.taskType !== filters.taskType) return false;
    if (filters.signal && deriveLaneState(lane, todayIndex).signal !== filters.signal) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      lane.title,
      lane.subtitle,
      lane.description,
      lane.objectives,
      lane.ownerName,
      lane.referenteName,
      lane.priority,
      lane.taskType,
      ...lane.events.flatMap((event) => [
        event.title,
        event.note,
        event.decisionNote,
        getEventKindLabel(event.kind),
        getValidationStatusLabel(event),
        ...(event.participants?.map((item) => item.name) ?? []),
        ...(event.validators?.map((item) => item.name) ?? []),
        ...(event.checklist?.map((item) => item.label) ?? []),
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function sortTimelineLanes(lanes: SprintTimelineLane[], todayIndex: number, viewer?: SprintTimelineViewer) {
  return [...lanes].sort((a, b) => {
    const aState = deriveLaneState(a, todayIndex, viewer);
    const bState = deriveLaneState(b, todayIndex, viewer);
    const stateDiff = severity(aState.signal) - severity(bState.signal);
    if (stateDiff !== 0) return stateDiff;

    const aEnd = a.lineEndIndex ?? Number.MAX_SAFE_INTEGER;
    const bEnd = b.lineEndIndex ?? Number.MAX_SAFE_INTEGER;
    if (aEnd !== bEnd) return aEnd - bEnd;

    return a.title.localeCompare(b.title);
  });
}

export function filterLanesBySegment(
  lanes: SprintTimelineLane[],
  selectedSegment: SprintTimelineSegment | null,
  totalUnits: number,
) {
  if (!selectedSegment) return lanes;
  return lanes.filter((lane) => {
    const start = getLaneFirstRelevantIndex(lane);
    const end = getLaneEffectiveEndIndex(lane, totalUnits);
    return end >= selectedSegment.startIndex && start < selectedSegment.endIndex;
  });
}

export function getSprintSegmentForIndex(segments: SprintTimelineSegment[], unitIndex: number) {
  return segments.find(
    (segment) => unitIndex >= segment.startIndex && unitIndex < segment.endIndex,
  ) ?? null;
}

export function getDateInputMin(sprintStartDate?: string, sprintEndDate?: string) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const today = parseDateOnly(todayIso);
  const sprintStart = parseDateOnly(sprintStartDate);
  const sprintEnd = parseDateOnly(sprintEndDate);
  if (!today) return sprintStartDate?.slice(0, 10) || "";
  if (sprintEnd && today.getTime() > sprintEnd.getTime()) return sprintEndDate?.slice(0, 10) || todayIso;
  if (sprintStart && today.getTime() < sprintStart.getTime()) return sprintStartDate?.slice(0, 10) || todayIso;
  return todayIso;
}

export function buildDateInputMeta(args: {
  sprintStartDate?: string;
  segments?: SprintTimelineSegment[];
  isoDate?: string;
}) {
  const unitIndex = getUnitIndexForIsoDate(args.sprintStartDate, args.isoDate);
  const segment = getSprintSegmentForIndex(args.segments ?? [], unitIndex);
  return {
    unitIndex,
    segmentLabel: segment?.label ?? "fuori sprint",
  };
}
