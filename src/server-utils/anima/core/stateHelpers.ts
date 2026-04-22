import type { AnimaAgentState } from "./agentState";
import type { AnimaRunResult, AnimaCapability } from "./types";
import { ANIMA_COMPONENT_CONFIG } from "./anima.config";
import { ANIMA_PROMPTS_CONFIG } from "../config/anima.prompts.runtime.config";
import { updateShortTermMemorySummary } from "../nodes/shortTermMemory";
import {
  savePendingAnagraficheCreateState,
  savePendingAnagraficheReadState,
  savePendingCreateState,
  savePendingEventListState,
  savePendingGenericMailState,
  savePendingMailFollowupState,
  savePendingSprintTimelineReadState,
} from "../memory/sessionState";
import { saveConversationSummary } from "../memory/summaryState";
import {
  resolvePendingCreatePhase,
  resolvePendingCreateReadiness,
} from "./../features/eventi/eventi.create";
import type {
  PendingCreateState,
  PendingEventListState,
  PendingMailFollowupState,
  PendingGenericMailState,
  PendingAnagraficheCreateState,
  PendingAnagraficheReadState,
  PendingSprintTimelineReadState,
} from "../memory/sessionState";

export function buildBaseAnimaRunResult(args: {
  context: AnimaAgentState["context"];
  text: string;
  strategy?: AnimaRunResult["meta"]["strategy"];
  usedCapabilities?: AnimaCapability[];
  debug?: Record<string, any>;
}): AnimaRunResult {
  return {
    ok: true,
    reply: {
      text: args.text,
    },
    context: args.context,
    meta: {
      strategy: args.strategy ?? "fallback_chat",
      usedCapabilities: args.usedCapabilities ?? [],
      debug: args.debug,
    },
  };
}

export async function buildAnimaRunResult(
  state: AnimaAgentState,
  args: {
    text: string;
    strategy?: AnimaRunResult["meta"]["strategy"];
    usedCapabilities?: AnimaRunResult["meta"]["usedCapabilities"];
    debug?: Record<string, any>;
  },
): Promise<AnimaRunResult> {
  const result = buildBaseAnimaRunResult({
    context: state.context,
    text: args.text,
    strategy: args.strategy,
    usedCapabilities: args.usedCapabilities,
    debug: {
      llmTrace: state.llmTrace,
      senseInterpretation: state.senseInterpretation,
      emotionalGuardrail: state.emotionalGuardrail,
      operationSwitchDecision: state.operationSwitchDecision,
      operationArbitration: state.operationArbitration,
      operationContextFill: state.operationContextFill,
      operationRouting: state.operationRouting,
      operationExecution: state.operationExecution,
      originalMessage: state.originalMessage,
      interpretedMessage: state.interpretedMessage,
      recentTurns: state.context.recentTurns,
      contactState: state.contactState,
      conversationSummaryBefore: state.conversationSummary || null,
      targetRuntimeEnabled: ANIMA_COMPONENT_CONFIG.targetRuntime.enabled,
      promptConfigVersion: ANIMA_PROMPTS_CONFIG.version,
      ...(args.debug ?? {}),
    },
  });

  if (
    ANIMA_COMPONENT_CONFIG.targetRuntime.enabled &&
    ANIMA_COMPONENT_CONFIG.targetRuntime.memory.summarizeAfterEachTurn
  ) {
    const memorySafeAssistantReply = buildMemorySafeAssistantReply({
      resultText: result.reply.text,
      strategy: result.meta.strategy,
      operationState: state.operationState,
    });
    const nextSummary = await updateShortTermMemorySummary({
      previousSummary: state.conversationSummary,
      userMessage: state.interpretedMessage,
      assistantReply: memorySafeAssistantReply,
      operationSnapshot: state.operationState
        ? {
            operation: state.operationState.operation,
            phase: state.operationState.phase ?? null,
            readiness: state.operationState.readiness ?? null,
            missing: state.operationState.missing,
            data: state.operationState.data,
          }
        : null,
      traceCollector: (step) => state.llmTrace.push(step),
    });

    if (nextSummary) {
      await saveConversationSummary(
        state.context.session.sessionId,
        nextSummary,
      );
      state.conversationSummary = nextSummary;
      result.meta.debug = {
        ...(result.meta.debug ?? {}),
        shortTermMemoryUpdated: true,
        conversationSummaryAfter: nextSummary,
      };
    }
  }

  return result;
}

function buildMemorySafeAssistantReply(args: {
  resultText: string;
  strategy: AnimaRunResult["meta"]["strategy"];
  operationState: AnimaAgentState["operationState"];
}): string {
  if (!args.operationState) {
    return args.resultText;
  }

  if (!String(args.strategy ?? "").endsWith("_clarification")) {
    return args.resultText;
  }

  const missing = args.operationState.missing.join(", ");
  const missingSuffix = missing ? ` Campi mancanti: ${missing}.` : "";
  const operationLabel =
    args.operationState.operation === "event_create"
      ? "Creazione evento ancora aperta."
      : args.operationState.operation === "event_list"
        ? "Ricerca eventi ancora aperta."
        : args.operationState.operation === "mail_followup" ||
            args.operationState.operation === "generic_mail"
          ? "Operazione mail ancora aperta."
          : args.operationState.operation === "anagrafiche_read"
            ? "Ricerca anagrafica ancora aperta."
            : args.operationState.operation === "anagrafiche_create"
              ? "Creazione anagrafica ancora aperta."
              : args.operationState.operation === "sprint_timeline_read"
                ? "Lettura SprintTimeline ancora aperta."
                : "Operazione ancora aperta.";

  return `${operationLabel}${missingSuffix}`;
}

export async function persistPendingCreateState(
  state: AnimaAgentState,
  args: {
    missing: string[];
    data: {
      eventTypeSlug?: string | null;
      eventTypeLabel?: string | null;
      title?: string | null;
      notes?: string | null;
      startAt?: string | null;
      endAt?: string | null;
      timeKind?: string | null;
      startHour?: number | null;
      startMinute?: number | null;
      endHour?: number | null;
      endMinute?: number | null;
    };
  },
) {
  const nextState: PendingCreateState = {
    operation: "event_create",
    phase: resolvePendingCreatePhase({
      missing: args.missing,
      notes: args.data.notes,
    }),
    readiness: resolvePendingCreateReadiness({
      missing: args.missing,
    }),
    data: args.data,
    missing: args.missing,
    updatedAt: new Date().toISOString(),
  };

  await savePendingCreateState(state.context.session.sessionId, nextState);
  state.operationState = nextState;
}

export async function persistPendingMailFollowupState(
  state: AnimaAgentState,
  data: Omit<PendingMailFollowupState, "updatedAt">,
) {
  const nextState: PendingMailFollowupState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingMailFollowupState(state.context.session.sessionId, nextState);
  state.operationState = nextState;
}

export async function persistPendingEventListState(
  state: AnimaAgentState,
  data: Omit<PendingEventListState, "updatedAt">,
) {
  const nextState: PendingEventListState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingEventListState(state.context.session.sessionId, nextState);
  state.operationState = nextState;
}

export async function persistPendingGenericMailState(
  state: AnimaAgentState,
  data: Omit<PendingGenericMailState, "updatedAt">,
) {
  const nextState: PendingGenericMailState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingGenericMailState(state.context.session.sessionId, nextState);
  state.operationState = nextState;
}

export async function persistPendingSprintTimelineReadState(
  state: AnimaAgentState,
  data: Omit<PendingSprintTimelineReadState, "updatedAt">,
) {
  const nextState: PendingSprintTimelineReadState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingSprintTimelineReadState(
    state.context.session.sessionId,
    nextState,
  );
  state.operationState = nextState;
}

export async function persistPendingAnagraficheReadState(
  state: AnimaAgentState,
  data: Omit<PendingAnagraficheReadState, "updatedAt">,
) {
  const nextState: PendingAnagraficheReadState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingAnagraficheReadState(
    state.context.session.sessionId,
    nextState,
  );
  state.operationState = nextState;
}

export async function persistPendingAnagraficheCreateState(
  state: AnimaAgentState,
  data: Omit<PendingAnagraficheCreateState, "updatedAt">,
) {
  const nextState: PendingAnagraficheCreateState = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await savePendingAnagraficheCreateState(
    state.context.session.sessionId,
    nextState,
  );
  state.operationState = nextState;
}
