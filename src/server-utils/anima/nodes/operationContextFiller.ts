import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.config";
import type {
  AnimaLlmTraceStep,
  AnimaRecentTurn,
} from "@/server-utils/anima/core/types";
import { resolveActionFieldState } from "@/server-utils/anima/core/actionSchemas";
import { chatWithRuntimeFailover } from "@/server-utils/llm";
import type {
  PendingCreateState,
  PendingAnagraficheCreateState,
  PendingAnagraficheReadState,
  PendingEventListState,
  PendingSprintTimelineReadState,
  PendingGenericMailState,
  PendingMailFollowupState,
} from "@/server-utils/anima/memory/sessionState";
import type {
  EventCreateIntent,
} from "@/server-utils/anima/features/eventi/eventi.create";
import type { EventListIntent } from "@/server-utils/anima/features/eventi/eventi.list";
import type { TimeKind } from "@/server-utils/models/evento.schema";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { SprintTaskPriority } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { getAnagraficheList } from "@/config/anagrafiche.registry";
import { getEventiList } from "@/config/eventi.registry";
import {
  analyzeEventTypeResolution,
  resolveEventType,
  detectEventTypeAmbiguity,
  type EventTypeResolverMode,
} from "@/server-utils/anima/features/eventi/eventi.typeResolver";
import { parseCreateTimeWindow } from "@/server-utils/anima/features/eventi/eventi.time";
import { parseListRange } from "@/server-utils/anima/features/eventi/eventi.time";
import type { SprintTimelineReadIntent } from "@/server-utils/anima/features/sprintTimeline/sprintTimeline.types";
import { resolveCatalogChoiceWithLlm } from "@/server-utils/anima/nodes/catalogResolver";

export type EventCreateOperationContextFillResult = {
  kind: "event_create";
  normalizedMessage: string | null;
  payloadPatch: {
    title?: string;
    notes?: string | null;
    startAt?: string;
    endAt?: string | null;
    timeKind?: EventCreateIntent["payload"]["timeKind"];
    eventType?: EventCreateIntent["payload"]["eventType"];
  };
  confidence: number;
  why: string[];
};

export type MailFollowupOperationContextFillResult = {
  kind: "mail_followup";
  normalizedMessage: string | null;
  recipient?: string | null;
  accept?: boolean;
  decline?: boolean;
  confidence: number;
  why: string[];
};

export type GenericMailOperationContextFillResult = {
  kind: "generic_mail";
  normalizedMessage: string | null;
  payloadPatch: {
    to?: string | null;
    subject?: string;
    message?: string;
  };
  confidence: number;
  why: string[];
};

export type EventListOperationContextFillResult = {
  kind: "event_list";
  normalizedMessage: string | null;
  filtersPatch: {
    days?: number;
    futureDays?: number;
    specificDate?: string;
    timeFrom?: string;
    timeTo?: string;
    eventType?: EventListIntent["filters"]["eventType"];
    query?: string;
    limit?: number;
    wantsAll?: boolean;
  };
  ambiguousEventType?: boolean;
  ambiguousTypeOptions?: string[];
  confidence: number;
  why: string[];
};

export type SprintTimelineReadOperationContextFillResult = {
  kind: "sprint_timeline_read";
  normalizedMessage: string | null;
  queryPatch: {
    mode?: SprintTimelineReadIntent["query"]["mode"];
    scope?: SprintTimelineReadIntent["query"]["scope"];
    personNames?: string[];
    signals?: SprintTimelineReadIntent["query"]["signals"];
    priority?: SprintTaskPriority | null;
    dueWithinDays?: number | null;
    taskQuery?: string | null;
    aggregateByOwner?: boolean;
  };
  confidence: number;
  why: string[];
};

export type AnagraficheReadOperationContextFillResult = {
  kind: "anagrafiche_read";
  normalizedMessage: string | null;
  queryPatch: {
    typeText?: string;
    typeSlug?: string | null;
    typeLabel?: string | null;
    query?: string;
    requestedFields?: FieldKey[];
    wantsList?: boolean;
  };
  confidence: number;
  why: string[];
};

export type AnagraficheCreateOperationContextFillResult = {
  kind: "anagrafiche_create";
  normalizedMessage: string | null;
  payloadPatch: {
    typeText?: string;
    typeSlug?: string | null;
    typeLabel?: string | null;
    draftData?: Record<string, unknown>;
    confirmWrite?: boolean;
  };
  confidence: number;
  why: string[];
};

export type AnyOperationContextFillResult =
  | EventCreateOperationContextFillResult
  | EventListOperationContextFillResult
  | SprintTimelineReadOperationContextFillResult
  | AnagraficheReadOperationContextFillResult
  | AnagraficheCreateOperationContextFillResult
  | MailFollowupOperationContextFillResult
  | GenericMailOperationContextFillResult;

export type OperationContextFillResult = AnyOperationContextFillResult;

function extractFirstJsonObject(text: string): string | null {
  const s = text.trim();
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function normalizeConfidence(value: unknown): number {
  const confidenceNumber = Number(value);
  return Number.isFinite(confidenceNumber)
    ? Math.max(0, Math.min(1, confidenceNumber))
    : 0.25;
}

function normalizeWhy(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item: unknown) => String(item)).filter(Boolean).slice(0, 5)
    : [];
}

function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeEventDomainRequest(message: string): boolean {
  const normalized = normalizeCatalogText(message);
  const eventSignals = [
    "evento",
    "eventi",
    "appuntamento",
    "appuntamenti",
    "calendario",
    "agenda",
    "memo",
    "riunione",
    "arrivo merce",
    "ordine merce",
    "pagamento",
    "fattura",
    "arrivo",
    "merce",
  ];
  return eventSignals.some((token) => normalized.includes(token));
}

function hasExplicitAnagraficheDomainRequest(message: string): boolean {
  const normalized = normalizeCatalogText(message);
  return (
    normalized.includes("anagrafic") ||
    normalized.includes("fornitor") ||
    normalized.includes("client") ||
    normalized.includes("ent") ||
    normalized.includes("preventiv") ||
    normalized.includes("ricav") ||
    normalized.includes("articol") ||
    normalized.includes("serviz") ||
    normalized.includes("bando") ||
    normalized.includes("spes")
  );
}

function isGenericEventRequestText(value: string): boolean {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return true;

  const genericPatterns = [
    "evento",
    "eventi",
    "appuntamento",
    "appuntamenti",
    "eventi futuri",
    "eventi recenti",
    "eventi ultima settimana",
    "evento ultima settimana",
  ];

  return genericPatterns.includes(normalized);
}

async function resolveEventTypeWithLlmFallback(args: {
  message: string;
  resolverMode: EventTypeResolverMode;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  const analysis = analyzeEventTypeResolution({
    message: args.message,
    mode: args.resolverMode,
  });
  const ambiguity = analysis.ambiguity;
  if (ambiguity.ambiguous) {
    return null;
  }

  if (analysis.best) {
    return analysis.best;
  }

  const llmResolved = await resolveCatalogChoiceWithLlm({
    message: args.message,
    entityName: "tipo evento",
    candidates: getEventiList().map((item) => ({
      id: item.slug,
      label: item.label,
      aliases: [item.slug, item.label],
    })),
    traceCollector: args.traceCollector,
  });

  if (llmResolved?.id) {
    const item = getEventiList().find((candidate) => candidate.slug === llmResolved.id);
    if (item) {
      return {
        slug: item.slug,
        label: item.label,
        score: llmResolved.confidence,
        matchedBy: "llm_catalog_resolver",
      };
    }
  }

  return null;
}

async function resolveAnagraficaTypeWithLlm(args: {
  message: string;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  const llmResolved = await resolveCatalogChoiceWithLlm({
    message: args.message,
    entityName: "tipo anagrafica",
    candidates: getAnagraficheList().map((item) => ({
      id: item.slug,
      label: item.label,
      aliases: [item.slug, item.label],
    })),
    traceCollector: args.traceCollector,
  });

  if (!llmResolved?.id) {
    return null;
  }

  const match = getAnagraficheList().find((item) => item.slug === llmResolved.id);
  if (!match) {
    return null;
  }

  return {
    slug: match.slug,
    label: match.label,
  };
}

function buildAnagraficheFieldSchema(typeSlug?: string | null) {
  if (!typeSlug) return [];
  const typeDef = getAnagraficheList().find((item) => item.slug === typeSlug);
  if (!typeDef) return [];

  return Object.entries(typeDef.fields)
    .slice(0, 20)
    .map(([fieldKey, fieldDef]) => ({
      key: fieldKey,
      label: fieldDef.label,
      hint: fieldDef.hint ?? null,
      type: fieldDef.type,
    }));
}

export async function runOperationContextFillerForCreate(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingCreateState | null;
  resolverMode: EventTypeResolverMode;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<OperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.create.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.create.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);
    const eventType =
      typeof parsed?.eventTypeText === "string" && parsed.eventTypeText.trim()
        ? isGenericEventRequestText(parsed.eventTypeText.trim())
          ? null
          : await resolveEventTypeWithLlmFallback({
            message: parsed.eventTypeText.trim(),
            resolverMode: args.resolverMode,
            traceCollector: args.traceCollector,
          })
        : null;
    const time =
      typeof parsed?.timeText === "string" && parsed.timeText.trim()
        ? parseCreateTimeWindow(parsed.timeText.trim())
        : null;

    const confidence = normalizeConfidence(parsed?.confidence);

    const result: EventCreateOperationContextFillResult = {
      kind: "event_create",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      payloadPatch: {
        title:
          typeof parsed?.title === "string" && parsed.title.trim()
            ? parsed.title.trim()
            : undefined,
        notes:
          parsed?.explicitNoNotes === true
            ? null
            : typeof parsed?.notes === "string" && parsed.notes.trim()
              ? parsed.notes.trim()
              : undefined,
        startAt: time?.startAt ?? undefined,
        endAt:
          typeof time?.endAt === "undefined" ? undefined : (time?.endAt ?? null),
        timeKind: time?.timeKind ?? undefined,
        eventType: eventType ?? undefined,
      },
      confidence,
      why: normalizeWhy(parsed?.why),
    };
    args.traceCollector?.({
      id: `fill-create-${Date.now()}`,
      step: "operationContextFiller.create",
      title: "Operation Filler Create",
      reason: "Completare il JSON dell'azione evento aperta con i dati del turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-create-${Date.now()}`,
      step: "operationContextFiller.create",
      title: "Operation Filler Create",
      reason: "Completare il JSON dell'azione evento aperta con i dati del turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "OPERATION_FILLER_CREATE_FAILED"),
    });
    return null;
  }
}

export async function runOperationContextFillerForMailFollowup(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending: PendingMailFollowupState;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<MailFollowupOperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.mailFollowup.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.mailFollowup.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);

    const result: MailFollowupOperationContextFillResult = {
      kind: "mail_followup",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      recipient:
        typeof parsed?.recipient === "string" && parsed.recipient.trim()
          ? parsed.recipient.trim().toLowerCase()
          : typeof parsed?.recipient === "object"
            ? null
            : undefined,
      accept: parsed?.accept === true,
      decline: parsed?.decline === true,
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };
    args.traceCollector?.({
      id: `fill-mail-followup-${Date.now()}`,
      step: "operationContextFiller.mailFollowup",
      title: "Operation Filler Mail Follow-up",
      reason: "Capire se il follow-up mail va confermato, rifiutato o reindirizzato.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-mail-followup-${Date.now()}`,
      step: "operationContextFiller.mailFollowup",
      title: "Operation Filler Mail Follow-up",
      reason: "Capire se il follow-up mail va confermato, rifiutato o reindirizzato.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "OPERATION_FILLER_MAIL_FOLLOWUP_FAILED"),
    });
    return null;
  }
}

export async function runOperationContextFillerForEventList(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingEventListState | null;
  resolverMode: EventTypeResolverMode;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<EventListOperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.eventList.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.eventList.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);
      const eventTypeResolutionMessage =
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? `${parsed.eventTypeText ?? ""} ${parsed.normalizedCompletionMessage.trim()}`.trim()
          : typeof parsed?.eventTypeText === "string"
            ? parsed.eventTypeText.trim()
            : "";
      const eventTypeAmbiguity = detectEventTypeAmbiguity(
        `${args.message} ${eventTypeResolutionMessage}`.trim(),
      );
      const eventType =
        typeof parsed?.eventTypeText === "string" && parsed.eventTypeText.trim()
          ? await resolveEventTypeWithLlmFallback({
              message: eventTypeResolutionMessage || parsed.eventTypeText.trim(),
              resolverMode: args.resolverMode,
              traceCollector: args.traceCollector,
            })
          : null;
    const range =
      typeof parsed?.periodText === "string" && parsed.periodText.trim()
        ? parseListRange(parsed.periodText.trim())
        : null;

    const result: EventListOperationContextFillResult = {
      kind: "event_list",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
        filtersPatch: {
        days: range?.days ?? undefined,
        futureDays: range?.futureDays ?? undefined,
        specificDate: range?.specificDate ?? undefined,
        timeFrom: range?.monthFrom ?? undefined,
        timeTo: range?.monthTo ?? undefined,
        eventType: eventType ?? undefined,
        query:
          typeof parsed?.query === "string" && parsed.query.trim()
            ? parsed.query.trim()
            : undefined,
        limit:
          typeof parsed?.limit === "number" && Number.isFinite(parsed.limit)
            ? Math.max(1, Math.min(50, Math.round(parsed.limit)))
            : undefined,
          wantsAll: parsed?.wantsAll === true,
        },
        ambiguousEventType: eventTypeAmbiguity.ambiguous,
        ambiguousTypeOptions: eventTypeAmbiguity.options,
        confidence: normalizeConfidence(parsed?.confidence),
        why: normalizeWhy(parsed?.why),
      };
    args.traceCollector?.({
      id: `fill-event-list-${Date.now()}`,
      step: "operationContextFiller.eventList",
      title: "Operation Filler Event List",
      reason:
        "Compilare i filtri della ricerca eventi a partire dal linguaggio naturale.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-event-list-${Date.now()}`,
      step: "operationContextFiller.eventList",
      title: "Operation Filler Event List",
      reason:
        "Compilare i filtri della ricerca eventi a partire dal linguaggio naturale.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "OPERATION_FILLER_EVENT_LIST_FAILED"),
    });
    return null;
  }
}

export async function runOperationContextFillerForSprintTimelineRead(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingSprintTimelineReadState | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<SprintTimelineReadOperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.sprintTimelineRead.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.sprintTimelineRead
          .temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);
    const validModes = [
      "active_tasks",
      "due_tasks",
      "priority_advice",
      "owner_overview",
      "delay_overview",
      "task_breakdown",
    ];
    const validScopes = ["company", "me_owner", "me_reviewer", "person"];
    const validSignals = ["red", "yellow", "purple", "blue", "orange"];
    const validPriorities = ["urgent", "high", "medium", "low"];

    const result: SprintTimelineReadOperationContextFillResult = {
      kind: "sprint_timeline_read",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      queryPatch: {
        mode: validModes.includes(String(parsed?.mode))
          ? parsed.mode
          : undefined,
        scope: validScopes.includes(String(parsed?.scope))
          ? parsed.scope
          : undefined,
        personNames: Array.isArray(parsed?.personNames)
          ? parsed.personNames.map((item: unknown) => String(item).trim()).filter(Boolean)
          : undefined,
        signals: Array.isArray(parsed?.signals)
          ? parsed.signals
              .map((item: unknown) => String(item).trim())
              .filter((item: string) => validSignals.includes(item))
          : undefined,
        priority: validPriorities.includes(String(parsed?.priority))
          ? parsed.priority
          : undefined,
        dueWithinDays:
          typeof parsed?.dueWithinDays === "number" &&
          Number.isFinite(parsed.dueWithinDays)
            ? Math.max(1, Math.min(60, Math.round(parsed.dueWithinDays)))
            : undefined,
        taskQuery:
          typeof parsed?.taskQuery === "string" && parsed.taskQuery.trim()
            ? parsed.taskQuery.trim()
            : undefined,
        aggregateByOwner: parsed?.aggregateByOwner === true,
      },
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };

    args.traceCollector?.({
      id: `fill-sprint-read-${Date.now()}`,
      step: "operationContextFiller.sprintTimelineRead",
      title: "Operation Filler SprintTimeline Read",
      reason:
        "Compilare i filtri di lettura SprintTimeline a partire dal contesto del turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-sprint-read-${Date.now()}`,
      step: "operationContextFiller.sprintTimelineRead",
      title: "Operation Filler SprintTimeline Read",
      reason:
        "Compilare i filtri di lettura SprintTimeline a partire dal contesto del turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(
        error?.message ?? "OPERATION_FILLER_SPRINT_TIMELINE_READ_FAILED",
      ),
    });
    return null;
  }
}

export async function runOperationContextFillerForAnagraficheRead(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingAnagraficheReadState | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<AnagraficheReadOperationContextFillResult | null> {
  if (
    looksLikeEventDomainRequest(args.message) &&
    !hasExplicitAnagraficheDomainRequest(args.message)
  ) {
    return null;
  }

  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.anagraficheRead.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.anagraficheRead
          .temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);

    const resolvedType =
      typeof parsed?.typeText === "string" && parsed.typeText.trim()
        ? await resolveAnagraficaTypeWithLlm({
            message: parsed.typeText.trim(),
            traceCollector: args.traceCollector,
          })
        : null;

    const result: AnagraficheReadOperationContextFillResult = {
      kind: "anagrafiche_read",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      queryPatch: {
        typeText:
          typeof parsed?.typeText === "string" && parsed.typeText.trim()
            ? parsed.typeText.trim()
            : undefined,
        typeSlug: resolvedType?.slug ?? undefined,
        typeLabel: resolvedType?.label ?? undefined,
        query:
          typeof parsed?.query === "string" && parsed.query.trim()
            ? parsed.query.trim()
            : undefined,
        requestedFields: Array.isArray(parsed?.requestedFields)
          ? parsed.requestedFields
              .map((item: unknown) => String(item).trim())
              .filter(Boolean) as FieldKey[]
          : undefined,
        wantsList: parsed?.wantsList === true,
      },
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };

    args.traceCollector?.({
      id: `fill-anagrafiche-read-${Date.now()}`,
      step: "operationContextFiller.anagraficheRead",
      title: "Operation Filler Anagrafiche Read",
      reason:
        "Compilare il JSON di ricerca anagrafiche a partire dal contesto del turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-anagrafiche-read-${Date.now()}`,
      step: "operationContextFiller.anagraficheRead",
      title: "Operation Filler Anagrafiche Read",
      reason:
        "Compilare il JSON di ricerca anagrafiche a partire dal contesto del turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(
        error?.message ?? "OPERATION_FILLER_ANAGRAFICHE_READ_FAILED",
      ),
    });
    return null;
  }
}

export async function runOperationContextFillerForAnagraficheCreate(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingAnagraficheCreateState | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<AnagraficheCreateOperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.anagraficheCreate.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
    fieldSchema: buildAnagraficheFieldSchema(args.pending?.data.typeSlug ?? null),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.anagraficheCreate
          .temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);
    const resolvedType =
      typeof parsed?.typeText === "string" && parsed.typeText.trim()
        ? await resolveAnagraficaTypeWithLlm({
            message: parsed.typeText.trim(),
            traceCollector: args.traceCollector,
          })
        : args.pending?.data.typeSlug && args.pending?.data.typeLabel
          ? {
              slug: args.pending.data.typeSlug,
              label: args.pending.data.typeLabel,
            }
          : null;

    const validFieldKeys = resolvedType
      ? new Set(Object.keys(getAnagraficheList().find((item) => item.slug === resolvedType.slug)?.fields ?? {}))
      : null;
    const rawDraftData =
      parsed?.fieldValues && typeof parsed.fieldValues === "object"
        ? Object.fromEntries(
            Object.entries(parsed.fieldValues).filter(([fieldKey, value]) => {
              if (validFieldKeys && !validFieldKeys.has(fieldKey)) return false;
              if (value === null || typeof value === "undefined") return false;
              if (typeof value === "string" && !value.trim()) return false;
              if (Array.isArray(value) && !value.length) return false;
              return true;
            }),
          )
        : undefined;

    const result: AnagraficheCreateOperationContextFillResult = {
      kind: "anagrafiche_create",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      payloadPatch: {
        typeText:
          typeof parsed?.typeText === "string" && parsed.typeText.trim()
            ? parsed.typeText.trim()
            : undefined,
        typeSlug: resolvedType?.slug ?? undefined,
        typeLabel: resolvedType?.label ?? undefined,
        draftData: rawDraftData,
        confirmWrite: parsed?.confirmWrite === true,
      },
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };

    args.traceCollector?.({
      id: `fill-anagrafiche-create-${Date.now()}`,
      step: "operationContextFiller.anagraficheCreate",
      title: "Operation Filler Anagrafiche Create",
      reason:
        "Compilare il JSON di creazione anagrafica a partire dal contesto del turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-anagrafiche-create-${Date.now()}`,
      step: "operationContextFiller.anagraficheCreate",
      title: "Operation Filler Anagrafiche Create",
      reason:
        "Compilare il JSON di creazione anagrafica a partire dal contesto del turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(
        error?.message ?? "OPERATION_FILLER_ANAGRAFICHE_CREATE_FAILED",
      ),
    });
    return null;
  }
}

export async function runOperationContextFillerForGenericMail(args: {
  message: string;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  pending?: PendingGenericMailState | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<GenericMailOperationContextFillResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.genericMail.buildSystemPrompt();

  const payload = {
    message: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    pending: args.pending
      ? {
          phase: args.pending.phase ?? null,
          readiness: args.pending.readiness ?? null,
          missing: args.pending.missing,
          data: args.pending.data,
        }
      : null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.operationContextFiller.genericMail.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed: any = JSON.parse(jsonStr);

    const result: GenericMailOperationContextFillResult = {
      kind: "generic_mail",
      normalizedMessage:
        typeof parsed?.normalizedCompletionMessage === "string" &&
        parsed.normalizedCompletionMessage.trim()
          ? parsed.normalizedCompletionMessage.trim()
          : null,
      payloadPatch: {
        to:
          typeof parsed?.to === "string" && parsed.to.trim()
            ? parsed.to.trim().toLowerCase()
            : undefined,
        subject:
          typeof parsed?.subject === "string" && parsed.subject.trim()
            ? parsed.subject.trim()
            : undefined,
        message:
          typeof parsed?.message === "string" && parsed.message.trim()
            ? parsed.message.trim()
            : undefined,
      },
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };
    args.traceCollector?.({
      id: `fill-generic-mail-${Date.now()}`,
      step: "operationContextFiller.genericMail",
      title: "Operation Filler Generic Mail",
      reason: "Compilare i campi mancanti della mail generica con i dati del turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: result,
      status: "success",
      error: null,
    });
    return result;
  } catch (error: any) {
    args.traceCollector?.({
      id: `fill-generic-mail-${Date.now()}`,
      step: "operationContextFiller.genericMail",
      title: "Operation Filler Generic Mail",
      reason: "Compilare i campi mancanti della mail generica con i dati del turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "OPERATION_FILLER_GENERIC_MAIL_FAILED"),
    });
    return null;
  }
}

export function mergeCreateIntentWithOperationFill(args: {
  intent: EventCreateIntent | null;
  pending: PendingCreateState | null;
  fill: EventCreateOperationContextFillResult | null;
}): EventCreateIntent | null {
  if (!args.intent && !args.pending && !args.fill) {
    return null;
  }

  if (!args.fill) {
    return args.intent;
  }

  const basePayload: EventCreateIntent["payload"] = args.intent?.payload ?? {
    eventType:
      args.pending?.data.eventTypeSlug && args.pending?.data.eventTypeLabel
        ? {
            slug: args.pending.data.eventTypeSlug,
            label: args.pending.data.eventTypeLabel,
            score: 1,
            matchedBy: "pending_state",
          }
        : undefined,
    title: args.pending?.data.title ?? undefined,
    notes: args.pending?.data.notes ?? undefined,
    startAt: args.pending?.data.startAt ?? undefined,
    endAt: args.pending?.data.endAt ?? undefined,
    timeKind: (args.pending?.data.timeKind as TimeKind | undefined) ?? undefined,
  };

  const payload: EventCreateIntent["payload"] = {
    ...basePayload,
    eventType: args.fill.payloadPatch.eventType ?? basePayload.eventType,
    title: args.fill.payloadPatch.title ?? basePayload.title,
    notes:
      typeof args.fill.payloadPatch.notes === "undefined"
        ? basePayload.notes
        : args.fill.payloadPatch.notes,
    startAt: args.fill.payloadPatch.startAt ?? basePayload.startAt,
    endAt:
      typeof args.fill.payloadPatch.endAt === "undefined"
        ? basePayload.endAt
        : args.fill.payloadPatch.endAt,
    timeKind: args.fill.payloadPatch.timeKind ?? basePayload.timeKind,
  };

  const missing = resolveActionFieldState({
    actionKey: "event_create",
    data: {
      eventType: payload.eventType,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      timeKind: payload.timeKind,
      notes: payload.notes,
    },
  }).missing;

  return {
    type: "event_create",
    payload,
    missing,
    debug: {
      resolverMode: args.intent?.debug.resolverMode ?? "catalog_tokens",
      timeMissingDate: args.intent?.debug.timeMissingDate,
      timeWindow: args.intent?.debug.timeWindow,
    },
  };
}

export function mergeEventListIntentWithOperationFill(args: {
  intent: EventListIntent | null;
  pending: PendingEventListState | null;
  fill: EventListOperationContextFillResult | null;
}): EventListIntent | null {
  if (!args.intent && !args.pending && !args.fill) {
    return null;
  }

  const baseFilters: EventListIntent["filters"] = args.intent?.filters ?? {
    days: args.pending?.data.days ?? undefined,
    futureDays: args.pending?.data.futureDays ?? undefined,
    specificDate: args.pending?.data.specificDate ?? undefined,
    timeFrom: args.pending?.data.timeFrom ?? undefined,
    timeTo: args.pending?.data.timeTo ?? undefined,
    eventType:
      args.pending?.data.eventTypeSlug && args.pending?.data.eventTypeLabel
        ? {
            slug: args.pending.data.eventTypeSlug,
            label: args.pending.data.eventTypeLabel,
            score: 1,
            matchedBy: "pending_state",
          }
        : undefined,
    query: args.pending?.data.query ?? undefined,
    limit: args.pending?.data.limit ?? undefined,
    wantsAll: args.pending?.data.wantsAll ?? false,
  };

  if (!args.fill) {
    return args.intent ?? {
      type: "event_list",
      filters: baseFilters,
      explanation: "Built event list intent from pending state",
      debug: {
        resolverMode: "catalog_tokens",
      },
    };
  }

  const filters: EventListIntent["filters"] = {
    ...baseFilters,
    days: args.fill.filtersPatch.days ?? baseFilters.days,
    futureDays: args.fill.filtersPatch.futureDays ?? baseFilters.futureDays,
    specificDate:
      args.fill.filtersPatch.specificDate ?? baseFilters.specificDate,
    timeFrom: args.fill.filtersPatch.timeFrom ?? baseFilters.timeFrom,
    timeTo: args.fill.filtersPatch.timeTo ?? baseFilters.timeTo,
    eventType: args.fill.filtersPatch.eventType ?? baseFilters.eventType,
    query: args.fill.filtersPatch.query ?? baseFilters.query,
    limit: args.fill.filtersPatch.limit ?? baseFilters.limit,
    wantsAll:
      typeof args.fill.filtersPatch.wantsAll === "boolean"
        ? args.fill.filtersPatch.wantsAll
        : (baseFilters.wantsAll ?? false),
  };

  const bestEventType =
    baseFilters.eventType && args.fill.filtersPatch.eventType
      ? baseFilters.eventType.score >= args.fill.filtersPatch.eventType.score
        ? baseFilters.eventType
        : args.fill.filtersPatch.eventType
      : (args.fill.filtersPatch.eventType ?? baseFilters.eventType);
  filters.eventType = bestEventType;

  return {
    type: "event_list",
    filters,
    explanation:
      args.intent?.explanation ??
      "Merged event list intent with conversational context filler",
    debug: {
      resolverMode: args.intent?.debug.resolverMode ?? "catalog_tokens",
      ambiguousEventType:
        args.fill.ambiguousEventType ?? args.intent?.debug.ambiguousEventType,
      ambiguousTypeOptions:
        args.fill.ambiguousTypeOptions ??
        args.intent?.debug.ambiguousTypeOptions,
    },
  };
}
