"use client";

import type { EventoFull } from "@/components/Store/models/eventi";

import type {
  SprintTimelineEventKind,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

export const TIMELINE_KIND_FIELD = "tipoTimelineTask";
export const TIMELINE_CHAIN_ID_FIELD = "chainIdTimelineTask";
export const TIMELINE_SOURCE_EVENT_ID_FIELD = "sourceEventIdTimelineTask";
export const TIMELINE_ACTORS_FIELD = "attoriTimelineTask";
export const TIMELINE_PAYLOAD_FIELD = "payloadTimelineTask";

// fallback compatibilita' con dati gia' salvati prima del refactor rigoroso
export const TIMELINE_LEGACY_PAYLOAD_FIELD = "timelinePayload";

export type TimelineChecklistItemCodec = {
  id: string;
  label: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
};

export type TimelinePayloadCodec = {
  kind?: SprintTimelineEventKind;
  chainId?: string;
  sourceEventId?: string;
  createdByValidationId?: string;

  participants?: string[];
  validators?: string[];
  checklist?: TimelineChecklistItemCodec[];

  validationState?: "requested" | "decided";
  validationResult?: "approved" | "rejected" | "pending";
  decisionLocked?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;

  completionDays?: number;
  delayDays?: number;
  color?: string;
  systemCheckpointType?: "planned-start" | "expected-completion" | "taken-over";
};

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseTimelinePayload(raw: unknown): TimelinePayloadCodec {
  if (!raw || typeof raw !== "string") return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TimelinePayloadCodec;
  } catch {
    return {};
  }
}

export function stringifyTimelinePayload(payload: TimelinePayloadCodec): string {
  return JSON.stringify(payload ?? {});
}

export function getTimelinePayloadRaw(
  data?: Record<string, any>,
): string | undefined {
  return (
    asString(data?.[TIMELINE_PAYLOAD_FIELD]) ||
    asString(data?.[TIMELINE_LEGACY_PAYLOAD_FIELD])
  );
}

export function getTimelinePayloadFromEvento(
  evento?: Pick<EventoFull, "data"> | null,
): TimelinePayloadCodec {
  return parseTimelinePayload(getTimelinePayloadRaw(evento?.data));
}

export function getTimelineActorsDisplay(payload: TimelinePayloadCodec): string {
  const uniqueNames = Array.from(
    new Set(
      [...(payload.participants ?? []), ...(payload.validators ?? [])]
        .map((item) => item?.trim())
        .filter(Boolean),
    ),
  );

  return uniqueNames.join(", ");
}

export function buildTimelinePayloadCodec(args: {
  kind: SprintTimelineEventKind;
  chainId?: string;
  sourceEventId?: string;
  createdByValidationId?: string;
  participants?: string[];
  validators?: string[];
  checklist?: TimelineChecklistItemCodec[];
  validationState?: "requested" | "decided";
  validationResult?: "approved" | "rejected" | "pending";
  decisionLocked?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  completionDays?: number;
  delayDays?: number;
  color?: string;
  systemCheckpointType?: "planned-start" | "expected-completion" | "taken-over";
}): TimelinePayloadCodec {
  return {
    kind: args.kind,
    chainId: args.chainId,
    sourceEventId: args.sourceEventId,
    createdByValidationId: args.createdByValidationId,
    participants: args.participants,
    validators: args.validators,
    checklist: args.checklist,
    validationState: args.validationState,
    validationResult: args.validationResult,
    decisionLocked: args.decisionLocked,
    decidedBy: args.decidedBy,
    decidedAt: args.decidedAt,
    decisionNote: args.decisionNote,
    completionDays: args.completionDays,
    delayDays: args.delayDays,
    color: args.color,
    systemCheckpointType: args.systemCheckpointType,
  };
}

export function buildTimelineEventData(args: {
  title: string;
  note?: string;
  stato?: string;
  priorita?: string;
  payload: TimelinePayloadCodec;
}) {
  const payloadString = stringifyTimelinePayload(args.payload);

  return {
    titolo: args.title,
    descrizione: args.note || "",
    stato: args.stato || "programmato",
    priorita: args.priorita || "normal",

    [TIMELINE_KIND_FIELD]: args.payload.kind || "",
    [TIMELINE_CHAIN_ID_FIELD]: args.payload.chainId || "",
    [TIMELINE_SOURCE_EVENT_ID_FIELD]: args.payload.sourceEventId || "",
    [TIMELINE_ACTORS_FIELD]: getTimelineActorsDisplay(args.payload),
    [TIMELINE_PAYLOAD_FIELD]: payloadString,

    [TIMELINE_LEGACY_PAYLOAD_FIELD]: payloadString,
  };
}
