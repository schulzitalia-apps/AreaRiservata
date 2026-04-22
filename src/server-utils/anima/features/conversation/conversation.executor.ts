import { buildAnimaContext } from "../../core/context";
import { ANIMA_COMPONENT_CONFIG } from "../../core/anima.config";
import { ANIMA_PROMPTS_CONFIG } from "../../config/anima.prompts.config";
import { evaluateOperationGuardrails } from "../../core/operationGuardrails";
import { buildAnimaRunResult as buildBaseAnimaRunResult } from "../../core/respond";
import type {
  AnimaLlmTraceStep,
  AnimaRunResult,
  AnimaSessionInput,
} from "../../core/types";
import { buildEventDiscoveryReply } from "../../features/eventi/eventi.respond";
import {
  listAnimaEventoTypes,
  supportsEventDiscovery,
} from "../../features/eventi/eventi.context";
import {
  buildRecentEventsReply,
  loadRecentEventsSummary,
  parseRecentEventsIntent,
} from "../../features/eventi/eventi.recent";
import {
  buildEventListReply,
  executeEventListIntent,
  parseEventListIntent,
} from "../../features/eventi/eventi.list";
import {
  detectReminderMailIntent,
} from "../../features/mail/animaReminderMail";
import {
  detectMailDecline,
  mergePendingGenericMailState,
  mergePendingGenericMailStateWithPatch,
  parseGenericMailIntent,
  resolveMailFollowupRecipient,
} from "../../features/mail/genericMail";
import {
  buildCreateIntentFromPendingState,
  listKnownCreateTypes,
  mergePendingCreateState,
  parseEventCreateContinuation,
  parseOptionalNotesAnswer,
  parseEventCreateIntent,
  resolvePendingCreatePhase,
  resolvePendingCreateReadiness,
} from "../../features/eventi/eventi.create";
import {
  buildUnsupportedReminderReply,
  detectUnsupportedReminderRequest,
} from "../../features/eventi/eventi.guardrails";
import {
  buildLowValueReply,
  detectGreeting,
  detectLowValuePrompt,
} from "../../features/eventi/eventi.lowValue";
import {
  buildCapabilitiesReply,
  buildCreateQuestion,
  buildCreateSuccessReply,
  buildGenericMailQuestion,
  buildInvalidIntervalReply,
  buildMailSentReply,
  buildMailFollowupQuestion,
  buildMailSkippedReply,
  buildMailUnavailableReply,
  buildMissingEmailReply,
  buildOperationCancelledReply,
  buildPendingTaskReminder,
  buildNeedEventTypeReply,
  buildWelcomeReply,
} from "../../responders/conversation";
import {
  clearOperationState,
  clearPendingCreateState,
  loadPendingOperationState,
  savePendingGenericMailState,
  savePendingMailFollowupState,
  savePendingCreateState,
  type PendingGenericMailState,
  type PendingMailFollowupState,
} from "../../memory/sessionState";
import {
  loadConversationState,
  saveConversationState,
} from "../../memory/conversationState";
import {
  loadConversationSummary,
  saveConversationSummary,
} from "../../memory/summaryState";
import {
  runSenseInterpreter,
  type SenseInterpretation,
} from "../../nodes/senseInterpreter";
import { updateShortTermMemorySummary } from "../../nodes/shortTermMemory";
import { composeOrangeContextReply, composeFinalResponse } from "../../nodes/responseComposer";
import {
  type AnyOperationContextFillResult,
  mergeCreateIntentWithOperationFill,
  runOperationContextFillerForGenericMail,
  runOperationContextFillerForCreate,
  runOperationContextFillerForMailFollowup,
} from "../../nodes/operationContextFiller";
import {
  routeAnimaOperation,
  type OperationRouterDecision,
} from "../../nodes/operationRouter";
import {
  executeCreatedEventReminderMailOperation,
  executeEventCreateOperation,
  executeEventsDigestMailOperation,
  executeGenericMailOperation,
} from "../../nodes/operationExecutor";

import { AnimaAgentState } from '../../core/agentState';
import { buildAnimaRunResult } from '../../core/stateHelpers';

export async function executeConversationBranch(
  state: AnimaAgentState,
  params: {
    lowValue: any;
  }
): Promise<AnimaRunResult | null> {
  const { context, interpretedMessage, resolverMode, originalMessage, senseInterpretation } = state;
  const emotionalGuardrail = state.emotionalGuardrail;
  let { conversationSummary, llmTrace, operationState } = state;
  const { lowValue } = params;

  if (state.operationRouting!.branch === "cancel_active_operation") {
    await clearOperationState(context.session.sessionId);

    return buildAnimaRunResult(state, {
      text: buildOperationCancelledReply(),
      strategy: "mail_clarification",
      usedCapabilities:
        operationState?.operation === "event_create"
          ? ["eventi.create"]
          : ["mail.send"],
      debug: {
        matchedBy: "operation_cancelled",
        reason: state.operationRouting!.reason,
        operation: operationState?.operation ?? null,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "low_value") {
    return buildAnimaRunResult(state, {
      text: buildLowValueReply(context.user.displayName ?? context.user.fullName),
      strategy: "low_value_guardrail",
      usedCapabilities: ["conversation.help.events"],
      debug: {
        matchedBy: "low_value_guardrail",
        reason: lowValue.reason,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "unsupported_reminder") {
    return buildAnimaRunResult(state, {
      text: buildUnsupportedReminderReply(),
      strategy: "reminder_guardrail",
      usedCapabilities: ["conversation.help.events"],
      debug: {
        matchedBy: "reminder_guardrail",
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "orange_guardrail") {
    const orangeSense = emotionalGuardrail ?? senseInterpretation;
    const orangeReply = await composeOrangeContextReply({
      userDisplayName: context.user.displayName ?? context.user.fullName,
      recentTurns: context.recentTurns,
      conversationSummary,
      message: originalMessage,
      capabilities: ANIMA_COMPONENT_CONFIG.texts.fallbackCapabilities,
      traceCollector: (step) => llmTrace.push(step),
    });

    if (orangeReply) {
      return buildAnimaRunResult(state, {
        text: orangeReply,
        strategy: "fallback_chat",

        debug: {
          matchedBy: "emotional_guardrail_orange",
          guardrailColor: orangeSense?.guardrailColor ?? "orange",
          responseMode: orangeSense?.responseMode ?? "functional",
          emotionalGuardrail,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }
  }

  return buildAnimaRunResult(state, {
    text: buildCapabilitiesReply(),
    strategy: "not_understood",
    usedCapabilities: ["conversation.help.events"],
    debug: {
      matchedBy: "not_understood",
      routerBranch: state.operationRouting!.branch,
      emotionalGuardrail,
    }
  });
}
