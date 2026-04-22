import { ANIMA_COMPONENT_CONFIG } from "../../core/anima.config";
import type { AnimaRunResult } from "../../core/types";
import { buildEventDiscoveryReply } from "./eventi.respond";
import { listAnimaEventoTypes } from "./eventi.context";
import {
  buildRecentEventsReply,
  loadRecentEventsSummary,
} from "./eventi.recent";
import {
  analyzeEventListIntent,
  buildEventListReply,
  executeEventListIntent,
  mergePendingEventListIntent,
} from "./eventi.list";
import {
  buildCreateIntentFromPendingState,
  listKnownCreateTypes,
  parseOptionalNotesAnswer,
  resolvePendingCreatePhase,
} from "./eventi.create";
import {
  buildCreateQuestion,
  buildCreateSuccessReply,
  buildInvalidIntervalReply,
  buildMailSentReply,
  buildMailFollowupQuestion,
  buildMailUnavailableReply,
  buildPendingTaskReminder,
  buildNeedEventTypeReply,
  buildEventListQuestion,
} from "../../responders/conversation";
import {
  clearOperationState,
  clearPendingCreateState,
} from "../../memory/sessionState";
import {
  composeFinalResponse,
} from "../../nodes/responseComposer";
import {
  executeCreatedEventReminderMailOperation,
  executeEventCreateOperation,
} from "../../nodes/operationExecutor";
import type { AnimaAgentState } from "../../core/agentState";
import {
  buildAnimaRunResult,
  persistPendingCreateState,
  persistPendingEventListState,
  persistPendingMailFollowupState,
} from "../../core/stateHelpers";
import { mergeEventListIntentWithOperationFill } from "../../nodes/operationContextFiller";

export async function executeEventiBranch(
  state: AnimaAgentState,
  params: {
    createIntent: any;
    listIntent: any;
    recentIntent: any;
    mailIntent: any;
    operationGuardrail: any;
  },
): Promise<AnimaRunResult | null> {
  const { context, interpretedMessage, authContext, resolverMode } = state;
  let { conversationSummary, llmTrace } = state;

  const pendingCreate =
    state.operationState?.operation === "event_create"
      ? state.operationState
      : null;
  const pendingEventList =
    state.operationState?.operation === "event_list"
      ? state.operationState
      : null;
  const awaitingOptionalNotes =
    pendingCreate?.missing.includes("note opzionali") ?? false;

  const {
    createIntent,
    listIntent,
    recentIntent,
    mailIntent,
    operationGuardrail,
  } = params;

  function buildPendingCreateData(intent: any) {
    return {
      eventTypeSlug: intent?.payload?.eventType?.slug ?? null,
      eventTypeLabel: intent?.payload?.eventType?.label ?? null,
      title: intent?.payload?.title ?? null,
      notes: intent?.payload?.notes ?? null,
      startAt: intent?.payload?.startAt ?? null,
      endAt: intent?.payload?.endAt ?? null,
      timeKind: intent?.payload?.timeKind ?? null,
      startHour: intent?.debug?.timeWindow?.startHour ?? null,
      startMinute: intent?.debug?.timeWindow?.startMinute ?? null,
      endHour: intent?.debug?.timeWindow?.endHour ?? null,
      endMinute: intent?.debug?.timeWindow?.endMinute ?? null,
    };
  }

  async function buildPostCreateResult(args: {
    createdId: string;
    payload: {
      eventType?: { label?: string | null } | null;
      title?: string | null;
      startAt?: string | null;
      endAt?: string | null;
      notes?: string | null;
    };
    matchedBy: string;
  }): Promise<AnimaRunResult> {
    if (
      mailIntent.wantsCreateAndMail &&
      context.user.email &&
      args.payload.eventType?.label &&
      args.payload.title
    ) {
      try {
        const mailExecution = await executeCreatedEventReminderMailOperation({
          to: context.user.email,
          displayName: context.user.displayName ?? context.user.fullName,
          templateKey: ANIMA_COMPONENT_CONFIG.models.mailComposer.templateKey,
          eventTypeLabel: args.payload.eventType.label,
          title: args.payload.title,
          startAt: args.payload.startAt ?? null,
          endAt: args.payload.endAt ?? null,
          notes: args.payload.notes ?? null,
          traceCollector: (step) => llmTrace.push(step),
        });
        state.operationExecution = mailExecution;

        const fallbackText = [
          buildCreateSuccessReply({
            eventTypeLabel: args.payload.eventType?.label ?? null,
            title: args.payload.title ?? null,
            startAt: args.payload.startAt ?? null,
            endAt: args.payload.endAt ?? null,
          }),
          buildMailSentReply({
            displayName: context.user.displayName ?? context.user.fullName,
            email: context.user.email,
            subjectHint: mailExecution.subjectHint,
          }),
        ].join("\n\n");

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "event_created_with_mail",
            status: "success",
            eventTypeLabel: args.payload.eventType?.label ?? null,
            title: args.payload.title ?? null,
            email: context.user.email,
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          strategy: "mail_reminder_sent",
          usedCapabilities: ["eventi.create", "mail.send"],
          debug: {
            matchedBy: `${args.matchedBy}:with_mail`,
            payload: args.payload,
            createdId: args.createdId,
            mail: mailExecution.mail,
            resolverMode,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      } catch (error: any) {
        const fallbackText = [
          buildCreateSuccessReply({
            eventTypeLabel: args.payload.eventType?.label ?? null,
            title: args.payload.title ?? null,
            startAt: args.payload.startAt ?? null,
            endAt: args.payload.endAt ?? null,
          }),
          buildMailUnavailableReply({
            reason: String(error?.message ?? "MAIL_SEND_FAILED"),
          }),
        ].join("\n\n");

        const dynamicText = await composeFinalResponse({
          userDisplayName: context.user.displayName ?? context.user.fullName,
          conversationSummary,
          recentTurns: context.recentTurns,
          message: interpretedMessage,
          operationResult: {
            action: "event_created_but_mail_failed",
            status: "partial_success",
            eventTypeLabel: args.payload.eventType?.label ?? null,
            title: args.payload.title ?? null,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
          },
          traceCollector: (step) => llmTrace.push(step),
        });

        return buildAnimaRunResult(state, {
          text: dynamicText ?? fallbackText,
          strategy: "event_create",
          usedCapabilities: ["eventi.create", "mail.send"],
          debug: {
            matchedBy: `${args.matchedBy}:mail_failed`,
            payload: args.payload,
            createdId: args.createdId,
            mailError: String(error?.message ?? "MAIL_SEND_FAILED"),
            resolverMode,
            componentConfig: ANIMA_COMPONENT_CONFIG,
          },
        });
      }
    }

    if (
      ANIMA_COMPONENT_CONFIG.mail.askReminderAfterCreate &&
      context.user.email &&
      args.payload.eventType?.label &&
      args.payload.title
    ) {
      await persistPendingMailFollowupState(state, {
        operation: "mail_followup",
        phase: "confirm_send",
        readiness: "ready",
        data: {
          defaultTo: context.user.email,
          selectedTo: context.user.email,
          templateKey: ANIMA_COMPONENT_CONFIG.models.mailComposer.templateKey,
          subjectHint: `Promemoria: ${args.payload.title}`,
          intro: "Ti mando un promemoria via email per l'evento appena creato.",
          userGoal:
            "Scrivi una mail breve e gentile che ricordi all'utente l'evento appena creato.",
          eventTypeLabel: args.payload.eventType.label,
          title: args.payload.title,
          startAt: args.payload.startAt ?? null,
          endAt: args.payload.endAt ?? null,
          notes: args.payload.notes ?? null,
        },
        missing: [],
      });

      return buildAnimaRunResult(state, {
        text: [
          buildCreateSuccessReply({
            eventTypeLabel: args.payload.eventType?.label ?? null,
            title: args.payload.title ?? null,
            startAt: args.payload.startAt ?? null,
            endAt: args.payload.endAt ?? null,
          }),
          buildMailFollowupQuestion({
            email: context.user.email,
            title: args.payload.title ?? null,
          }),
        ].join("\n\n"),
        strategy: "mail_clarification",
        usedCapabilities: ["eventi.create", "mail.send"],
        debug: {
          matchedBy: `${args.matchedBy}:mail_followup`,
          payload: args.payload,
          createdId: args.createdId,
          resolverMode,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }

    const fallbackText = buildCreateSuccessReply({
      eventTypeLabel: args.payload.eventType?.label ?? null,
      title: args.payload.title ?? null,
      startAt: args.payload.startAt ?? null,
      endAt: args.payload.endAt ?? null,
      emailHint: context.user.email ?? null,
    });

    const dynamicText = await composeFinalResponse({
      userDisplayName: context.user.displayName ?? context.user.fullName,
      conversationSummary,
      recentTurns: context.recentTurns,
      message: interpretedMessage,
      operationResult: {
        action: "event_created",
        status: "success",
        eventTypeLabel: args.payload.eventType?.label ?? null,
        title: args.payload.title ?? null,
      },
      traceCollector: (step) => llmTrace.push(step),
    });

    state.operationExecution = {
      createdId: args.createdId,
      payload: args.payload,
    };

    return buildAnimaRunResult(state, {
      text: dynamicText ?? fallbackText,
      strategy: "event_create",
      usedCapabilities: ["eventi.create"],
      debug: {
        matchedBy: args.matchedBy,
        payload: args.payload,
        createdId: args.createdId,
        resolverMode,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  async function buildCreateExecutionErrorResult(args: {
    intent: any;
    error: unknown;
    matchedBy: string;
  }): Promise<AnimaRunResult> {
    const reason = String(
      (args.error as any)?.message ?? "EVENT_CREATE_FAILED",
    );
    const invalidInterval =
      reason.includes("CREATE_INTENT_INVALID_INTERVAL") ||
      reason.includes("endAt deve essere maggiore di startAt");

    if (!invalidInterval) {
      throw args.error;
    }

    await persistPendingCreateState(state, {
      missing: ["data/orario"],
      data: {
        ...buildPendingCreateData(args.intent),
        endAt: null,
        timeKind: null,
      },
    });

    return buildAnimaRunResult(state, {
      text: buildInvalidIntervalReply({
        eventTypeLabel: args.intent.payload.eventType?.label ?? null,
      }),
      strategy: "event_create_clarification",
      usedCapabilities: ["eventi.create"],
      debug: {
        matchedBy: `${args.matchedBy}:invalid_interval`,
        payload: args.intent.payload,
        invalidInterval: true,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (
    state.operationRouting!.branch === "event_create_flow" &&
    pendingCreate &&
    authContext &&
    pendingCreate.readiness === "ready" &&
    operationGuardrail.mode === "active_operation" &&
    operationGuardrail.intent === "submit"
  ) {
    const readyIntent = buildCreateIntentFromPendingState({
      pending: pendingCreate,
    });

    if (readyIntent) {
      try {
        const created = await executeEventCreateOperation({
          auth: authContext,
          userId: context.user.userId,
          intent: readyIntent,
        });
        state.operationExecution = created;
        await clearPendingCreateState(context.session.sessionId);
        return buildPostCreateResult({
          createdId: created.createdId,
          payload: created.payload,
          matchedBy: "event_create_from_submit_signal",
        });
      } catch (error) {
        return buildCreateExecutionErrorResult({
          intent: readyIntent,
          error,
          matchedBy: "event_create_from_submit_signal",
        });
      }
    }
  }

  if (
    state.operationRouting!.branch === "event_create_flow" &&
    pendingCreate &&
    authContext &&
    pendingCreate.phase === "collect_notes"
  ) {
    const notesAnswer = parseOptionalNotesAnswer(interpretedMessage);

    if (notesAnswer !== undefined) {
      const directPendingCreateIntent = buildCreateIntentFromPendingState({
        pending: pendingCreate,
        notes: notesAnswer,
      });

      if (directPendingCreateIntent) {
        try {
          const created = await executeEventCreateOperation({
            auth: authContext,
            userId: context.user.userId,
            intent: directPendingCreateIntent,
          });
          state.operationExecution = created;
          await clearPendingCreateState(context.session.sessionId);
          return buildPostCreateResult({
            createdId: created.createdId,
            payload: created.payload,
            matchedBy: "event_create_from_pending_notes",
          });
        } catch (error) {
          return buildCreateExecutionErrorResult({
            intent: directPendingCreateIntent,
            error,
            matchedBy: "event_create_from_pending_notes",
          });
        }
      }
    }
  }

  if (
    state.operationRouting!.branch === "event_create_flow" &&
    createIntent &&
    authContext
  ) {
    if (createIntent.missing.includes("tipo evento")) {
      await persistPendingCreateState(state, {
        missing: createIntent.missing,
        data: {
          ...buildPendingCreateData(createIntent),
          eventTypeSlug: null,
          eventTypeLabel: null,
        },
      });
      const fallbackText = buildNeedEventTypeReply(listKnownCreateTypes());
      return buildAnimaRunResult(state, {
        text: fallbackText,
        strategy: "event_create_clarification",
        usedCapabilities: ["conversation.help.events"],
        debug: {
          matchedBy: "event_create_clarification",
          missing: createIntent.missing,
          payload: createIntent.payload,
          alreadyComposed: false,
          resolverMode,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }

    if (createIntent.missing.length > 0) {
      await persistPendingCreateState(state, {
        missing: createIntent.missing,
        data: buildPendingCreateData(createIntent),
      });

      const nextField = createIntent.missing.includes("titolo")
        ? "title"
        : createIntent.missing.includes("data/orario")
          ? "time"
          : "notes";
      const invalidInterval = createIntent.debug.invalidInterval === true;
      const fallbackText = invalidInterval
        ? buildInvalidIntervalReply({
            eventTypeLabel: createIntent.payload.eventType?.label ?? null,
          })
        : buildCreateQuestion({
            missingField: nextField,
            eventTypeLabel: createIntent.payload.eventType?.label ?? null,
          });
      const clarificationPhase = resolvePendingCreatePhase({
        missing: createIntent.missing,
        notes: createIntent.payload.notes,
      });

      return buildAnimaRunResult(state, {
        text: fallbackText,
        strategy: "event_create_clarification",
        usedCapabilities: ["eventi.create"],
        debug: {
          matchedBy: "event_create_clarification",
          missing: createIntent.missing,
          payload: createIntent.payload,
          invalidInterval,
          alreadyComposed: false,
          resolverMode,
          componentConfig: ANIMA_COMPONENT_CONFIG,
          pendingPhase: clarificationPhase,
        },
      });
    }

    if (
      awaitingOptionalNotes &&
      typeof createIntent.payload.notes === "undefined"
    ) {
      const notesAnswer = parseOptionalNotesAnswer(interpretedMessage);

      if (notesAnswer === undefined) {
        await persistPendingCreateState(state, {
          missing: ["note opzionali"],
          data: {
            ...buildPendingCreateData(createIntent),
            notes: null,
          },
        });
        const fallbackText = buildCreateQuestion({
          missingField: "notes",
          eventTypeLabel: createIntent.payload.eventType?.label ?? null,
        });

        return buildAnimaRunResult(state, {
          text: fallbackText,
          strategy: "event_create_clarification",
          usedCapabilities: ["eventi.create"],
          debug: {
            matchedBy: "event_create_clarification",
            missing: ["note opzionali"],
            payload: createIntent.payload,
            alreadyComposed: false,
            resolverMode,
            componentConfig: ANIMA_COMPONENT_CONFIG,
            pendingPhase: "collect_notes",
          },
        });
      }

      createIntent.payload.notes = notesAnswer ?? undefined;
    }

    if (
      !awaitingOptionalNotes &&
      typeof createIntent.payload.notes === "undefined"
    ) {
      await persistPendingCreateState(state, {
        missing: ["note opzionali"],
        data: {
          ...buildPendingCreateData(createIntent),
          notes: null,
        },
      });
      const fallbackText = buildCreateQuestion({
        missingField: "notes",
        eventTypeLabel: createIntent.payload.eventType?.label ?? null,
      });

      return buildAnimaRunResult(state, {
        text: fallbackText,
        strategy: "event_create_clarification",
        usedCapabilities: ["eventi.create"],
        debug: {
          matchedBy: "event_create_clarification",
          missing: ["note opzionali"],
          payload: createIntent.payload,
          alreadyComposed: false,
          resolverMode,
          componentConfig: ANIMA_COMPONENT_CONFIG,
          pendingPhase: "collect_notes",
        },
      });
    }

    try {
      const created = await executeEventCreateOperation({
        auth: authContext,
        userId: context.user.userId,
        intent: createIntent,
      });
      state.operationExecution = created;
      await clearPendingCreateState(context.session.sessionId);
      return buildPostCreateResult({
        createdId: created.createdId,
        payload: created.payload,
        matchedBy: "event_create",
      });
    } catch (error) {
      return buildCreateExecutionErrorResult({
        intent: createIntent,
        error,
        matchedBy: "event_create",
      });
    }
  }

  if (state.operationRouting!.branch === "event_create_flow" && pendingCreate) {
    return buildAnimaRunResult(state, {
      text: buildPendingTaskReminder({
        phase: pendingCreate.phase,
        eventTypeLabel: pendingCreate.data.eventTypeLabel ?? null,
      }),
      strategy: "event_create_clarification",
      usedCapabilities: ["eventi.create"],
      debug: {
        matchedBy: "pending_task_reminder",
        pendingPhase: pendingCreate.phase,
        pendingMissing: pendingCreate.missing,
        pendingData: pendingCreate.data,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (
    state.operationRouting!.branch === "event_list" &&
    authContext &&
    (listIntent ||
      pendingEventList ||
      state.operationContextFill?.kind === "event_list")
  ) {
    const effectiveListIntent =
      mergeEventListIntentWithOperationFill({
        intent:
          pendingEventList && !listIntent
            ? mergePendingEventListIntent({
                pending: pendingEventList,
                message: interpretedMessage,
                resolverMode,
              })
            : pendingEventList && listIntent
              ? mergePendingEventListIntent({
                  pending: pendingEventList,
                  message: interpretedMessage,
                  resolverMode,
                })
              : listIntent,
        pending: pendingEventList,
        fill:
          state.operationContextFill?.kind === "event_list"
            ? state.operationContextFill
            : null,
      });

    if (!effectiveListIntent) {
      return null;
    }

    const clarification = analyzeEventListIntent(effectiveListIntent);

    if (clarification.needsClarification) {
      await persistPendingEventListState(state, {
        operation: "event_list",
        phase: "collect_filters",
        readiness: "collecting",
        data: {
          eventTypeSlug: effectiveListIntent.filters.eventType?.slug ?? null,
          eventTypeLabel: effectiveListIntent.filters.eventType?.label ?? null,
          days: effectiveListIntent.filters.days ?? null,
          futureDays: effectiveListIntent.filters.futureDays ?? null,
          specificDate: effectiveListIntent.filters.specificDate ?? null,
          timeFrom: effectiveListIntent.filters.timeFrom ?? null,
          timeTo: effectiveListIntent.filters.timeTo ?? null,
          query: effectiveListIntent.filters.query ?? null,
          limit: effectiveListIntent.filters.limit ?? null,
          wantsAll: effectiveListIntent.filters.wantsAll ?? false,
        },
        missing: clarification.missing,
      });

      return buildAnimaRunResult(state, {
        text: buildEventListQuestion({
          availableTypes: listAnimaEventoTypes().map((item) => item.label),
          missing: clarification.missing,
          eventTypeLabel: effectiveListIntent.filters.eventType?.label ?? null,
          periodHint: clarification.periodHint,
          ambiguousOptions:
            effectiveListIntent.debug.ambiguousTypeOptions ?? null,
        }),
        strategy: "event_list_clarification",
        usedCapabilities: ["conversation.help.events", "eventi.types.list"],
        debug: {
          matchedBy: pendingEventList
            ? "event_list_clarification_from_pending"
            : "event_list_clarification",
          filters: effectiveListIntent.filters,
          missing: clarification.missing,
          periodHint: clarification.periodHint,
          alreadyComposed: false,
          resolverMode,
          componentConfig: ANIMA_COMPONENT_CONFIG,
        },
      });
    }

    const result = await executeEventListIntent({
      auth: authContext,
      intent: effectiveListIntent,
    });
    state.operationExecution = {
      intent: effectiveListIntent,
      result,
    };
    await clearOperationState(context.session.sessionId);

    return buildAnimaRunResult(state, {
      text: buildEventListReply({
        intent: effectiveListIntent,
        result,
        displayName: context.user.displayName ?? context.user.fullName,
      }),
      strategy: "event_list",
      usedCapabilities: ["eventi.recent.summary"],
      debug: {
        matchedBy: pendingEventList ? "event_list_from_pending" : "event_list",
        filters: effectiveListIntent.filters,
        eventTypeMatch: effectiveListIntent.filters.eventType,
        total: result.total,
        returned: result.items.length,
        hasMore: result.hasMore,
        listingPresentation: result.presentation,
        items: result.items.map((item) => ({
          type: item.type,
          label: item.label,
          displayName: item.displayName,
          startAt: item.startAt ?? null,
        })),
        resolverMode,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (
    state.operationRouting!.branch === "event_recent" &&
    recentIntent &&
    authContext
  ) {
    const summary = await loadRecentEventsSummary({
      auth: authContext,
      days: recentIntent.days,
    });

    return buildAnimaRunResult(state, {
      text: buildRecentEventsReply(summary),
      strategy: "event_recent_summary",
      usedCapabilities: ["eventi.recent.summary"],
      debug: {
        matchedBy: "event_recent_summary",
        days: recentIntent.days,
        total: summary.total,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  if (state.operationRouting!.branch === "event_discovery") {
    const eventoTypes = listAnimaEventoTypes();
    return buildAnimaRunResult(state, {
      text: buildEventDiscoveryReply(eventoTypes),
      strategy: "event_discovery",
      usedCapabilities: ["conversation.help.events", "eventi.types.list"],
      debug: {
        matchedBy: "event_discovery",
        eventTypesCount: eventoTypes.length,
        componentConfig: ANIMA_COMPONENT_CONFIG,
      },
    });
  }

  return null;
}
