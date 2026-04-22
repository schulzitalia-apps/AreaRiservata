import { getEventiList } from "@/config/eventi.registry";
import {
  listEventi,
  type EventoPreview,
} from "@/server-utils/service/eventiQuery";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { PendingEventListState } from "@/server-utils/anima/memory/sessionState";
import {
  resolveEventType,
  detectEventTypeAmbiguity,
  type EventTypeMatch,
  type EventTypeResolverMode,
} from "./eventi.typeResolver";
import { parseListRange } from "./eventi.time";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";

export type EventListIntent = {
  type: "event_list";
  filters: {
    days?: number;
    futureDays?: number;
    specificDate?: string;
    timeFrom?: string;
    timeTo?: string;
    eventType?: EventTypeMatch | null;
    query?: string;
    limit?: number;
    wantsAll?: boolean;
  };
  explanation: string;
  debug: {
    resolverMode: EventTypeResolverMode;
    ambiguousEventType?: boolean;
    ambiguousTypeOptions?: string[];
  };
};

export type EventListItem = EventoPreview & {
  type: string;
  label: string;
};

export type EventListPresentation = {
  mode: "verbatim_list" | "summarized";
  header: string;
  listBlock: string | null;
  summaryText: string | null;
  footer: string | null;
};

export type EventListResult = {
  total: number;
  pageSize: number;
  hasMore: boolean;
  items: EventListItem[];
  presentation: EventListPresentation;
};

export type EventListClarification = {
  needsClarification: boolean;
  missing: string[];
  periodHint: string | null;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripKnownEventTypeTerms(
  message: string,
  eventType?: EventTypeMatch | null,
): string {
  let out = normalizeText(message);

  const fillerTerms = [
    "mostrami",
    "fammi vedere",
    "dammi",
    "elenca",
    "tutti gli eventi",
    "tutti gli appuntamenti",
    "solo gli eventi",
    "solo gli appuntamenti",
    "eventi",
    "evento",
    "appuntamenti",
    "appuntamento",
    "calendario",
    "ultimo mese",
    "nell ultimo mese",
    "ultimi giorni",
    "degli ultimi",
  ];

  for (const term of fillerTerms) {
    out = out.replaceAll(normalizeText(term), " ");
  }

  if (eventType) {
    out = out.replaceAll(normalizeText(eventType.slug), " ");
    out = out.replaceAll(normalizeText(eventType.label), " ");
  }

  return out.replace(/\s+/g, " ").trim();
}

function buildSafeQuery(
  message: string,
  eventType?: EventTypeMatch | null,
): string | undefined {
  const normalized = normalizeText(message);
  const strongMarkers = ["chiamat", "titolo", "cliente"];
  const matched = strongMarkers.find((marker) => normalized.includes(marker));
  if (!matched) return undefined;

  const stripped = stripKnownEventTypeTerms(message, eventType);
  return stripped || undefined;
}

function parseRequestedLimit(message: string): {
  limit?: number;
  wantsAll?: boolean;
} {
  const normalized = normalizeText(message);

  if (
    normalized.includes("tutti") ||
    normalized.includes("tutte") ||
    normalized.includes("tutto quanto")
  ) {
    return { wantsAll: true };
  }

  const explicitPatterns = [
    /\b(?:primi|prime|ultimi|ultime|solo|altri|altre|mostrami|dammi)\s+(\d{1,2})\b/,
    /\b(\d{1,2})\s+(?:risultati|eventi|appuntamenti)\b/,
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern);
    const value = Number(match?.[1]);
    if (Number.isFinite(value) && value > 0) {
      return { limit: Math.min(value, 50) };
    }
  }

  const bareNumber = normalized.match(/^(\d{1,3})$/);
  const bareValue = Number(bareNumber?.[1]);
  if (Number.isFinite(bareValue) && bareValue > 0) {
    return { limit: Math.min(bareValue, 50) };
  }

  return {};
}

function buildPendingEventType(
  pending: PendingEventListState | null,
): EventTypeMatch | null {
  if (!pending?.data?.eventTypeSlug || !pending?.data?.eventTypeLabel) {
    return null;
  }

  return {
    slug: pending.data.eventTypeSlug,
    label: pending.data.eventTypeLabel,
    score: 1,
    matchedBy: "pending_state",
  };
}

function formatScopeParts(filters: EventListIntent["filters"]): string[] {
  const scopeParts: string[] = [];

  if (filters.eventType?.label) {
    scopeParts.push(`tipo ${filters.eventType.label}`);
  }

  if (filters.specificDate) {
    scopeParts.push(`data ${filters.specificDate}`);
  } else if (filters.futureDays) {
    scopeParts.push(`prossimi ${filters.futureDays} giorni`);
  } else if (filters.days) {
    scopeParts.push(`ultimi ${filters.days} giorni`);
  } else if (filters.timeFrom && filters.timeTo) {
    scopeParts.push("intervallo richiesto");
  }

  if (filters.query) {
    scopeParts.push(`testo "${filters.query}"`);
  }

  return scopeParts;
}

function buildScopeLabel(filters: EventListIntent["filters"]): string | null {
  const scopeParts = formatScopeParts(filters);
  return scopeParts.length ? scopeParts.join(", ") : null;
}

export function parseEventListIntent(args: {
  message: string;
  resolverMode?: EventTypeResolverMode;
}): EventListIntent | null {
  const normalized = normalizeText(args.message);
  if (!normalized) return null;

  const resolverMode = args.resolverMode ?? "catalog_tokens";
  const ambiguity = detectEventTypeAmbiguity(normalized);
  const eventType = resolveEventType({
    message: normalized,
    mode: resolverMode,
  });
  const parsedRange = parseListRange(args.message);
  const asksList = ANIMA_RUNTIME_CONFIG.routing.listLeadIns.some((term) =>
    normalized.includes(term),
  );
  const mentionsFutureWindow =
    !!parsedRange.futureDays ||
    ANIMA_RUNTIME_CONFIG.routing.genericFutureTerms.some((term) =>
      normalized.includes(term),
    );

  const mentionsEvents =
    normalized.includes("event") ||
    normalized.includes("appuntament") ||
    normalized.includes("calendario") ||
    normalized.includes("riunione") ||
    normalized.includes("memo") ||
    normalized.includes("agenda");

  if (!mentionsEvents && !eventType) return null;
  if (!asksList && !mentionsFutureWindow && !eventType) return null;

  const specificDate = parsedRange.specificDate;
  const days = specificDate ? undefined : parsedRange.days;
  const futureDays = specificDate ? undefined : parsedRange.futureDays;
  const query = buildSafeQuery(args.message, eventType);
  const limitSelection = parseRequestedLimit(args.message);

  if (!specificDate && !days && !futureDays && normalized.includes("futuro")) {
    return {
      type: "event_list",
      filters: {
        futureDays: ANIMA_RUNTIME_CONFIG.defaults.genericFutureDays,
        eventType,
        query,
        limit: limitSelection.limit,
        wantsAll: limitSelection.wantsAll,
      },
      explanation: "Matched deterministic eventi.list router on generic future",
      debug: {
        resolverMode,
        ambiguousEventType: ambiguity.ambiguous,
        ambiguousTypeOptions: ambiguity.options,
      },
    };
  }

  return {
    type: "event_list",
    filters: {
      days,
      futureDays,
      specificDate,
      timeFrom: parsedRange.monthFrom,
      timeTo: parsedRange.monthTo,
      eventType,
      query,
      limit: limitSelection.limit,
      wantsAll: limitSelection.wantsAll,
    },
    explanation: "Matched deterministic eventi.list router",
    debug: {
      resolverMode,
      ambiguousEventType: ambiguity.ambiguous,
      ambiguousTypeOptions: ambiguity.options,
    },
  };
}

export function mergePendingEventListIntent(args: {
  pending: PendingEventListState;
  message: string;
  resolverMode?: EventTypeResolverMode;
}): EventListIntent {
  const parsed = parseEventListIntent({
    message: args.message,
    resolverMode: args.resolverMode,
  });
  const requestedLimit = parseRequestedLimit(args.message);

  return {
    type: "event_list",
    filters: {
      days: parsed?.filters.days ?? args.pending.data.days ?? undefined,
      futureDays:
        parsed?.filters.futureDays ?? args.pending.data.futureDays ?? undefined,
      specificDate:
        parsed?.filters.specificDate ??
        args.pending.data.specificDate ??
        undefined,
      timeFrom:
        parsed?.filters.timeFrom ?? args.pending.data.timeFrom ?? undefined,
      timeTo: parsed?.filters.timeTo ?? args.pending.data.timeTo ?? undefined,
      eventType:
        parsed?.filters.eventType ??
        buildPendingEventType(args.pending) ??
        undefined,
      query: parsed?.filters.query ?? args.pending.data.query ?? undefined,
      limit:
        requestedLimit.limit ??
        parsed?.filters.limit ??
        args.pending.data.limit ??
        undefined,
      wantsAll:
        requestedLimit.wantsAll ??
        parsed?.filters.wantsAll ??
        args.pending.data.wantsAll ??
        false,
    },
    explanation: "Merged event list intent with pending state",
    debug: {
      resolverMode: args.resolverMode ?? "catalog_tokens",
      ambiguousEventType:
        parsed?.debug.ambiguousEventType ??
        detectEventTypeAmbiguity(args.message).ambiguous,
      ambiguousTypeOptions:
        parsed?.debug.ambiguousTypeOptions ??
        detectEventTypeAmbiguity(args.message).options,
    },
  };
}

export function analyzeEventListIntent(
  intent: EventListIntent,
): EventListClarification {
  if (intent.debug.ambiguousEventType) {
    return {
      needsClarification: true,
      missing: ["tipo eventi"],
      periodHint: buildScopeLabel(intent.filters),
    };
  }

  return {
    needsClarification: false,
    missing: [],
    periodHint: buildScopeLabel(intent.filters),
  };
}

function buildDateRange(filters: EventListIntent["filters"]): {
  timeFrom?: string;
  timeTo?: string;
} {
  if (filters.specificDate) {
    return {
      timeFrom: `${filters.specificDate}T00:00:00.000Z`,
      timeTo: `${filters.specificDate}T23:59:59.999Z`,
    };
  }

  if (filters.timeFrom || filters.timeTo) {
    return {
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
    };
  }

  if (filters.days) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - filters.days);

    return {
      timeFrom: from.toISOString(),
      timeTo: now.toISOString(),
    };
  }

  if (filters.futureDays) {
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + filters.futureDays);

    return {
      timeFrom: now.toISOString(),
      timeTo: to.toISOString(),
    };
  }

  return {};
}

function formatEventLine(item: EventListItem): string {
  const when = item.startAt
    ? new Date(item.startAt).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "senza data";

  return `- [${item.label}] ${item.displayName} (${when})`;
}

function buildSummarizedText(items: EventListItem[]): string {
  if (!items.length) return "Non ho trovato eventi da riassumere.";

  if (items.length <= 3) {
    return items
      .map((item) => {
        const when = item.startAt
          ? new Date(item.startAt).toLocaleString("it-IT", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "senza data";
        return `${item.label}: ${item.displayName} (${when})`;
      })
      .join("; ");
  }

  const grouped = new Map<string, { total: number; samples: string[] }>();
  for (const item of items) {
    const dayLabel = item.startAt
      ? new Date(item.startAt).toLocaleDateString("it-IT", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        })
      : "senza data";
    const current = grouped.get(dayLabel) ?? { total: 0, samples: [] };
    current.total += 1;
    if (current.samples.length < 2) {
      current.samples.push(`${item.label}: ${item.displayName}`);
    }
    grouped.set(dayLabel, current);
  }

  return Array.from(grouped.entries())
    .slice(0, 3)
    .map(([dayLabel, entry]) => {
      const lead = `${dayLabel}: ${entry.total} eventi`;
      const samples = entry.samples.length
        ? `, tra cui ${entry.samples.join(" e ")}`
        : "";
      return `${lead}${samples}`;
    })
    .join("; ");
}

export function buildEventListPresentation(args: {
  intent: EventListIntent;
  result: Omit<EventListResult, "presentation">;
}): EventListPresentation {
  const scopeLabel = buildScopeLabel(args.intent.filters);
  const header = scopeLabel
    ? `Ecco cosa ho trovato per ${scopeLabel}`
    : "Ecco gli eventi trovati";
  const shouldSummarize = args.result.items.length <= 3;
  const listBlock = shouldSummarize
    ? null
    : args.result.items.map((item) => formatEventLine(item)).join("\n");
  const summaryText = shouldSummarize
    ? buildSummarizedText(args.result.items)
    : null;
  const footer = args.result.hasMore
    ? `Qui ne vedi ${args.result.items.length} su ${args.result.total}. Se vuoi, nel prossimo messaggio restringo ancora il filtro oppure aumento la quantita.`
    : `Totale risultati: ${args.result.total}.`;

  return {
    mode: shouldSummarize ? "summarized" : "verbatim_list",
    header,
    listBlock,
    summaryText,
    footer,
  };
}

export async function executeEventListIntent(args: {
  auth: AuthContext;
  intent: EventListIntent;
  pageSize?: number;
}): Promise<EventListResult> {
  const requestedPageSize =
    args.pageSize ??
    args.intent.filters.limit ??
    (args.intent.filters.wantsAll ? 50 : 8);
  const pageSize = Math.min(Math.max(requestedPageSize, 1), 50);
  const types = args.intent.filters.eventType
    ? getEventiList().filter(
        (item) => item.slug === args.intent.filters.eventType?.slug,
      )
    : getEventiList();
  const { timeFrom, timeTo } = buildDateRange(args.intent.filters);

  const batches = await Promise.all(
    types.map(async (typeDef) => {
      const { items, total } = await listEventi({
        type: typeDef.slug,
        query: args.intent.filters.query,
        timeFrom,
        timeTo,
        page: 1,
        pageSize,
        auth: args.auth,
      });

      return {
        total,
        items: items.map((item) => ({
          ...item,
          type: typeDef.slug,
          label: typeDef.label,
        })),
      };
    }),
  );

  const total = batches.reduce((sum, batch) => sum + batch.total, 0);
  const items = batches
    .flatMap((batch) => batch.items)
    .sort((a, b) => {
      const aTs = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bTs = b.startAt ? new Date(b.startAt).getTime() : 0;
      if (args.intent.filters.futureDays) {
        return aTs - bTs;
      }
      return bTs - aTs;
    })
    .slice(0, pageSize);

  const partialResult = {
    total,
    pageSize,
    hasMore: total > items.length,
    items,
  };

  return {
    ...partialResult,
    presentation: buildEventListPresentation({
      intent: args.intent,
      result: partialResult,
    }),
  };
}

export function buildEventListReply(args: {
  intent: EventListIntent;
  result: EventListResult;
  displayName?: string | null;
}): string {
  const ownerText = args.displayName ? ` ${args.displayName}` : "";

  if (!args.result.total) {
    return `Non vedo eventi compatibili con il filtro richiesto${ownerText ? ` per${ownerText}` : ""}.`;
  }

  if (args.result.presentation.mode === "summarized") {
    return [
      args.result.presentation.header,
      args.result.presentation.summaryText,
      args.result.presentation.footer,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `${args.result.presentation.header}:`,
    args.result.presentation.listBlock,
    args.result.presentation.footer,
  ]
    .filter(Boolean)
    .join("\n\n");
}
