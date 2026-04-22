import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.config";
import type { AnimaLlmTraceStep, AnimaRecentTurn } from "@/server-utils/anima/core/types";
import {
  buildScopedRegistryAwareness,
  type AnimaRegistryScope,
} from "@/server-utils/anima/core/registryAwareness";
import type { PendingOperationState } from "@/server-utils/anima/memory/sessionState";
import type {
  AnyOperationContextFillResult,
  EventCreateOperationContextFillResult,
  EventListOperationContextFillResult,
} from "@/server-utils/anima/nodes/operationContextFiller";
import { parseCreateTimeWindow, parseListRange } from "@/server-utils/anima/features/eventi/eventi.time";
import { resolveEventType } from "@/server-utils/anima/features/eventi/eventi.typeResolver";
import {
  mergePendingAnagraficheReadIntent,
  parseAnagraficheReadIntent,
} from "@/server-utils/anima/features/anagrafiche/anagrafiche.read";
import {
  mergePendingSprintTimelineReadIntent,
  parseSprintTimelineReadIntent,
} from "@/server-utils/anima/features/sprintTimeline/sprintTimeline.read";
import {
  detectMailAccept,
  detectMailDecline,
  extractEmailAddress,
  parseGenericMailIntent,
  resolveMailFollowupRecipient,
  resolveSelfRecipientEmail,
} from "@/server-utils/anima/features/mail/genericMail";

export type OperationSwitchDecision = {
  operation: PendingOperationState["operation"];
  decision: "continue" | "switch_out" | "cancel";
  normalizedMessage: string;
  shouldSubmit: boolean;
  confidence: number;
  why: string[];
  fillLike: AnyOperationContextFillResult | null;
};

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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeEventDomainRequest(normalizedMessage: string) {
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
  return eventSignals.some((token) => normalizedMessage.includes(token));
}

function hasExplicitAnagraficheDomainRequest(normalizedMessage: string) {
  return (
    normalizedMessage.includes("anagrafic") ||
    normalizedMessage.includes("fornitor") ||
    normalizedMessage.includes("client") ||
    normalizedMessage.includes("ent") ||
    normalizedMessage.includes("preventiv") ||
    normalizedMessage.includes("ricav") ||
    normalizedMessage.includes("articol") ||
    normalizedMessage.includes("serviz") ||
    normalizedMessage.includes("bando") ||
    normalizedMessage.includes("spes")
  );
}

function hasEventListLeadIn(normalizedMessage: string) {
  return [
    "cerca",
    "cercami",
    "cercar",
    "mostra",
    "mostrami",
    "fammi vedere",
    "vedi",
    "vedere",
    "elenca",
    "lista",
    "dammi",
    "mi dici",
    "puoi indicarmi",
    "puoi cercarmi",
    "vorrei cercare",
    "voglio cercare",
    "aggiornami",
  ].some((token) => normalizedMessage.includes(token));
}

function hasEventCreateLeadIn(normalizedMessage: string) {
  return [
    "crea",
    "aggiungi",
    "fissa",
    "programma",
    "inserisci",
    "ricordami",
    "ricordamelo",
    "mi ricordi",
    "nuovo evento",
    "nuovo memo",
    "nuovo appuntamento",
  ].some((token) => normalizedMessage.includes(token));
}

function parseDeterministicEventListPatch(normalizedMessage: string) {
  const eventType =
    looksLikeEventDomainRequest(normalizedMessage) &&
    !normalizedMessage.includes("evento diverso")
      ? resolveEventType({
          message: normalizedMessage,
          mode: "catalog_tokens",
        })
      : null;
  const range = parseListRange(normalizedMessage);
  const bareNumber = normalizedMessage.match(/^(\d{1,3})$/);
  const numericLimit = Number(bareNumber?.[1]);

  return {
    eventTypeText: eventType?.label ?? undefined,
    periodText:
      range.days || range.futureDays || range.specificDate
        ? normalizedMessage
        : undefined,
    wantsAll:
      normalizedMessage.includes("tutti") ||
      normalizedMessage.includes("tutte") ||
      normalizedMessage.includes("tutto"),
    limit:
      Number.isFinite(numericLimit) && numericLimit > 0
        ? Math.min(numericLimit, 50)
        : undefined,
  };
}

function looksLikeMailDomainRequest(normalizedMessage: string) {
  return (
    normalizedMessage.includes("mail") ||
    normalizedMessage.includes("email") ||
    normalizedMessage.includes("posta") ||
    normalizedMessage.includes("scrivi a") ||
    normalizedMessage.includes("manda a") ||
    normalizedMessage.includes("invia a")
  );
}

function buildFastDecision(args: {
  operation: PendingOperationState["operation"];
  decision: "continue" | "switch_out" | "cancel";
  normalizedMessage: string;
  confidence: number;
  why: string[];
  patch?: Record<string, unknown> | null;
  shouldSubmit?: boolean;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
  inputMessage: string;
}) {
  const result: OperationSwitchDecision = {
    operation: args.operation,
    decision: args.decision,
    normalizedMessage: args.normalizedMessage,
    shouldSubmit: args.shouldSubmit === true,
    confidence: args.confidence,
    why: args.why,
    fillLike:
      args.decision === "continue"
        ? buildFillLikeFromPatch({
            operation: args.operation,
            normalizedMessage: args.normalizedMessage,
            patch: args.patch ?? null,
            confidence: args.confidence,
            why: args.why,
          })
        : null,
  };

  args.traceCollector?.({
    id: `operation-switcher-${Date.now()}`,
    step: "operationSwitcher",
    title: "Operation Switcher",
    reason:
      "Decidere se il messaggio continua il task attivo o va rilasciato verso un nuovo dominio.",
    provider: "groq",
    model: "fast-path-guard",
    usage: null,
    purpose: "Fast path deterministico ad alta confidenza per evitare esitazioni e token inutili.",
    systemPrompt: "",
    input: {
      message: args.inputMessage,
      activeOperation: args.operation,
    },
    rawResponse: null,
    parsedResponse: result,
    status: "success",
    error: null,
  });

  return result;
}

function resolveRegistryScope(
  operation: PendingOperationState["operation"],
): AnimaRegistryScope {
  if (operation === "anagrafiche_read" || operation === "anagrafiche_create") {
    return "anagrafiche";
  }
  if (operation === "sprint_timeline_read") {
    return "sprint_timeline";
  }
  return "eventi";
}

function buildPatchContract(operation: PendingOperationState["operation"]) {
  switch (operation) {
    case "event_create":
      return {
        patchShape:
          "title?: string, notes?: string | null, eventTypeText?: string, timeText?: string, explicitNoNotes?: boolean",
        goal:
          "capire se il messaggio completa tipo evento, quando, titolo o note del create evento",
      };
    case "event_list":
      return {
        patchShape:
          "eventTypeText?: string, periodText?: string, query?: string, wantsAll?: boolean, limit?: number",
        goal: "capire se il messaggio restringe o completa i filtri della ricerca eventi",
      };
    case "mail_followup":
      return {
        patchShape:
          "recipient?: string, accept?: boolean, decline?: boolean",
        goal: "capire se l'utente conferma, rifiuta o cambia destinatario",
      };
    case "generic_mail":
      return {
        patchShape: "to?: string, subject?: string, message?: string",
        goal: "capire se il messaggio completa destinatario, oggetto o contenuto della mail",
      };
    case "sprint_timeline_read":
      return {
        patchShape:
          "mode?: active_tasks|due_tasks|priority_advice|owner_overview|delay_overview|task_breakdown, scope?: company|me_owner|me_reviewer|person, personNames?: string[], signals?: string[], priority?: urgent|high|medium|low|null, dueWithinDays?: number | null, taskQuery?: string | null, aggregateByOwner?: boolean",
        goal: "capire se il messaggio completa o restringe la query task",
      };
    case "anagrafiche_read":
      return {
        patchShape:
          "typeText?: string, query?: string, requestedFields?: string[], wantsList?: boolean",
        goal: "capire se il messaggio completa tipo, query o campi di lettura anagrafica",
      };
    case "anagrafiche_create":
      return {
        patchShape:
          "typeText?: string, fieldValues?: Record<string, unknown>, confirmWrite?: boolean",
        goal: "capire se il messaggio completa tipo, dati o conferma finale della create anagrafica",
      };
    default:
      return {
        patchShape: "{}",
        goal: "capire se il messaggio continua il task attivo",
      };
  }
}

function buildFillLikeFromPatch(args: {
  operation: PendingOperationState["operation"];
  normalizedMessage: string;
  patch: Record<string, unknown> | null | undefined;
  confidence: number;
  why: string[];
}): AnyOperationContextFillResult | null {
  const patch = args.patch ?? {};

  switch (args.operation) {
    case "event_create": {
      const eventTypeText =
        typeof patch.eventTypeText === "string" && patch.eventTypeText.trim()
          ? patch.eventTypeText.trim()
          : null;
      const eventType = eventTypeText
        ? resolveEventType({
            message: eventTypeText,
            mode: "catalog_tokens",
          })
        : null;
      const timeText =
        typeof patch.timeText === "string" && patch.timeText.trim()
          ? patch.timeText.trim()
          : null;
      const timeWindow = timeText ? parseCreateTimeWindow(timeText) : null;

      const result: EventCreateOperationContextFillResult = {
        kind: "event_create",
        normalizedMessage: args.normalizedMessage,
        payloadPatch: {
          title:
            typeof patch.title === "string" && patch.title.trim()
              ? patch.title.trim()
              : undefined,
          notes:
            patch.explicitNoNotes === true
              ? null
              : typeof patch.notes === "string" && patch.notes.trim()
                ? patch.notes.trim()
                : undefined,
          eventType: eventType ?? undefined,
          startAt: timeWindow?.startAt ?? undefined,
          endAt:
            typeof timeWindow?.endAt === "undefined"
              ? undefined
              : (timeWindow?.endAt ?? null),
          timeKind: timeWindow?.timeKind ?? undefined,
        },
        confidence: args.confidence,
        why: args.why,
      };
      return result;
    }

    case "event_list": {
      const eventTypeText =
        typeof patch.eventTypeText === "string" && patch.eventTypeText.trim()
          ? patch.eventTypeText.trim()
          : null;
      const eventType = eventTypeText
        ? resolveEventType({
            message: eventTypeText,
            mode: "catalog_tokens",
          })
        : null;
      const periodText =
        typeof patch.periodText === "string" && patch.periodText.trim()
          ? patch.periodText.trim()
          : null;
      const range = periodText ? parseListRange(periodText) : null;

      const result: EventListOperationContextFillResult = {
        kind: "event_list",
        normalizedMessage: args.normalizedMessage,
        filtersPatch: {
          days: range?.days ?? undefined,
          futureDays: range?.futureDays ?? undefined,
          specificDate: range?.specificDate ?? undefined,
          timeFrom: undefined,
          timeTo: undefined,
          eventType: eventType ?? undefined,
          query:
            typeof patch.query === "string" && patch.query.trim()
              ? patch.query.trim()
              : undefined,
          wantsAll: patch.wantsAll === true,
          limit:
            typeof patch.limit === "number" && Number.isFinite(patch.limit)
              ? patch.limit
              : undefined,
        },
        confidence: args.confidence,
        why: args.why,
      };
      return result;
    }

    case "mail_followup":
      return {
        kind: "mail_followup",
        normalizedMessage: args.normalizedMessage,
        recipient:
          typeof patch.recipient === "string" && patch.recipient.trim()
            ? patch.recipient.trim()
            : undefined,
        accept: patch.accept === true,
        decline: patch.decline === true,
        confidence: args.confidence,
        why: args.why,
      };

    case "generic_mail":
      return {
        kind: "generic_mail",
        normalizedMessage: args.normalizedMessage,
        payloadPatch: {
          to:
            typeof patch.to === "string" && patch.to.trim()
              ? patch.to.trim()
              : undefined,
          subject:
            typeof patch.subject === "string" && patch.subject.trim()
              ? patch.subject.trim()
              : undefined,
          message:
            typeof patch.message === "string" && patch.message.trim()
              ? patch.message.trim()
              : undefined,
        },
        confidence: args.confidence,
        why: args.why,
      };

    case "sprint_timeline_read":
      return {
        kind: "sprint_timeline_read",
        normalizedMessage: args.normalizedMessage,
        queryPatch: {
          mode:
            patch.mode === "active_tasks" ||
            patch.mode === "due_tasks" ||
            patch.mode === "priority_advice" ||
            patch.mode === "owner_overview" ||
            patch.mode === "delay_overview" ||
            patch.mode === "task_breakdown"
              ? patch.mode
              : undefined,
          scope:
            patch.scope === "company" ||
            patch.scope === "me_owner" ||
            patch.scope === "me_reviewer" ||
            patch.scope === "person"
              ? patch.scope
              : undefined,
          personNames: Array.isArray(patch.personNames)
            ? patch.personNames
                .map((item) => String(item).trim())
                .filter(Boolean)
            : undefined,
          signals: Array.isArray(patch.signals)
            ? patch.signals
                .map((item) => normalizeText(String(item)))
                .filter((item) =>
                  ["red", "yellow", "purple", "blue", "orange"].includes(item),
                ) as Array<"red" | "yellow" | "purple" | "blue" | "orange">
            : undefined,
          priority:
            patch.priority === "urgent" ||
            patch.priority === "high" ||
            patch.priority === "medium" ||
            patch.priority === "low"
              ? patch.priority
              : undefined,
          dueWithinDays:
            typeof patch.dueWithinDays === "number" &&
            Number.isFinite(patch.dueWithinDays)
              ? patch.dueWithinDays
              : undefined,
          taskQuery:
            typeof patch.taskQuery === "string" && patch.taskQuery.trim()
              ? patch.taskQuery.trim()
              : undefined,
          aggregateByOwner: patch.aggregateByOwner === true,
        },
        confidence: args.confidence,
        why: args.why,
      };

    case "anagrafiche_read":
      return {
        kind: "anagrafiche_read",
        normalizedMessage: args.normalizedMessage,
        queryPatch: {
          typeText:
            typeof patch.typeText === "string" && patch.typeText.trim()
              ? patch.typeText.trim()
              : undefined,
          query:
            typeof patch.query === "string" && patch.query.trim()
              ? patch.query.trim()
              : undefined,
          requestedFields: Array.isArray(patch.requestedFields)
            ? patch.requestedFields
                .map((item) => String(item).trim())
                .filter(Boolean) as any
            : undefined,
          wantsList: patch.wantsList === true,
        },
        confidence: args.confidence,
        why: args.why,
      };

    case "anagrafiche_create":
      return {
        kind: "anagrafiche_create",
        normalizedMessage: args.normalizedMessage,
        payloadPatch: {
          typeText:
            typeof patch.typeText === "string" && patch.typeText.trim()
              ? patch.typeText.trim()
              : undefined,
          draftData:
            patch.fieldValues && typeof patch.fieldValues === "object"
              ? (patch.fieldValues as Record<string, unknown>)
              : undefined,
          confirmWrite: patch.confirmWrite === true,
        },
        confidence: args.confidence,
        why: args.why,
      };

    default:
      return null;
  }
}

export async function runOperationSwitcher(args: {
  message: string;
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  operationState: PendingOperationState;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<OperationSwitchDecision | null> {
  const normalizedMessage = normalizeText(args.message);
  const parsedSprintIntent = parseSprintTimelineReadIntent({
    message: args.message,
    userDisplayName: args.userDisplayName ?? null,
  });

  if (
    args.operationState.operation === "event_create" &&
    looksLikeEventDomainRequest(normalizedMessage) &&
    hasEventListLeadIn(normalizedMessage) &&
    !hasEventCreateLeadIn(normalizedMessage)
  ) {
    const forcedResult: OperationSwitchDecision = {
      operation: args.operationState.operation,
      decision: "switch_out",
      normalizedMessage: args.message,
      shouldSubmit: false,
      confidence: 0.97,
      why: [
        "messaggio chiaramente formulato come ricerca eventi",
        "pending create rilasciato senza chiedere conferme superflue",
      ],
      fillLike: null,
    };
    args.traceCollector?.({
      id: `operation-switcher-${Date.now()}`,
      step: "operationSwitcher",
      title: "Operation Switcher",
      reason:
        "Decidere se il messaggio continua il task attivo o va rilasciato verso un nuovo dominio.",
      provider: "groq",
      model: "forced-switch-guard",
      usage: null,
      purpose: "Fast path ad alta confidenza per evitare esitazioni inutili tra create e list.",
      systemPrompt: "",
      input: {
        message: args.message,
        activeOperation: args.operationState.operation,
      },
      rawResponse: null,
      parsedResponse: forcedResult,
      status: "success",
      error: null,
    });
    return forcedResult;
  }

  if (
    args.operationState.operation === "event_list" &&
    looksLikeEventDomainRequest(normalizedMessage) &&
    !hasEventCreateLeadIn(normalizedMessage)
  ) {
    const deterministicPatch = parseDeterministicEventListPatch(normalizedMessage);
    if (
      deterministicPatch.eventTypeText ||
      deterministicPatch.periodText ||
      deterministicPatch.wantsAll ||
      typeof deterministicPatch.limit === "number"
    ) {
      const forcedResult: OperationSwitchDecision = {
        operation: args.operationState.operation,
        decision: "continue",
        normalizedMessage: args.message,
        shouldSubmit: false,
        confidence: 0.93,
        why: [
          "messaggio compatibile con raffinamento dei filtri eventi",
          "continuazione risolta deterministicamente ad alta confidenza",
        ],
        fillLike: buildFillLikeFromPatch({
          operation: "event_list",
          normalizedMessage: args.message,
          patch: deterministicPatch,
          confidence: 0.93,
          why: [
            "messaggio compatibile con raffinamento dei filtri eventi",
            "continuazione risolta deterministicamente ad alta confidenza",
          ],
        }),
      };
      args.traceCollector?.({
        id: `operation-switcher-${Date.now()}`,
        step: "operationSwitcher",
        title: "Operation Switcher",
        reason:
          "Decidere se il messaggio continua il task attivo o va rilasciato verso un nuovo dominio.",
        provider: "groq",
        model: "forced-continue-guard",
        usage: null,
        purpose: "Fast path ad alta confidenza per continuare una ricerca eventi gia aperta.",
        systemPrompt: "",
        input: {
          message: args.message,
          activeOperation: args.operationState.operation,
        },
        rawResponse: null,
        parsedResponse: forcedResult,
        status: "success",
        error: null,
      });
      return forcedResult;
    }
  }

  if (
    args.operationState.operation === "anagrafiche_read" &&
    !looksLikeEventDomainRequest(normalizedMessage) &&
    !looksLikeMailDomainRequest(normalizedMessage) &&
    !parsedSprintIntent
  ) {
    const mergedIntent = mergePendingAnagraficheReadIntent({
      pending: args.operationState,
      message: args.message,
    });
    const parsedAnagraficheNow = parseAnagraficheReadIntent(args.message);
    const candidateSelection =
      normalizedMessage.includes("primo") ||
      normalizedMessage.includes("prima") ||
      normalizedMessage.includes("secondo") ||
      normalizedMessage.includes("seconda") ||
      /\b[1-9]\b/.test(normalizedMessage);

    if (
      parsedAnagraficheNow ||
      candidateSelection ||
      normalizedMessage.includes("tutti i campi") ||
      normalizedMessage.includes("tutto il record") ||
      normalizedMessage.includes("email") ||
      normalizedMessage.includes("telefono") ||
      normalizedMessage.includes("indirizzo") ||
      normalizedMessage.includes("note")
    ) {
      return buildFastDecision({
        operation: args.operationState.operation,
        decision: "continue",
        normalizedMessage: args.message,
        confidence: 0.9,
        why: [
          "messaggio compatibile con completamento della lettura anagrafica",
          "continuazione risolta deterministicamente ad alta confidenza",
        ],
        patch: {
          typeText: mergedIntent.query.typeLabel ?? undefined,
          query: mergedIntent.query.query ?? undefined,
          requestedFields: mergedIntent.query.requestedFields ?? undefined,
          wantsList: mergedIntent.query.wantsList === true,
        },
        traceCollector: args.traceCollector,
        inputMessage: args.message,
      });
    }
  }

  if (
    args.operationState.operation === "sprint_timeline_read" &&
    !looksLikeEventDomainRequest(normalizedMessage) &&
    !looksLikeMailDomainRequest(normalizedMessage) &&
    !hasExplicitAnagraficheDomainRequest(normalizedMessage)
  ) {
    if (parsedSprintIntent) {
      const mergedIntent = mergePendingSprintTimelineReadIntent({
        pending: args.operationState,
        message: args.message,
        userDisplayName: args.userDisplayName ?? null,
      });
      return buildFastDecision({
        operation: args.operationState.operation,
        decision: "continue",
        normalizedMessage: args.message,
        confidence: 0.91,
        why: [
          "messaggio compatibile con raffinamento della query taskboard",
          "continuazione task risolta deterministicamente ad alta confidenza",
        ],
        patch: {
          mode: mergedIntent.query.mode,
          scope: mergedIntent.query.scope ?? undefined,
          personNames: mergedIntent.query.personNames ?? undefined,
          signals: mergedIntent.query.signals ?? undefined,
          priority: mergedIntent.query.priority ?? undefined,
          dueWithinDays: mergedIntent.query.dueWithinDays ?? undefined,
          taskQuery: mergedIntent.query.taskQuery ?? undefined,
          aggregateByOwner: mergedIntent.query.aggregateByOwner === true,
        },
        traceCollector: args.traceCollector,
        inputMessage: args.message,
      });
    }
  }

  if (
    (args.operationState.operation === "anagrafiche_read" ||
      args.operationState.operation === "anagrafiche_create") &&
    looksLikeEventDomainRequest(normalizedMessage) &&
    !hasExplicitAnagraficheDomainRequest(normalizedMessage)
  ) {
    const forcedResult: OperationSwitchDecision = {
      operation: args.operationState.operation,
      decision: "switch_out",
      normalizedMessage: args.message,
      shouldSubmit: false,
      confidence: 0.96,
      why: [
        "messaggio chiaramente nel dominio eventi",
        "pending anagrafiche rilasciato per evitare sconfinamento di dominio",
      ],
      fillLike: null,
    };
    args.traceCollector?.({
      id: `operation-switcher-${Date.now()}`,
      step: "operationSwitcher",
      title: "Operation Switcher",
      reason:
        "Decidere se il messaggio continua il task attivo o va rilasciato verso un nuovo dominio.",
      provider: "groq",
      model: "forced-domain-guard",
      usage: null,
      purpose: "Guardia di dominio tra pending specialistico e nuovo intento.",
      systemPrompt: "",
      input: {
        message: args.message,
        activeOperation: args.operationState.operation,
      },
      rawResponse: null,
      parsedResponse: forcedResult,
      status: "success",
      error: null,
    });
    return forcedResult;
  }

  if (args.operationState.operation === "mail_followup") {
    const recipient = resolveMailFollowupRecipient({
      message: args.message,
      pending: args.operationState,
    });
    const accept = detectMailAccept(args.message);
    const decline = detectMailDecline(args.message);
    if (typeof recipient !== "undefined" || accept || decline) {
      return buildFastDecision({
        operation: args.operationState.operation,
        decision: "continue",
        normalizedMessage: args.message,
        confidence: 0.94,
        why: [
          "messaggio compatibile con conferma o destinatario del follow-up mail",
          "continuazione mail risolta deterministicamente ad alta confidenza",
        ],
        patch: {
          recipient: recipient ?? undefined,
          accept,
          decline,
        },
        traceCollector: args.traceCollector,
        inputMessage: args.message,
      });
    }
  }

  if (args.operationState.operation === "generic_mail") {
    const parsedMail = parseGenericMailIntent(args.message);
    const explicitEmail = extractEmailAddress(args.message);
    const selfRecipient = resolveSelfRecipientEmail({
      message: args.message,
      defaultEmail: args.operationState.data.to ?? null,
    });

    if (parsedMail || explicitEmail || selfRecipient) {
      return buildFastDecision({
        operation: args.operationState.operation,
        decision: "continue",
        normalizedMessage: args.message,
        confidence: 0.9,
        why: [
          "messaggio compatibile con completamento della mail generica",
          "continuazione mail risolta deterministicamente ad alta confidenza",
        ],
        patch: {
          to: parsedMail?.to ?? explicitEmail ?? selfRecipient ?? undefined,
          subject: parsedMail?.subject ?? undefined,
          message: parsedMail?.message ?? undefined,
        },
        traceCollector: args.traceCollector,
        inputMessage: args.message,
      });
    }
  }

  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationSwitcher;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.operationSwitcher.buildSystemPrompt();
  const patchContract = buildPatchContract(args.operationState.operation);
  const payload = {
    message: args.message,
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    activeOperation: {
      operation: args.operationState.operation,
      phase: args.operationState.phase ?? null,
      readiness: args.operationState.readiness ?? null,
      missing: args.operationState.missing,
      data: args.operationState.data,
    },
    patchContract,
    registryAwareness: buildScopedRegistryAwareness(
      resolveRegistryScope(args.operationState.operation),
    ),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.operationSwitcher.temperature,
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
    const decision =
      parsed?.decision === "switch_out" ||
      parsed?.decision === "cancel" ||
      parsed?.decision === "continue"
        ? parsed.decision
        : "continue";
    const confidence = normalizeConfidence(parsed?.confidence);
    const why = normalizeWhy(parsed?.why);
    const normalizedMessage =
      typeof parsed?.normalizedMessage === "string" &&
      parsed.normalizedMessage.trim()
        ? parsed.normalizedMessage.trim()
        : args.message;

    const result: OperationSwitchDecision = {
      operation: args.operationState.operation,
      decision,
      normalizedMessage:
        decision === "cancel" ? "annulla operazione" : normalizedMessage,
      shouldSubmit: parsed?.shouldSubmit === true,
      confidence,
      why,
      fillLike:
        decision === "continue"
          ? buildFillLikeFromPatch({
              operation: args.operationState.operation,
              normalizedMessage,
              patch:
                parsed?.patch && typeof parsed.patch === "object"
                  ? parsed.patch
                  : null,
              confidence,
              why,
            })
          : null,
    };

    args.traceCollector?.({
      id: `operation-switcher-${Date.now()}`,
      step: "operationSwitcher",
      title: "Operation Switcher",
      reason:
        "Decidere se un messaggio continua, annulla o abbandona una operazione gia aperta.",
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
      id: `operation-switcher-${Date.now()}`,
      step: "operationSwitcher",
      title: "Operation Switcher",
      reason:
        "Decidere se un messaggio continua, annulla o abbandona una operazione gia aperta.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "OPERATION_SWITCHER_FAILED"),
    });
    return null;
  }
}
