import type {
  SprintTimelineEvent,
  SprintTimelineEventKind,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

const ALLOWED_TIMELINE_EVENT_KINDS: SprintTimelineEventKind[] = [
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

export function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
}

export function dateOnly(value?: string | null): string | undefined {
  return normalizeIsoDate(value)?.slice(0, 10);
}

export function getDateIndex(
  sprintStartDate?: string,
  isoDateTime?: string | null,
): number {
  const start = dateOnly(sprintStartDate);
  const current = dateOnly(isoDateTime);
  if (!start || !current) return 0;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${current}T00:00:00`);
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

export function getIsoDateForUnitIndex(
  sprintStartDate?: string,
  unitIndex = 0,
): string {
  const start = dateOnly(sprintStartDate);
  if (!start) return "";

  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + unitIndex);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildEventDateFromUnitIndex(
  sprintStartDate?: string,
  unitIndex = 0,
  time = "09:00:00",
): string {
  const isoDay = getIsoDateForUnitIndex(sprintStartDate, unitIndex);
  return isoDay ? `${isoDay}T${time}` : new Date().toISOString();
}

function getLocalIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getCurrentLocalTimeString(offsetSeconds = 0) {
  const now = new Date();
  if (offsetSeconds) {
    now.setSeconds(now.getSeconds() + offsetSeconds);
  }

  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

export function getTodayIndexFromSprintStart(sprintStartDate?: string) {
  return getDateIndex(sprintStartDate, `${getLocalIsoDate()}T12:00:00`);
}

export function normalizeEventKind(raw?: string): SprintTimelineEventKind {
  if (raw && ALLOWED_TIMELINE_EVENT_KINDS.includes(raw as SprintTimelineEventKind)) {
    return raw as SprintTimelineEventKind;
  }

  return "note";
}

export function sortEvents(events: SprintTimelineEvent[]) {
  return [...events].sort((a, b) => {
    if (a.dateIndex !== b.dateIndex) return a.dateIndex - b.dateIndex;
    const aTime = a.date || "";
    const bTime = b.date || "";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.title.localeCompare(b.title);
  });
}
