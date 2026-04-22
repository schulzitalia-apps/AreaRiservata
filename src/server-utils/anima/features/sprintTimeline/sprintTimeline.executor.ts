import type { AnimaRunResult } from "@/server-utils/anima/core/types";
import type { AnimaAgentState } from "@/server-utils/anima/core/agentState";
import {
  buildAnimaRunResult,
  persistPendingSprintTimelineReadState,
} from "@/server-utils/anima/core/stateHelpers";
import { clearOperationState } from "@/server-utils/anima/memory/sessionState";
import {
  analyzeSprintTimelineReadIntent,
  buildSprintTimelineReadQuestion,
  buildDeterministicFirstTaskAdvice,
  executeSprintTimelineReadIntent,
  mergeSprintTimelineReadIntentWithFill,
  mergePendingSprintTimelineReadIntent,
} from "./sprintTimeline.read";
import { composeSprintTimelinePriorityAdvice } from "./sprintTimeline.advisor";
import type { SprintTimelineReadIntent } from "./sprintTimeline.types";

export async function executeSprintTimelineBranch(
  state: AnimaAgentState,
  params: {
    readIntent: SprintTimelineReadIntent | null;
  },
): Promise<AnimaRunResult | null> {
  if (state.operationRouting?.branch !== "sprint_timeline_read") {
    return null;
  }

  if (!state.authContext) {
    return null;
  }

  const pendingRead =
    state.operationState?.operation === "sprint_timeline_read"
      ? state.operationState
      : null;
  const parsedOrPendingIntent = pendingRead
    ? mergePendingSprintTimelineReadIntent({
        pending: pendingRead,
        message: state.interpretedMessage,
        userDisplayName:
          state.context.user.displayName ?? state.context.user.fullName,
      })
    : params.readIntent;
  const effectiveIntent = mergeSprintTimelineReadIntentWithFill({
    intent: parsedOrPendingIntent,
    pending: pendingRead,
    fill:
      state.operationContextFill?.kind === "sprint_timeline_read"
        ? state.operationContextFill
        : null,
    message: state.interpretedMessage,
    userDisplayName:
      state.context.user.displayName ?? state.context.user.fullName,
  });

  if (!effectiveIntent) {
    return null;
  }
  const clarification = analyzeSprintTimelineReadIntent(effectiveIntent);

  if (clarification.needsClarification) {
    await persistPendingSprintTimelineReadState(state, {
      operation: "sprint_timeline_read",
      phase:
        clarification.missing[0] === "scope"
          ? "collect_scope"
          : clarification.missing[0] === "signal"
            ? "collect_signal"
            : clarification.missing[0] === "priority"
              ? "collect_priority"
              : clarification.missing[0] === "task_query"
                ? "collect_task"
              : "collect_due_window",
      readiness: "collecting",
      data: {
        mode: effectiveIntent.query.mode,
        scope: effectiveIntent.query.scope ?? null,
        personNames: effectiveIntent.query.personNames ?? [],
        signals: effectiveIntent.query.signals ?? [],
        priority: effectiveIntent.query.priority ?? null,
        dueWithinDays: effectiveIntent.query.dueWithinDays ?? null,
        taskQuery: effectiveIntent.query.taskQuery ?? null,
        aggregateByOwner: effectiveIntent.query.aggregateByOwner ?? false,
      },
      missing: clarification.missing,
    });

    const pendingData = {
      mode: effectiveIntent.query.mode,
      scope: effectiveIntent.query.scope ?? null,
      personNames: effectiveIntent.query.personNames ?? [],
      signals: effectiveIntent.query.signals ?? [],
      priority: effectiveIntent.query.priority ?? null,
      dueWithinDays: effectiveIntent.query.dueWithinDays ?? null,
      taskQuery: effectiveIntent.query.taskQuery ?? null,
      aggregateByOwner: effectiveIntent.query.aggregateByOwner ?? false,
    };
    const fallbackQuestion = buildSprintTimelineReadQuestion({
      missing: clarification.missing,
      currentQuery: effectiveIntent.query,
    });

    return buildAnimaRunResult(state, {
      text: fallbackQuestion,
      strategy: "sprint_timeline_query_clarification",
      usedCapabilities: ["sprintTimeline.read"],
      debug: {
        matchedBy: effectiveIntent.debug.matchedBy,
        query: effectiveIntent.query,
        missing: clarification.missing,
        alreadyComposed: false,
      },
    });
  }

  await clearOperationState(state.context.session.sessionId);
  const result = await executeSprintTimelineReadIntent({
    auth: state.authContext,
    query: effectiveIntent.query,
    userDisplayName:
      state.context.user.displayName ?? state.context.user.fullName,
  });

  if (effectiveIntent.query.mode === "priority_advice") {
    const deterministicAdvice = buildDeterministicFirstTaskAdvice(result);
    const dynamicAdvice = await composeSprintTimelinePriorityAdvice({
      userDisplayName:
        state.context.user.displayName ?? state.context.user.fullName,
      conversationSummary: state.conversationSummary,
      recentTurns: state.context.recentTurns,
      userMessage: state.interpretedMessage,
      rankedTasks: result,
      traceCollector: (step) => state.llmTrace.push(step),
    });

    return buildAnimaRunResult(state, {
      text: dynamicAdvice ?? deterministicAdvice,
      strategy: "sprint_timeline_priority_advice",
      usedCapabilities: ["sprintTimeline.read", "sprintTimeline.prioritize"],
      debug: {
        matchedBy: effectiveIntent.debug.matchedBy,
        total: result.total,
        items: result.items,
        scheduler: result.items.map((item) => ({
          title: item.title,
          schedulerRank: item.schedulerRank ?? null,
          schedulerReason: item.schedulerReason ?? null,
          nextPassageLabel: item.nextPassageLabel ?? null,
        })),
        alreadyComposed: !!dynamicAdvice,
      },
    });
  }

  const strategy =
    effectiveIntent.query.mode === "due_tasks"
      ? "sprint_timeline_due"
      : "sprint_timeline_active_today";

  return buildAnimaRunResult(state, {
    text: result.text,
    strategy,
    usedCapabilities: ["sprintTimeline.read"],
    debug: {
      matchedBy: effectiveIntent.debug.matchedBy,
      query: effectiveIntent.query,
      total: result.total,
      items: result.items,
      scheduler: result.items.map((item) => ({
        title: item.title,
        schedulerRank: item.schedulerRank ?? null,
        schedulerReason: item.schedulerReason ?? null,
        nextPassageLabel: item.nextPassageLabel ?? null,
      })),
      distinctOwnerCount: result.distinctOwnerCount ?? 0,
      ownerNames: result.ownerNames ?? [],
      listingPresentation: result.presentation,
    },
  });
}
