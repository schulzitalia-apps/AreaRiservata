/**
 * agentLoop.ts
 *
 * Core del runtime agente di Anima.
 * Gestisce il ciclo state-machine: parsing → routing → executor → risultato.
 *
 * Ogni turno:
 *  1. Sense Interpreter → normalizza e classifica il messaggio
 *  2. Operation Context Filler → arricchisce il payload se c'è op. pending
 *  3. Intent Parsing → produce i vari intent (create/list/recent/mail)
 *  4. Operation Router → decide il branch
 *  5. Domain Executor → esegue il ramo corretto e produce il risultato
 */

import type { AnimaAgentState } from "./agentState";
import type { AnimaRunResult } from "./types";
import { ANIMA_COMPONENT_CONFIG } from "./anima.config";
import { ANIMA_RUNTIME_CONFIG } from "../config/anima.runtime.config";

import { evaluateOperationGuardrails } from "./operationGuardrails";
import { saveConversationState } from "../memory/conversationState";
import { clearOperationState } from "../memory/sessionState";
import { buildAnimaRunResult } from "./stateHelpers";
import {
  composeFinalResponse,
  composeWelcomeReply,
} from "../nodes/responseComposer";
import { buildResponseGuidance } from "./responseGuidance";
import { buildScopedRegistryAwareness } from "./registryAwareness";

import { runSenseInterpreter } from "../nodes/senseInterpreter";
import {
  runOperationContextFillerForAnagraficheCreate,
  mergeCreateIntentWithOperationFill,
  runOperationContextFillerForAnagraficheRead,
  runOperationContextFillerForCreate,
  runOperationContextFillerForEventList,
  runOperationContextFillerForGenericMail,
  runOperationContextFillerForMailFollowup,
  runOperationContextFillerForSprintTimelineRead,
} from "../nodes/operationContextFiller";
import { runEmotionalGuardrail } from "../nodes/emotionalGuardrail";
import { routeAnimaOperation } from "../nodes/operationRouter";
import { runOperationSwitcher } from "../nodes/operationSwitcher";

import { detectReminderMailIntent } from "../features/mail/animaReminderMail";
import { parseGenericMailIntent } from "../features/mail/genericMail";
import {
  mergePendingCreateState,
  parseEventCreateContinuation,
  parseEventCreateIntent,
} from "../features/eventi/eventi.create";
import { parseEventListIntent } from "../features/eventi/eventi.list";
import { parseRecentEventsIntent } from "../features/eventi/eventi.recent";
import { detectLowValuePrompt } from "../features/eventi/eventi.lowValue";
import { detectUnsupportedReminderRequest } from "../features/eventi/eventi.guardrails";
import { supportsEventDiscovery } from "../features/eventi/eventi.context";
import { detectGreeting } from "../features/eventi/eventi.lowValue";
import { buildWelcomeReply } from "../responders/conversation";

import { executeEventiBranch } from "../features/eventi/eventi.executor";
import { executeMailBranch } from "../features/mail/mail.executor";
import { executeConversationBranch } from "../features/conversation/conversation.executor";
import { parseAnagraficheCreateIntent } from "../features/anagrafiche/anagrafiche.create";
import { parseAnagraficheReadIntent } from "../features/anagrafiche/anagrafiche.read";
import { executeAnagraficheBranch } from "../features/anagrafiche/anagrafiche.executor";
import { parseSprintTimelineReadIntent } from "../features/sprintTimeline/sprintTimeline.read";
import { executeSprintTimelineBranch } from "../features/sprintTimeline/sprintTimeline.executor";

function mapOperationToCapability(
  operation: AnimaAgentState["operationState"] extends infer T
    ? T extends { operation: infer O }
      ? O
      : never
    : never,
): string | null {
  switch (operation) {
    case "event_create":
      return "event_create";
    case "event_list":
      return "event_list";
    case "mail_followup":
      return "mail_followup";
    case "generic_mail":
      return "generic_mail";
    case "sprint_timeline_read":
      return "sprint_timeline_read";
    case "anagrafiche_read":
      return "anagrafiche_read";
    case "anagrafiche_create":
      return "anagrafiche_create";
    default:
      return null;
  }
}

function resolveOperationArbitration(args: {
  operationState: AnimaAgentState["operationState"];
  senseInterpretation: AnimaAgentState["senseInterpretation"];
  originalMessage: string;
}) {
  const activeOperation = args.operationState?.operation ?? null;
  const activeCapability = activeOperation
    ? mapOperationToCapability(activeOperation)
    : null;
  const nextCapability = args.senseInterpretation?.likelyCapability ?? null;

  if (!activeOperation || !args.senseInterpretation) {
    return {
      action: "keep" as const,
      reason: "no_active_operation_or_no_sense",
      fromOperation: activeOperation,
      toCapability: nextCapability,
    };
  }

  if (args.senseInterpretation.operationDecision !== "open_new") {
    return {
      action: "keep" as const,
      reason: "sense_not_opening_new_operation",
      fromOperation: activeOperation,
      toCapability: nextCapability,
    };
  }

  if (
    !nextCapability ||
    nextCapability === "unknown" ||
    nextCapability === "help" ||
    nextCapability === "mail_followup"
  ) {
    return {
      action: "keep" as const,
      reason: "sense_capability_not_specific_enough_for_switch",
      fromOperation: activeOperation,
      toCapability: nextCapability,
    };
  }

  if (args.senseInterpretation.confidence < 0.58) {
    return {
      action: "keep" as const,
      reason: "sense_confidence_too_low_for_switch",
      fromOperation: activeOperation,
      toCapability: nextCapability,
    };
  }

  if (activeCapability === nextCapability) {
    const normalizedMessage = args.originalMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    const looksLikeFreshRequest =
      normalizedMessage.split(/\s+/).length >= 4 &&
      (normalizedMessage.includes("?") ||
        normalizedMessage.includes("mostr") ||
        normalizedMessage.includes("ved") ||
        normalizedMessage.includes("cerc") ||
        normalizedMessage.includes("dimm") ||
        normalizedMessage.includes("quali") ||
        normalizedMessage.includes("cosa"));
    const switchableReadOperation =
      activeOperation === "event_list" ||
      activeOperation === "anagrafiche_read" ||
      activeOperation === "sprint_timeline_read";

    if (switchableReadOperation && looksLikeFreshRequest) {
      return {
        action: "drop_active" as const,
        reason: "same_capability_but_fresh_request_restart",
        fromOperation: activeOperation,
        toCapability: nextCapability,
      };
    }

    return {
      action: "keep" as const,
      reason: "same_capability_family_keep_active_operation",
      fromOperation: activeOperation,
      toCapability: nextCapability,
    };
  }

  return {
    action: "drop_active" as const,
    reason: "sense_requested_new_operation_with_different_capability",
    fromOperation: activeOperation,
    toCapability: nextCapability,
  };
}

function buildListingAwareComposerText(args: {
  composedText: string;
  staticFallbackText: string;
  finalResult: AnimaRunResult;
}): string {
  const presentation = args.finalResult.meta.debug?.listingPresentation;
  if (
    !presentation ||
    presentation.mode !== "verbatim_list" ||
    !presentation.listBlock
  ) {
    return args.composedText;
  }

  const footer = presentation.footer ? `\n\n${presentation.footer}` : "";
  const cleanedIntro = args.composedText.trim().replace(/[:.\s]+$/, "");
  if (!cleanedIntro) {
    return args.staticFallbackText;
  }

  return `${cleanedIntro}:\n\n${presentation.listBlock}${footer}`;
}

function buildOperationResultForComposer(finalResult: AnimaRunResult): Record<string, any> {
  const debug = finalResult.meta.debug ?? {};
  const staticFallbackText = finalResult.reply.text;
  const compactItems = Array.isArray(debug?.items)
    ? debug.items.slice(0, 6).map((item: any) => ({
        id: item?.id ?? null,
        title: item?.title ?? item?.displayName ?? item?.label ?? null,
        subtitle: item?.subtitle ?? null,
        stateLabel: item?.stateLabel ?? null,
        priority: item?.priority ?? null,
        daysRemaining:
          typeof item?.daysRemaining === "number" ? item.daysRemaining : null,
        ownerName: item?.ownerName ?? null,
        nextPassageLabel: item?.nextPassageLabel ?? null,
        summaryReason: item?.summaryReason ?? null,
      }))
    : [];

  return {
    strategy: finalResult.meta.strategy,
    action: debug?.matchedBy ?? finalResult.meta.strategy,
    status:
      finalResult.meta.strategy === "welcome_greeting"
        ? "welcome"
        : finalResult.meta.strategy === "event_create_clarification" ||
            finalResult.meta.strategy === "event_list_clarification" ||
            finalResult.meta.strategy === "mail_clarification" ||
            finalResult.meta.strategy === "anagrafiche_query_clarification" ||
            finalResult.meta.strategy === "anagrafiche_create_clarification" ||
            finalResult.meta.strategy === "sprint_timeline_query_clarification"
          ? "collecting"
          : finalResult.meta.strategy === "not_understood" ||
              finalResult.meta.strategy === "low_value_guardrail" ||
              finalResult.meta.strategy === "anagrafiche_create_denied" ||
              finalResult.meta.strategy === "reminder_guardrail"
            ? "needs_redirect"
            : "success",
    ...(finalResult.meta.strategy === "event_create_clarification" && {
      pendingMissing: debug?.missing ?? [],
      eventTypeLabel: debug?.payload?.eventType?.label ?? null,
      askedFor: debug?.missing?.[0] ?? null,
    }),
    ...(finalResult.meta.strategy === "event_list" && {
      total: debug?.total ?? 0,
      returned: debug?.returned ?? 0,
      items: compactItems,
      listingPresentation: debug?.listingPresentation ?? null,
    }),
    ...(finalResult.meta.strategy === "event_list_clarification" && {
      pendingMissing: debug?.missing ?? [],
      filters: debug?.filters ?? null,
      askedFor: debug?.missing?.[0] ?? null,
    }),
    ...(finalResult.meta.strategy === "event_recent_summary" && {
      days: debug?.days ?? 7,
      total: debug?.total ?? 0,
    }),
    ...(finalResult.meta.strategy === "anagrafiche_read" && {
      total: debug?.total ?? 0,
      items: compactItems,
      listingPresentation: debug?.listingPresentation ?? null,
    }),
    ...(finalResult.meta.strategy === "anagrafiche_query_clarification" && {
      pendingMissing: debug?.missing ?? [],
      askedFor: debug?.missing?.[0] ?? null,
    }),
    ...(finalResult.meta.strategy === "anagrafiche_create_clarification" && {
      pendingMissing: debug?.missing ?? [],
      askedFor: debug?.missing?.[0] ?? null,
      typeLabel: debug?.query?.typeLabel ?? null,
      draftData: debug?.query?.draftData ?? null,
    }),
    ...(finalResult.meta.strategy === "anagrafiche_create" && {
      typeLabel: debug?.typeLabel ?? null,
      createdId: debug?.createdId ?? null,
      summaryLines: debug?.summaryLines ?? [],
    }),
    ...(finalResult.meta.strategy === "event_create" && {
      eventTypeLabel: debug?.payload?.eventType?.label ?? null,
      title: debug?.payload?.title ?? null,
    }),
    ...(finalResult.meta.strategy === "mail_reminder_sent" && {
      email: debug?.mail?.to ?? null,
    }),
    staticSuggestion: staticFallbackText,
  };
}

function getScopedRecentTurnsForSense(
  state: AnimaAgentState,
) {
  return state.operationState ? state.context.recentTurns.slice(-2) : [];
}

function getScopedSummaryForSense(
  state: AnimaAgentState,
) {
  return state.operationState ? state.conversationSummary : "";
}

function getScopedRecentTurnsForSpecialist(
  recentTurns: AnimaAgentState["context"]["recentTurns"],
  pending: boolean,
) {
  return pending ? recentTurns.slice(-2) : [];
}

function getScopedSummaryForSpecialist(
  conversationSummary: string | null | undefined,
  pending: boolean,
) {
  return pending ? conversationSummary ?? "" : "";
}

function mergeOperationContextFills(
  baseFill: AnimaAgentState["operationContextFill"],
  overlayFill: AnimaAgentState["operationContextFill"],
) {
  if (!baseFill) return overlayFill;
  if (!overlayFill) return baseFill;
  if (baseFill.kind !== overlayFill.kind) return overlayFill;
  const base: any = baseFill;
  const overlay: any = overlayFill;

  switch (baseFill.kind) {
    case "event_create":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        payloadPatch: {
          ...base.payloadPatch,
          ...overlay.payloadPatch,
        },
      };
    case "event_list":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        filtersPatch: {
          ...base.filtersPatch,
          ...overlay.filtersPatch,
        },
      };
    case "mail_followup":
      return {
        ...baseFill,
        ...overlayFill,
        normalizedMessage:
          overlayFill.normalizedMessage ?? baseFill.normalizedMessage,
      };
    case "generic_mail":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        payloadPatch: {
          ...base.payloadPatch,
          ...overlay.payloadPatch,
        },
      };
    case "sprint_timeline_read":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        queryPatch: {
          ...base.queryPatch,
          ...overlay.queryPatch,
        },
      };
    case "anagrafiche_read":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        queryPatch: {
          ...base.queryPatch,
          ...overlay.queryPatch,
        },
      };
    case "anagrafiche_create":
      return {
        ...base,
        ...overlay,
        normalizedMessage:
          overlay.normalizedMessage ?? base.normalizedMessage,
        payloadPatch: {
          ...base.payloadPatch,
          ...overlay.payloadPatch,
        },
      };
    default:
      return overlayFill;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Loop entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esegue un singolo turno della pipeline agentica.
 * Ritorna lo stato finale con `isTerminal = true` e `finalResult` valorizzato.
 */
export async function runAnimaLoop(
  initialState: AnimaAgentState,
): Promise<AnimaAgentState> {
  let state = { ...initialState };

  // ── STEP 1: Greeting shortcut ────────────────────────────────────────────
  if (
    ANIMA_COMPONENT_CONFIG.greeting.enabled &&
    detectGreeting(state.originalMessage) &&
    (!ANIMA_COMPONENT_CONFIG.greeting.welcomeOnlyOncePerSession ||
      !state.conversationState?.hasWelcomed)
  ) {
    await saveConversationState(state.context.session.sessionId, {
      hasWelcomed: true,
      stage: "active",
      updatedAt: new Date().toISOString(),
    });

    const fallbackText = buildWelcomeReply(
      state.context.user.displayName ?? state.context.user.fullName,
    );
    const dynamicWelcome = await composeWelcomeReply({
      userDisplayName:
        state.context.user.displayName ?? state.context.user.fullName,
      recentTurns: state.context.recentTurns,
      conversationSummary: state.conversationSummary,
      capabilities: ANIMA_COMPONENT_CONFIG.texts.welcomeCapabilities,
      examples: ANIMA_COMPONENT_CONFIG.texts.helpExamples.map(
        (item) => item.prompt,
      ),
      registryAwareness: buildScopedRegistryAwareness("all"),
      traceCollector: (step) => state.llmTrace.push(step),
    });

    const result = await buildAnimaRunResult(state, {
      text: dynamicWelcome ?? fallbackText,
      strategy: "welcome_greeting",
      usedCapabilities: ["conversation.help.events"],
      debug: {
        matchedBy: "welcome_greeting",
        alreadyComposed: !!dynamicWelcome,
        conversationStateAfter: { hasWelcomed: true, stage: "active" },
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });

    if (
      ANIMA_RUNTIME_CONFIG.targetRuntime.enabled &&
      ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer?.model
    ) {
      const responseGuidance = buildResponseGuidance({
        state,
        finalResult: result,
      });
      const memorySupport = {
        summary: state.conversationSummary ?? null,
        activeOperation: null,
        recentTurns: state.context.recentTurns,
      };

      try {
        const composedText = await composeFinalResponse({
          userDisplayName:
            state.context.user.displayName ?? state.context.user.fullName,
          conversationSummary: state.conversationSummary,
          recentTurns: state.context.recentTurns,
          message: state.originalMessage,
          operationResult: buildOperationResultForComposer(result),
          memorySupport,
          responseGuidance,
          registryAwareness: buildScopedRegistryAwareness("all"),
          traceCollector: (step) => state.llmTrace.push(step),
        });

        if (composedText && composedText.trim().length > 0) {
          result.reply.text = composedText;
          result.meta.debug = {
            ...result.meta.debug,
            responseComposerUsed: true,
            memorySupport,
            responseGuidance,
          };
        }
      } catch (_composerErr) {
        // fallback silenzioso al testo gia composto
      }
    }

    return { ...state, isTerminal: true, finalResult: result };
  }

  // ── STEP 2: Sense Interpreter ────────────────────────────────────────────
  let interpretedMessage = state.originalMessage;
  let operationSwitchDecision = state.operationSwitchDecision;

  if (state.operationState) {
    operationSwitchDecision = await runOperationSwitcher({
      message: state.originalMessage,
      userDisplayName:
        state.context.user.displayName ?? state.context.user.fullName,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        true,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        true,
      ),
      operationState: state.operationState,
      traceCollector: (step) => state.llmTrace.push(step),
    });

    if (operationSwitchDecision?.decision === "switch_out") {
      await clearOperationState(state.context.session.sessionId);
      state = {
        ...state,
        operationState: null,
        operationSwitchDecision,
      };
    } else {
      interpretedMessage =
        operationSwitchDecision?.normalizedMessage ?? state.originalMessage;
      state = {
        ...state,
        interpretedMessage,
        operationSwitchDecision,
      };
    }
  }

  const shouldRunThresholdSense =
    !state.operationState || operationSwitchDecision?.decision === "switch_out";

  const senseInterpretation = shouldRunThresholdSense
    ? await runSenseInterpreter({
        message: state.originalMessage,
        language: state.context.session.language,
        userDisplayName:
          state.context.user.displayName ?? state.context.user.fullName,
        recentTurns: getScopedRecentTurnsForSense(state),
        conversationSummary: getScopedSummaryForSense(state),
        operationState: state.operationState,
        hasWelcomed: state.conversationState?.hasWelcomed ?? false,
        traceCollector: (step) => state.llmTrace.push(step),
      })
    : null;

  interpretedMessage =
    operationSwitchDecision?.decision === "continue" ||
    operationSwitchDecision?.decision === "cancel"
      ? interpretedMessage
      : (senseInterpretation?.normalizedMessage ?? interpretedMessage);

  const operationArbitration = shouldRunThresholdSense
    ? resolveOperationArbitration({
        operationState: state.operationState,
        senseInterpretation,
        originalMessage: state.originalMessage,
      })
    : {
        action: "keep" as const,
        reason: "active_operation_controlled_by_operation_switcher",
        fromOperation: state.operationState?.operation ?? null,
        toCapability: null,
      };

  if (
    shouldRunThresholdSense &&
    operationArbitration.action === "drop_active" &&
    state.operationState
  ) {
    await clearOperationState(state.context.session.sessionId);
    state = {
      ...state,
      operationState: null,
      senseInterpretation,
      interpretedMessage,
      operationArbitration,
      operationSwitchDecision,
    };
  } else {
    state = {
      ...state,
      senseInterpretation,
      interpretedMessage,
      operationArbitration,
      operationSwitchDecision,
    };
  }

  // ── STEP 3: Operation Context Filler (se c'è un'op. pending) ────────────
  const pendingCreate =
    state.operationState?.operation === "event_create"
      ? state.operationState
      : null;
  const pendingMailFollowup =
    state.operationState?.operation === "mail_followup"
      ? state.operationState
      : null;
  const pendingGenericMail =
    state.operationState?.operation === "generic_mail"
      ? state.operationState
      : null;
  const pendingEventList =
    state.operationState?.operation === "event_list"
      ? state.operationState
      : null;
  const pendingSprintTimelineRead =
    state.operationState?.operation === "sprint_timeline_read"
      ? state.operationState
      : null;
  const pendingAnagraficheRead =
    state.operationState?.operation === "anagrafiche_read"
      ? state.operationState
      : null;
  const pendingAnagraficheCreate =
    state.operationState?.operation === "anagrafiche_create"
      ? state.operationState
      : null;

  let operationContextFill =
    operationSwitchDecision?.decision === "continue"
      ? operationSwitchDecision.fillLike
      : state.operationContextFill;

  if (pendingCreate) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForCreate({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        true,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        true,
      ),
      pending: pendingCreate,
      resolverMode: state.resolverMode,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (senseInterpretation?.likelyCapability === "event_create") {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForCreate({
      message: state.originalMessage,
      recentTurns: [],
      conversationSummary: "",
      pending: null,
      resolverMode: state.resolverMode,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (pendingMailFollowup) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForMailFollowup({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        true,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        true,
      ),
      pending: pendingMailFollowup,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (pendingGenericMail) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForGenericMail({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        true,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        true,
      ),
      pending: pendingGenericMail,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (senseInterpretation?.likelyCapability === "generic_mail") {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForGenericMail({
      message: state.originalMessage,
      recentTurns: [],
      conversationSummary: "",
      pending: null,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (
    pendingEventList ||
    senseInterpretation?.likelyCapability === "event_list"
  ) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForEventList({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        !!pendingEventList,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        !!pendingEventList,
      ),
      pending: pendingEventList,
      resolverMode: state.resolverMode,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (
    pendingSprintTimelineRead ||
    senseInterpretation?.likelyCapability === "sprint_timeline_read"
  ) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForSprintTimelineRead({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        !!pendingSprintTimelineRead,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        !!pendingSprintTimelineRead,
      ),
      pending: pendingSprintTimelineRead,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (
    pendingAnagraficheRead ||
    senseInterpretation?.likelyCapability === "anagrafiche_read"
  ) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForAnagraficheRead({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        !!pendingAnagraficheRead,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        !!pendingAnagraficheRead,
      ),
      pending: pendingAnagraficheRead,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  } else if (
    pendingAnagraficheCreate ||
    senseInterpretation?.likelyCapability === "anagrafiche_create"
  ) {
    operationContextFill = mergeOperationContextFills(
      operationContextFill,
      await runOperationContextFillerForAnagraficheCreate({
      message: state.originalMessage,
      recentTurns: getScopedRecentTurnsForSpecialist(
        state.context.recentTurns,
        !!pendingAnagraficheCreate,
      ),
      conversationSummary: getScopedSummaryForSpecialist(
        state.conversationSummary,
        !!pendingAnagraficheCreate,
      ),
      pending: pendingAnagraficheCreate,
      traceCollector: (step) => state.llmTrace.push(step),
    }),
    );
  }

  if (operationContextFill?.normalizedMessage) {
    interpretedMessage = operationContextFill.normalizedMessage;
  }

  state = { ...state, operationContextFill, interpretedMessage };

  // ── STEP 4: Intent Parsing ───────────────────────────────────────────────
  const operationGuardrail = evaluateOperationGuardrails({
    message: interpretedMessage,
    operationState: state.operationState,
  });

  const mailIntent = detectReminderMailIntent(interpretedMessage);

  const parsedCreateIntent =
    parseEventCreateIntent({
      message: interpretedMessage,
      resolverMode: state.resolverMode,
    }) ??
    (pendingCreate
      ? parseEventCreateContinuation({
          message: interpretedMessage,
          resolverMode: state.resolverMode,
          pendingMissing: pendingCreate.missing,
        })
      : null);

  const createIntent = mergeCreateIntentWithOperationFill({
    pending: pendingCreate,
    fill:
      operationContextFill?.kind === "event_create"
        ? operationContextFill
        : null,
    intent: mergePendingCreateState({
      pending: pendingCreate,
      intent: parsedCreateIntent,
    }),
  });

  const listIntent = parseEventListIntent({
    message: interpretedMessage,
    resolverMode: state.resolverMode,
  });
  const recentIntent = parseRecentEventsIntent(interpretedMessage);
  const anagraficheReadIntent = parseAnagraficheReadIntent(interpretedMessage);
  const anagraficheCreateIntent =
    parseAnagraficheCreateIntent(interpretedMessage);
  const sprintTimelineReadIntent = parseSprintTimelineReadIntent({
    message: interpretedMessage,
    userDisplayName:
      state.context.user.displayName ?? state.context.user.fullName,
  });
  const genericMailIntent = parseGenericMailIntent(interpretedMessage);
  const lowValue = detectLowValuePrompt(interpretedMessage);
  const unsupportedReminderMatched =
    detectUnsupportedReminderRequest(interpretedMessage);
  const discoverySupported = supportsEventDiscovery(interpretedMessage);

  // ── STEP 5: Operation Router ─────────────────────────────────────────────
  const operationRouting = routeAnimaOperation({
    operationState: state.operationState,
    operationGuardrail,
    senseInterpretation,
    hasCreateIntent: !!createIntent,
    hasListIntent: !!listIntent,
    hasRecentIntent: !!recentIntent,
    hasAnagraficheReadIntent: !!anagraficheReadIntent,
    hasAnagraficheCreateIntent: !!anagraficheCreateIntent,
    hasSprintTimelineReadIntent: !!sprintTimelineReadIntent,
    hasGenericMailIntent: !!genericMailIntent,
    wantsMail: mailIntent.wantsMail,
    wantsDigestMail: mailIntent.wantsDigestMail,
    hasProfileEmail: !!state.context.user.email,
    lowValueMatched: lowValue.matched,
    unsupportedReminderMatched,
    supportsDiscovery: discoverySupported,
    hasAuthContext: !!state.authContext,
  });

  let emotionalGuardrail = state.emotionalGuardrail;
  let effectiveOperationRouting = operationRouting;

  if (
    operationRouting.branch === "orange_guardrail" ||
    operationRouting.branch === "not_understood"
  ) {
    emotionalGuardrail = await runEmotionalGuardrail({
      message: state.originalMessage,
      userDisplayName:
        state.context.user.displayName ?? state.context.user.fullName,
      conversationSummary: state.conversationSummary,
      recentTurns: state.context.recentTurns,
      senseInterpretation,
      activeOperation: state.operationState
        ? {
            operation: state.operationState.operation,
            phase: state.operationState.phase ?? null,
            readiness: state.operationState.readiness ?? null,
            missing: state.operationState.missing,
          }
        : null,
      traceCollector: (step) => state.llmTrace.push(step),
    });

    if (emotionalGuardrail?.guardrailColor === "orange") {
      effectiveOperationRouting = {
        branch: "orange_guardrail",
        reason:
          operationRouting.branch === "orange_guardrail"
            ? "sense_orange_confirmed_by_emotional_guardrail"
            : "not_understood_recovered_by_emotional_guardrail",
        activeOperation: operationRouting.activeOperation,
        usedSignals: [
          ...operationRouting.usedSignals,
          "emotionalGuardrail.orange",
        ],
      };
    } else if (
      emotionalGuardrail?.guardrailColor === "red" &&
      operationRouting.branch === "orange_guardrail"
    ) {
      effectiveOperationRouting = {
        branch: "not_understood",
        reason: "sense_orange_downgraded_to_red_by_emotional_guardrail",
        activeOperation: operationRouting.activeOperation,
        usedSignals: [...operationRouting.usedSignals, "emotionalGuardrail.red"],
      };
    }
  }

  state = {
    ...state,
    operationRouting: effectiveOperationRouting,
    emotionalGuardrail,
  };

  // ── STEP 6: Domain Executor Demux ────────────────────────────────────────
  //
  // Gli executor vengono provati in ordine di priorità.
  // Il primo che restituisce un risultato (non null) vince e termina il loop.

  let finalResult: AnimaRunResult | null = null;

  // Rami mail (followup, generic, digest)
  if (!finalResult) {
    finalResult = await executeMailBranch(state, {
      listIntent,
      genericMailIntent,
    });
  }

  // Rami eventi (create, list, recent, discovery)
  if (!finalResult) {
    finalResult = await executeEventiBranch(state, {
      createIntent,
      listIntent,
      recentIntent,
      mailIntent,
      operationGuardrail,
    });
  }

  if (!finalResult) {
    finalResult = await executeAnagraficheBranch(state, {
      readIntent: anagraficheReadIntent,
      createIntent: anagraficheCreateIntent,
    });
  }

  if (!finalResult) {
    finalResult = await executeSprintTimelineBranch(state, {
      readIntent: sprintTimelineReadIntent,
    });
  }

  // Rami conversazionali (guardrail, fallback, cancel, low-value)
  if (!finalResult) {
    finalResult = await executeConversationBranch(state, { lowValue });
  }

  // Questo punto non dovrebbe mai essere raggiunto: conversation e' il catch-all
  if (!finalResult) {
    finalResult = await buildAnimaRunResult(state, {
      text: "Non ho capito la richiesta.",
      strategy: "not_understood",
      usedCapabilities: ["conversation.help.events"],
      debug: { matchedBy: "loop_fallback" },
    });
  }

  // ── STEP 7: ResponseComposer (nodo terminale LLM) ────────────────────────
  //
  // Prende il risultato dell'executor (testo statico + strategia + debug)
  // e tenta di arricchirlo con una risposta LLM contestuale e naturale.
  // Il testo statico dell'executor rimane sempre come fallback sicuro.
  //
  // Strategie bypass: operazioni gia' composte dall'executor via composeFinalResponse,
  // o branch che non beneficiano di riscrittura (es. welcome_greeting).
  if (
    finalResult &&
    ANIMA_RUNTIME_CONFIG.targetRuntime.enabled &&
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer?.model
  ) {
    const staticFallbackText = finalResult.reply.text;
    const responseGuidance = buildResponseGuidance({
      state,
      finalResult,
    });
    const memorySupport = {
      summary: responseGuidance.operation ? null : state.conversationSummary ?? null,
      activeOperation: state.operationState
        ? {
            operation: state.operationState.operation,
            phase: state.operationState.phase ?? null,
            readiness: state.operationState.readiness ?? null,
            missing: state.operationState.missing,
          }
        : null,
      recentTurns: responseGuidance.operation ? [] : state.context.recentTurns.slice(-2),
    };

    const operationResultForComposer =
      buildOperationResultForComposer(finalResult);

    try {
      const composedText = await composeFinalResponse({
        userDisplayName:
          state.context.user.displayName ?? state.context.user.fullName,
        conversationSummary: responseGuidance.operation ? "" : state.conversationSummary,
        recentTurns: responseGuidance.operation ? [] : state.context.recentTurns.slice(-2),
        message: state.interpretedMessage,
        operationResult: operationResultForComposer,
        memorySupport,
        responseGuidance,
        registryAwareness: buildScopedRegistryAwareness(
          responseGuidance.operation === "anagrafiche_read" ||
            responseGuidance.operation === "anagrafiche_create"
            ? "anagrafiche"
            : responseGuidance.operation === "sprint_timeline_read"
              ? "sprint_timeline"
              : responseGuidance.operation
                ? "eventi"
                : "all",
        ),
        traceCollector: (step) => state.llmTrace.push(step),
      });

      if (composedText && composedText.trim().length > 0) {
        const finalText = buildListingAwareComposerText({
          composedText,
          staticFallbackText,
          finalResult,
        });
        finalResult = {
          ...finalResult,
          reply: { text: finalText },
          meta: {
            ...finalResult.meta,
            debug: {
              ...finalResult.meta.debug,
              responseComposerUsed: true,
              staticFallbackText,
              memorySupport,
              responseGuidance,
            },
          },
        };
      }
    } catch (_composerErr) {
      // Fallback silenzioso: mantieni il testo statico dell'executor
    }
  }

  return { ...state, isTerminal: true, finalResult };
}
