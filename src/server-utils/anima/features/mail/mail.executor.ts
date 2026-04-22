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
  extractEmailAddress,
  mergePendingGenericMailState,
  mergePendingGenericMailStateWithPatch,
  parseGenericMailIntent,
  resolveRecipientFromRememberedContacts,
  resolveSelfRecipientEmail,
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
import {
  composeOrangeContextReply,
  composeFinalResponse,
} from "../../nodes/responseComposer";
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
import { buildAnimaRunResult, persistPendingMailFollowupState, persistPendingGenericMailState } from '../../core/stateHelpers';

export async function executeMailBranch(
  state: AnimaAgentState,
  params: {
    listIntent: any;
    genericMailIntent: any;
  }
): Promise<AnimaRunResult | null> {
  const { context, interpretedMessage, authContext, resolverMode, originalMessage } = state;
  let { conversationSummary, operationExecution, llmTrace } = state;

  const pendingMailFollowup = state.operationState?.operation === 'mail_followup' ? state.operationState : null;
  const pendingGenericMail = state.operationState?.operation === 'generic_mail' ? state.operationState : null;
  const selfRecipientEmail = resolveSelfRecipientEmail({
    message: interpretedMessage,
    defaultEmail: context.user.email ?? null,
  });
  const rememberedRecipient = resolveRecipientFromRememberedContacts({
    message: interpretedMessage,
    contacts: state.contactState?.recentContacts ?? [],
  });
  const rememberedRecipientEmail = rememberedRecipient.email ?? undefined;
  
  const { listIntent, genericMailIntent } = params;
  const operationContextFill = state.operationContextFill;

  if (state.operationRouting!.branch === "mail_followup_pending" && pendingMailFollowup) {
    const mailFollowupFill =
      operationContextFill?.kind === "mail_followup" ? operationContextFill : null;
    const recipient = resolveMailFollowupRecipient({
      message: interpretedMessage,
      pending: pendingMailFollowup,
    });

    const resolvedRecipient =
      typeof mailFollowupFill?.recipient !== "undefined"
        ? mailFollowupFill.recipient
        : recipient;
    const declined =
      mailFollowupFill?.decline === true ||
      resolvedRecipient === null ||
      detectMailDecline(interpretedMessage);

    if (declined) {
      await clearOperationState(context.session.sessionId);

      return buildAnimaRunResult(state, {
        text: buildMailSkippedReply(),
        strategy: "mail_clarification",
        usedCapabilities: ["mail.send"],
        debug: {
          matchedBy: "mail_followup_declined",
          pendingMailFollowup,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }

    if (
      resolvedRecipient &&
      pendingMailFollowup.data.templateKey &&
      pendingMailFollowup.data.eventTypeLabel &&
      pendingMailFollowup.data.title
    ) {
      try {
        const mailExecution = await executeCreatedEventReminderMailOperation({
          to: resolvedRecipient,
          displayName: context.user.displayName ?? context.user.fullName,
          templateKey: pendingMailFollowup.data.templateKey,
          eventTypeLabel: pendingMailFollowup.data.eventTypeLabel,
          title: pendingMailFollowup.data.title,
          startAt: pendingMailFollowup.data.startAt ?? null,
          endAt: pendingMailFollowup.data.endAt ?? null,
          notes: pendingMailFollowup.data.notes ?? null,
          traceCollector: (step) => llmTrace.push(step),
        });
        operationExecution = mailExecution;
        await clearOperationState(context.session.sessionId);

        const fallbackText = buildMailSentReply({
          displayName: context.user.displayName ?? context.user.fullName,
          email: resolvedRecipient,
          subjectHint:
            pendingMailFollowup.data.subjectHint ?? mailExecution.subjectHint,
        });

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "mail_followup_sent",
            status: "success",
            email: resolvedRecipient,
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "mail_followup_sent",
            recipient: resolvedRecipient,
            mail: mailExecution.mail,
            pendingMailFollowup,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      } catch (error: any) {
        await clearOperationState(context.session.sessionId);

        const fallbackText = buildMailUnavailableReply({
          reason: String(error?.message ?? "MAIL_SEND_FAILED"),
        });

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "mail_followup_failed",
            status: "error",
            email: resolvedRecipient,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          strategy: "mail_clarification",
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "mail_followup_failed",
            recipient: resolvedRecipient,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
            pendingMailFollowup,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      }
    }

    await persistPendingMailFollowupState(state, {
      ...pendingMailFollowup,
        data: {
          ...pendingMailFollowup.data,
          selectedTo:
            resolvedRecipient ?? pendingMailFollowup.data.selectedTo ?? null,
        },
      });

    const fallbackQuestion = buildMailFollowupQuestion({
      email:
        resolvedRecipient ??
        pendingMailFollowup.data.selectedTo ??
        pendingMailFollowup.data.defaultTo ??
        null,
      title: pendingMailFollowup.data.title ?? null,
    });

    return buildAnimaRunResult(state, {
      text: fallbackQuestion,
      strategy: "mail_clarification",
      usedCapabilities: ["mail.send"],
      debug: {
        matchedBy: "mail_followup_pending",
        recipientCandidate: resolvedRecipient ?? null,
        pendingMailFollowup,
        alreadyComposed: false,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "generic_mail_pending" && pendingGenericMail) {
    const genericMailFill =
      operationContextFill?.kind === "generic_mail" ? operationContextFill : null;
    if (detectMailDecline(interpretedMessage)) {
      await clearOperationState(context.session.sessionId);

      return buildAnimaRunResult(state, {
        text: buildMailSkippedReply(),
        strategy: "mail_clarification",
        usedCapabilities: ["mail.send"],
        debug: {
          matchedBy: "generic_mail_declined",
          pendingGenericMail,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }

    const parsedMailState = mergePendingGenericMailState({
      pending: pendingGenericMail,
      message: interpretedMessage,
    });
    const mergedMailState = mergePendingGenericMailStateWithPatch({
      pending: pendingGenericMail,
      state: parsedMailState,
      patch: {
        ...(genericMailFill?.payloadPatch ?? {}),
        to:
          (genericMailFill?.payloadPatch.to &&
          extractEmailAddress(genericMailFill.payloadPatch.to)
            ? genericMailFill.payloadPatch.to
            : undefined) ??
          selfRecipientEmail ??
          parsedMailState?.data.to ??
          pendingGenericMail.data.to ??
          rememberedRecipientEmail ??
          undefined,
      },
    });

    if (
      mergedMailState?.readiness === "ready" &&
      mergedMailState.data.to &&
      mergedMailState.data.message
    ) {
      try {
        const mailExecution = await executeGenericMailOperation({
          to: mergedMailState.data.to,
          displayName: context.user.displayName ?? context.user.fullName,
          templateKey: ANIMA_COMPONENT_CONFIG.models.mailComposer.templateKey,
          subject: mergedMailState.data.subject ?? undefined,
          message: mergedMailState.data.message,
          traceCollector: (step) => llmTrace.push(step),
        });
        operationExecution = mailExecution;
        await clearOperationState(context.session.sessionId);

        const fallbackText = buildMailSentReply({
          displayName: context.user.displayName ?? context.user.fullName,
          email: mergedMailState.data.to,
          subjectHint: mailExecution.subjectHint,
        });

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "generic_mail_sent",
            status: "success",
            email: mergedMailState.data.to,
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          strategy: "mail_reminder_sent",
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "generic_mail_sent",
            mergedMailState,
            mail: mailExecution.mail,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      } catch (error: any) {
        await clearOperationState(context.session.sessionId);

        const fallbackText = buildMailUnavailableReply({
          reason: String(error?.message ?? "MAIL_SEND_FAILED"),
        });

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "generic_mail_failed",
            status: "error",
            email: mergedMailState.data.to,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          strategy: "mail_clarification",
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "generic_mail_failed",
            mergedMailState,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      }
    }

    if (mergedMailState) {
      await persistPendingGenericMailState(state, mergedMailState);
    }

    const fallbackQuestion = buildGenericMailQuestion(
      mergedMailState?.missing.includes("destinatario")
        ? "recipient"
        : "content",
    );

    return buildAnimaRunResult(state, {
      text: fallbackQuestion,
      strategy: "mail_clarification",
      usedCapabilities: ["mail.send"],
        debug: {
          matchedBy: "generic_mail_pending",
          pendingGenericMail: mergedMailState ?? pendingGenericMail,
          selfRecipientEmail,
          rememberedRecipient,
          alreadyComposed: false,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
    });
  }

  if (state.operationRouting!.branch === "generic_mail_new") {
    const genericMailFill =
      operationContextFill?.kind === "generic_mail" ? operationContextFill : null;
    const parsedState = mergePendingGenericMailState({
      pending: null,
      message: interpretedMessage,
    });
    const initialGenericMailState = mergePendingGenericMailStateWithPatch({
      pending: null,
      state: parsedState,
      patch: {
        ...(genericMailFill?.payloadPatch ?? {}),
        to:
          (genericMailFill?.payloadPatch.to &&
          extractEmailAddress(genericMailFill.payloadPatch.to)
            ? genericMailFill.payloadPatch.to
            : undefined) ??
          selfRecipientEmail ??
          parsedState?.data.to ??
          rememberedRecipientEmail ??
          undefined,
      },
    });

    if (!initialGenericMailState) {
      return null;
    }

    if (
      initialGenericMailState?.readiness === "ready" &&
      initialGenericMailState.data.to &&
      initialGenericMailState.data.message
    ) {
      try {
        const mailExecution = await executeGenericMailOperation({
          to: initialGenericMailState.data.to,
          displayName: context.user.displayName ?? context.user.fullName,
          templateKey: ANIMA_COMPONENT_CONFIG.models.mailComposer.templateKey,
          subject: initialGenericMailState.data.subject ?? undefined,
          message: initialGenericMailState.data.message,
          traceCollector: (step) => llmTrace.push(step),
        });
        operationExecution = mailExecution;

        return buildAnimaRunResult(state, {
          text: buildMailSentReply({
            displayName: context.user.displayName ?? context.user.fullName,
            email: initialGenericMailState.data.to,
            subjectHint: mailExecution.subjectHint,
          }),
          strategy: "mail_reminder_sent",
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "generic_mail_direct_send",
            initialGenericMailState,
            mail: mailExecution.mail,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      } catch (error: any) {
        return buildAnimaRunResult(state, {
          text: buildMailUnavailableReply({
            reason: String(error?.message ?? "MAIL_SEND_FAILED"),
          }),
          strategy: "mail_clarification",
          usedCapabilities: ["mail.send"],
          debug: {
            matchedBy: "generic_mail_direct_send_failed",
            initialGenericMailState,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      }
    }

    if (initialGenericMailState) {
    await persistPendingGenericMailState(state, initialGenericMailState);

    const fallbackQuestion = buildGenericMailQuestion(
      initialGenericMailState.missing.includes("destinatario")
        ? "recipient"
        : "content",
    );

    return buildAnimaRunResult(state, {
        text: fallbackQuestion,
        strategy: "mail_clarification",
        usedCapabilities: ["mail.send"],
        debug: {
          matchedBy: "generic_mail_clarification",
          initialGenericMailState,
          selfRecipientEmail,
          rememberedRecipient,
          alreadyComposed: false,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }
  }

  if (state.operationRouting!.branch === "missing_profile_email") {
    return buildAnimaRunResult(state, {
      text: buildMissingEmailReply(),
      strategy: "mail_reminder_sent",
      usedCapabilities: ["mail.send"],
      debug: {
        matchedBy: "mail_missing_profile_email",
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "mail_digest" && listIntent && authContext && context.user.email) {
    const result = await executeEventListIntent({
      auth: authContext,
      intent: listIntent,
      pageSize: 12,
    });

    const days = listIntent.filters.futureDays ?? listIntent.filters.days ?? 7;
    const daysLabel = listIntent.filters.futureDays ?? listIntent.filters.days ?? 7;
    const isFutureDigest = !!listIntent.filters.futureDays;
    try {
      const mailExecution = await executeEventsDigestMailOperation({
        to: context.user.email,
        displayName: context.user.displayName ?? context.user.fullName,
        templateKey: ANIMA_COMPONENT_CONFIG.models.mailComposer.templateKey,
        subjectHint: isFutureDigest
          ? `Promemoria eventi dei prossimi ${daysLabel} giorni`
          : `Riepilogo eventi degli ultimi ${daysLabel} giorni`,
        intro: isFutureDigest
          ? `Ti lascio un promemoria degli eventi dei prossimi ${daysLabel} giorni.`
          : `Ti lascio un riepilogo degli eventi degli ultimi ${daysLabel} giorni.`,
        userGoal: isFutureDigest
          ? `Scrivi un promemoria email chiaro e utile sugli eventi dei prossimi ${daysLabel} giorni.`
          : `Scrivi una mail chiara e utile con il breakdown degli eventi degli ultimi ${daysLabel} giorni.`,
        items: result.items.map((item) => ({
          label: item.label,
          displayName: item.displayName,
          startAt: item.startAt ?? null,
        })),
        traceCollector: (step) => llmTrace.push(step),
      });
      operationExecution = mailExecution;

      return buildAnimaRunResult(state, {
        text: buildMailSentReply({
          displayName: context.user.displayName ?? context.user.fullName,
          email: context.user.email,
          subjectHint: mailExecution.subjectHint,
        }),
        strategy: "mail_reminder_sent",
        usedCapabilities: ["mail.send", "eventi.recent.summary"],
        debug: {
          matchedBy: "events_digest_mail",
          filters: listIntent.filters,
          returned: result.items.length,
          mail: mailExecution.mail,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    } catch (error: any) {
      return buildAnimaRunResult(state, {
        text: buildMailUnavailableReply({
          reason: String(error?.message ?? "MAIL_SEND_FAILED"),
        }),
        strategy: "mail_clarification",
        usedCapabilities: ["mail.send", "eventi.recent.summary"],
        debug: {
          matchedBy: "events_digest_mail_failed",
          filters: listIntent.filters,
          returned: result.items.length,
          mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }
  }

  return null;
}
