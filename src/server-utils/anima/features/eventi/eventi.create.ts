import { getEventiList } from "@/config/eventi.registry";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import { createEvento } from "@/server-utils/service/eventiQuery";
import { hasPermission } from "@/server-utils/access/access-engine";
import type { TimeKind } from "@/server-utils/models/evento.schema";
import {
  resolveEventType,
  type EventTypeMatch,
  type EventTypeResolverMode,
} from "./eventi.typeResolver";
import {
  hasInvalidIntervalRange,
  parseCreateTimeWindow,
  parseRawNotes,
  parseRawTitle,
} from "./eventi.time";
import type { PendingCreateState } from "@/server-utils/anima/memory/sessionState";
import { resolveActionFieldState } from "@/server-utils/anima/core/actionSchemas";

export type EventCreateIntent = {
  type: "event_create";
  payload: {
    eventType?: EventTypeMatch | null;
    title?: string;
    notes?: string | null;
    startAt?: string;
    endAt?: string | null;
    timeKind?: TimeKind;
  };
  missing: string[];
  debug: {
    resolverMode: EventTypeResolverMode;
    timeMissingDate?: boolean;
    invalidInterval?: boolean;
    timeWindow?: {
      startHour?: number;
      startMinute?: number;
      endHour?: number;
      endMinute?: number;
    };
  };
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCreateTitle(
  message: string,
): string | undefined {
  const explicit = parseRawTitle(message);
  if (explicit) return explicit;

  return undefined;
}

function deriveLooseTitleFromContinuation(message: string): string | undefined {
  const stripped = message
    .replace(/\b(domani|oggi|ieri|questo mese|prossima settimana|prossimo mese)\b/gi, " ")
    .replace(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, " ")
    .replace(/\bdalle\s+\d{1,2}(?:[:.]\d{2})?\s+(?:alle|fino alle|fino a)\s+\d{1,2}(?:[:.]\d{2})?\b/gi, " ")
    .replace(/\balle\s+\d{1,2}(?:[:.]\d{2})?\s+(?:fino alle|fino a)\s+\d{1,2}(?:[:.]\d{2})?\b/gi, " ")
    .replace(/\balle\s+\d{1,2}(?:[:.]\d{2})?\b/gi, " ")
    .replace(/\b(?:orario\s+)?\d{1,2}(?:[:.]\d{2})?\s*[-/]\s*\d{1,2}(?:[:.]\d{2})?\b/gi, " ")
    .replace(/\b(di mattina|di pomeriggio|di sera)\b/gi, " ")
    .replace(/\b(se puoi|per favore|grazie|metticelo|mettimelo|mettilo|mettila)\b/gi, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped || normalizeText(stripped).length < 3) {
    return undefined;
  }

  return stripped;
}

function pickReminderFallbackType(): EventTypeMatch | null {
  const items = getEventiList();
  const preferred = ["memo", "appuntamento", "evento"];

  for (const slug of preferred) {
    const found = items.find((item) => item.slug === slug);
    if (found) {
      return {
        slug: found.slug,
        label: found.label,
        score: 0.7,
        matchedBy: "reminder_fallback",
      };
    }
  }

  const first = items[0];
  if (!first) return null;

  return {
    slug: first.slug,
    label: first.label,
    score: 0.5,
    matchedBy: "reminder_fallback:first_available",
  };
}

function stripReminderPrefix(message: string): string {
  return message
    .replace(/\bmi\s+ricordi\s+di\b/i, "")
    .replace(/\bricordami\s+di\b/i, "")
    .replace(/\bricordami\b/i, "")
    .replace(/\bricordamelo\b/i, "")
    .trim();
}

function deriveReminderTitle(message: string): string | undefined {
  const stripped = stripReminderPrefix(message)
    .replace(/\b(domani|oggi|ieri|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/gi, " ")
    .replace(/\balle\s+\d{1,2}(?::\d{2})?\b/gi, " ")
    .replace(/\bdalle\s+\d{1,2}(?::\d{2})?\s+alle\s+\d{1,2}(?::\d{2})?\b/gi, " ")
    .replace(/\b(?:orario\s+)?\d{1,2}(?::\d{2})?\s*[-/]\s*\d{1,2}(?::\d{2})?\b/gi, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = normalizeText(stripped);
  const genericOnly = [
    "appuntamento",
    "un appuntamento",
    "memo",
    "un memo",
    "evento",
    "un evento",
  ];

  if (!normalized || genericOnly.includes(normalized)) {
    return undefined;
  }

  return stripped || undefined;
}

function buildPartialCreateIntent(args: {
  message: string;
  resolverMode: EventTypeResolverMode;
  allowFallbackTitle: boolean;
  fallbackTitle?: string;
}): EventCreateIntent | null {
  const normalized = normalizeText(args.message);
  if (!normalized) return null;

  const eventType = resolveEventType({
    message: normalized,
    mode: args.resolverMode,
  });
  const time = parseCreateTimeWindow(args.message);
  const notes = parseRawNotes(args.message);

  let title = args.allowFallbackTitle
    ? parseCreateTitle(args.message)
    : parseRawTitle(args.message);

  if (!title && args.fallbackTitle) {
    const raw = args.message.trim();
    if (raw && !notes) {
      title = args.fallbackTitle;
    }
  }

  if (!eventType && !title && !notes && !time.startAt && !time.missingDate) {
    return null;
  }

  return {
    type: "event_create",
    payload: {
      eventType,
      title,
      notes,
      startAt: time.startAt,
      endAt: time.endAt,
      timeKind: time.timeKind,
    },
    missing: [],
    debug: {
      resolverMode: args.resolverMode,
      timeMissingDate: !!time.missingDate,
      invalidInterval: !!time.invalidInterval,
      timeWindow: {
        startHour: time.startHour,
        startMinute: time.startMinute,
        endHour: time.endHour,
        endMinute: time.endMinute,
      },
    },
  };
}

export function parseEventCreateIntent(args: {
  message: string;
  resolverMode?: EventTypeResolverMode;
}): EventCreateIntent | null {
  const normalized = normalizeText(args.message);
  if (!normalized) return null;

  const wantsCreate =
    normalized.includes("crea") ||
    normalized.includes("aggiungi") ||
    normalized.includes("fissa") ||
    normalized.includes("programma") ||
    normalized.includes("ricordami") ||
    normalized.includes("ricordamelo") ||
    normalized.includes("mi ricordi di");

  const mentionsEvents =
    normalized.includes("event") ||
    normalized.includes("appuntament") ||
    normalized.includes("riunione") ||
    normalized.includes("memo") ||
    normalized.includes("ricord");

  if (!wantsCreate || !mentionsEvents) return null;

  const resolverMode = args.resolverMode ?? "catalog_tokens";
  const reminderLike = normalized.includes("ricord");
  const sourceMessage = reminderLike ? stripReminderPrefix(args.message) : args.message;
  const partial = buildPartialCreateIntent({
    message: sourceMessage,
    resolverMode,
    allowFallbackTitle: true,
    fallbackTitle: reminderLike ? deriveReminderTitle(sourceMessage) : undefined,
  });
  const eventType = partial?.payload.eventType ?? (reminderLike ? pickReminderFallbackType() : null);
  const title = partial?.payload.title;
  const notes = partial?.payload.notes;
  const time = {
    startAt: partial?.payload.startAt,
    endAt: partial?.payload.endAt,
    timeKind: partial?.payload.timeKind,
    missingDate: partial?.debug.timeMissingDate,
    invalidInterval: partial?.debug.invalidInterval,
    startHour: partial?.debug.timeWindow?.startHour,
    startMinute: partial?.debug.timeWindow?.startMinute,
    endHour: partial?.debug.timeWindow?.endHour,
    endMinute: partial?.debug.timeWindow?.endMinute,
  };

  const fieldState = resolveActionFieldState({
    actionKey: "event_create",
    data: {
      eventType,
      title,
      startAt: time.startAt,
      endAt: time.endAt,
      timeKind: time.timeKind,
      notes,
    },
  });

  return {
    type: "event_create",
    payload: {
      eventType,
      title,
      notes,
      startAt: time.startAt,
      endAt: time.endAt,
      timeKind: time.timeKind,
    },
    missing: fieldState.missing,
    debug: {
      resolverMode,
      timeMissingDate: !!time.missingDate,
      invalidInterval: !!time.invalidInterval,
      timeWindow: {
        startHour: time.startHour,
        startMinute: time.startMinute,
        endHour: time.endHour,
        endMinute: time.endMinute,
      },
    },
  };
}

export function parseEventCreateContinuation(args: {
  message: string;
  resolverMode?: EventTypeResolverMode;
  pendingMissing?: string[];
}): EventCreateIntent | null {
  const resolverMode = args.resolverMode ?? "catalog_tokens";
  const normalized = normalizeText(args.message);
  if (!normalized) return null;

  const fallbackTitle =
    args.pendingMissing?.includes("titolo") && normalized.length > 2
      ? deriveLooseTitleFromContinuation(args.message) ?? args.message.trim()
      : undefined;

  return buildPartialCreateIntent({
    message: args.message,
    resolverMode,
    allowFallbackTitle: false,
    fallbackTitle,
  });
}

export function listKnownCreateTypes(): string[] {
  return getEventiList()
    .slice(0, 8)
    .map((item) => item.label);
}

export function parseOptionalNotesAnswer(message: string): string | null | undefined {
  const normalized = normalizeText(message);

  if (
    normalized === "no" ||
    normalized === "no grazie" ||
    normalized.includes("senza note") ||
    normalized.includes("nessuna nota")
  ) {
    return null;
  }

  const explicit = parseRawNotes(message);
  if (explicit) return explicit;

  if (normalized.startsWith("nota ") || normalized.startsWith("note ")) {
    const raw = message.replace(/^note?\s*[:=]?\s*/i, "").trim();
    return raw || undefined;
  }

  if (
    normalized &&
    normalized !== "si" &&
    normalized !== "si grazie" &&
    normalized !== "ok" &&
    normalized !== "va bene"
  ) {
    return message.trim() || undefined;
  }

  return undefined;
}

export function mergePendingCreateState(args: {
  pending: PendingCreateState | null;
  intent: EventCreateIntent | null;
}): EventCreateIntent | null {
  const pendingData = args.pending?.data;
  const incomingPayload = args.intent?.payload;

  const mergedPayload = {
    eventType:
      incomingPayload?.eventType ??
      (pendingData?.eventTypeSlug && pendingData?.eventTypeLabel
        ? {
            slug: pendingData.eventTypeSlug,
            label: pendingData.eventTypeLabel,
            score: 1,
            matchedBy: "pending_state",
          }
        : null),
    title: incomingPayload?.title ?? pendingData?.title ?? undefined,
    notes: incomingPayload?.notes ?? pendingData?.notes ?? undefined,
    startAt: incomingPayload?.startAt ?? pendingData?.startAt ?? undefined,
    endAt:
      typeof incomingPayload?.endAt !== "undefined"
        ? incomingPayload.endAt
        : pendingData?.endAt ?? undefined,
    timeKind:
      incomingPayload?.timeKind ??
      (pendingData?.timeKind as TimeKind | undefined) ??
      undefined,
  };

  if (
    !incomingPayload?.startAt &&
    pendingData?.startAt &&
    args.intent?.debug.timeMissingDate
  ) {
    const extractedTime = parseCreateTimeWindowFromPendingMessage(
      args.intent,
      pendingData.startAt,
    );
    if (extractedTime) {
      mergedPayload.startAt = extractedTime.startAt;
      mergedPayload.endAt = extractedTime.endAt;
      mergedPayload.timeKind = extractedTime.timeKind;
    }
  }

  if (
    incomingPayload?.startAt &&
    !pendingData?.startAt &&
    typeof pendingData?.startHour === "number" &&
    typeof args.intent?.debug.timeWindow?.startHour === "undefined"
  ) {
    const combined = applyPendingTimeWindowToDate({
      dateIso: incomingPayload.startAt,
      pending: pendingData,
    });
    if (combined) {
      mergedPayload.startAt = combined.startAt;
      mergedPayload.endAt = combined.endAt;
      mergedPayload.timeKind = combined.timeKind;
    }
  }

  const invalidInterval = hasInvalidIntervalRange({
    startAt: mergedPayload.startAt,
    endAt: mergedPayload.endAt,
    timeKind: mergedPayload.timeKind ?? null,
  });

  const fieldState = resolveActionFieldState({
    actionKey: "event_create",
    data: {
      eventType: mergedPayload.eventType,
      title: mergedPayload.title,
      startAt: mergedPayload.startAt,
      endAt: mergedPayload.endAt,
      timeKind: mergedPayload.timeKind,
      notes: mergedPayload.notes,
    },
  });
  const missing = [...fieldState.missing];
  if (invalidInterval && !missing.includes("data/orario")) {
    missing.push("data/orario");
  }

  if (
    !mergedPayload.eventType &&
    !mergedPayload.startAt &&
    !mergedPayload.title &&
    !mergedPayload.notes
  ) {
    return null;
  }

  return {
    type: "event_create",
    payload: mergedPayload,
    missing,
    debug: {
      resolverMode: args.intent?.debug.resolverMode ?? "catalog_tokens",
      timeMissingDate: args.intent?.debug.timeMissingDate,
      invalidInterval,
      timeWindow: {
        startHour:
          args.intent?.debug.timeWindow?.startHour ?? pendingData?.startHour ?? undefined,
        startMinute:
          args.intent?.debug.timeWindow?.startMinute ??
          pendingData?.startMinute ??
          undefined,
        endHour:
          args.intent?.debug.timeWindow?.endHour ?? pendingData?.endHour ?? undefined,
        endMinute:
          args.intent?.debug.timeWindow?.endMinute ?? pendingData?.endMinute ?? undefined,
      },
    },
  };
}

export function resolvePendingCreatePhase(state: {
  missing: string[];
  notes?: string | null | undefined;
}): PendingCreateState["phase"] {
  if (state.missing.includes("tipo evento")) return "collect_type";
  if (state.missing.includes("data/orario")) return "collect_time";
  if (state.missing.includes("titolo")) return "collect_title";
  if (state.missing.includes("note opzionali")) return "collect_notes";
  return "ready";
}

export function resolvePendingCreateReadiness(state: {
  missing: string[];
}): PendingCreateState["readiness"] {
  const blockingFields = state.missing.filter(
    (item) => item !== "note opzionali",
  );

  return blockingFields.length === 0 ? "ready" : "collecting";
}

export function buildCreateIntentFromPendingState(args: {
  pending: PendingCreateState;
  notes?: string | null;
  title?: string;
}): EventCreateIntent | null {
  if (!args.pending.data.eventTypeSlug || !args.pending.data.startAt) {
    return null;
  }

  return {
    type: "event_create",
    payload: {
      eventType: {
        slug: args.pending.data.eventTypeSlug,
        label: args.pending.data.eventTypeLabel ?? args.pending.data.eventTypeSlug,
        score: 1,
        matchedBy: "pending_state",
      },
      title: args.title ?? args.pending.data.title ?? undefined,
      notes:
        typeof args.notes === "undefined"
          ? args.pending.data.notes ?? undefined
          : args.notes,
      startAt: args.pending.data.startAt ?? undefined,
      endAt: args.pending.data.endAt ?? undefined,
      timeKind: (args.pending.data.timeKind as TimeKind | undefined) ?? undefined,
    },
    missing: [],
    debug: {
      resolverMode: "catalog_tokens",
    },
  };
}

function parseCreateTimeWindowFromPendingMessage(
  intent: EventCreateIntent,
  pendingStartAt: string,
): { startAt: string; endAt: string | null; timeKind: TimeKind } | null {
  const baseDate = new Date(pendingStartAt);
  if (Number.isNaN(baseDate.getTime())) return null;

  const startHour = intent.debug.timeWindow?.startHour;
  const startMinute = intent.debug.timeWindow?.startMinute ?? 0;
  const endHour = intent.debug.timeWindow?.endHour;
  const endMinute = intent.debug.timeWindow?.endMinute ?? 0;

  if (typeof startHour !== "number") return null;

  const start = new Date(baseDate);
  start.setHours(startHour, startMinute, 0, 0);

  if (intent.payload.timeKind === "interval" && typeof endHour === "number") {
    const end = new Date(baseDate);
    end.setHours(endHour, endMinute, 0, 0);
    if (end <= start) return null;

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timeKind: "interval",
    };
  }

  return {
    startAt: start.toISOString(),
    endAt: null,
    timeKind: "point",
  };
}

function applyPendingTimeWindowToDate(args: {
  dateIso: string;
  pending: PendingCreateState["data"];
}): { startAt: string; endAt: string | null; timeKind: TimeKind } | null {
  const baseDate = new Date(args.dateIso);
  if (Number.isNaN(baseDate.getTime())) return null;
  if (typeof args.pending.startHour !== "number") return null;

  const start = new Date(baseDate);
  start.setHours(args.pending.startHour, args.pending.startMinute ?? 0, 0, 0);

  if (
    args.pending.timeKind === "interval" &&
    typeof args.pending.endHour === "number"
  ) {
    const end = new Date(baseDate);
    end.setHours(args.pending.endHour, args.pending.endMinute ?? 0, 0, 0);
    if (end <= start) return null;

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timeKind: "interval",
    };
  }

  return {
    startAt: start.toISOString(),
    endAt: null,
    timeKind: "point",
  };
}

export async function executeEventCreateIntent(args: {
  auth: AuthContext;
  userId: string;
  intent: EventCreateIntent;
}): Promise<{ id: string }> {
  const eventType = args.intent.payload.eventType;
  if (!eventType || !args.intent.payload.startAt || !args.intent.payload.timeKind) {
    throw new Error("CREATE_INTENT_INCOMPLETE");
  }

  if (!hasPermission(args.auth, "evento.create", { resourceType: eventType.slug })) {
    throw new Error("EVENT_CREATE_FORBIDDEN");
  }

  if (
    hasInvalidIntervalRange({
      startAt: args.intent.payload.startAt,
      endAt: args.intent.payload.endAt ?? null,
      timeKind: args.intent.payload.timeKind ?? null,
    })
  ) {
    throw new Error("CREATE_INTENT_INVALID_INTERVAL");
  }

  return createEvento({
    type: eventType.slug,
    userId: args.userId,
    data: {
      titolo: args.intent.payload.title || eventType.label,
      descrizione: args.intent.payload.notes || null,
    },
    timeKind: args.intent.payload.timeKind,
    startAt: args.intent.payload.startAt,
    endAt: args.intent.payload.endAt ?? null,
    allDay: false,
    recurrence: null,
    gruppo: null,
    partecipanti: [],
    visibilityRole: null,
  });
}
