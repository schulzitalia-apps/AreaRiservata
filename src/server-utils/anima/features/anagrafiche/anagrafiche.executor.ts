import type { AnimaRunResult } from "@/server-utils/anima/core/types";
import type { AnimaAgentState } from "@/server-utils/anima/core/agentState";
import {
  buildAnimaRunResult,
  persistPendingAnagraficheCreateState,
  persistPendingAnagraficheReadState,
} from "@/server-utils/anima/core/stateHelpers";
import { rememberContacts } from "@/server-utils/anima/memory/contactState";
import { clearOperationState } from "@/server-utils/anima/memory/sessionState";
import {
  analyzeAnagraficheCreateIntent,
  buildAnagraficheCreateQuestion,
  executeAnagraficheCreateIntent,
  mergeAnagraficheCreateIntentWithFill,
  mergePendingAnagraficheCreateIntent,
} from "./anagrafiche.create";
import {
  analyzeAnagraficheReadIntent,
  buildAnagraficheReadQuestion,
  executeAnagraficheReadIntent,
  mergeAnagraficheReadIntentWithFill,
  mergePendingAnagraficheReadIntent,
} from "./anagrafiche.read";
import type {
  AnagraficheCreateIntent,
  AnagraficheReadIntent,
} from "./anagrafiche.types";

export async function executeAnagraficheBranch(
  state: AnimaAgentState,
  params: {
    readIntent: AnagraficheReadIntent | null;
    createIntent: AnagraficheCreateIntent | null;
  },
): Promise<AnimaRunResult | null> {
  if (
    state.operationRouting?.branch !== "anagrafiche_read" &&
    state.operationRouting?.branch !== "anagrafiche_create"
  ) {
    return null;
  }

  if (!state.authContext) {
    return null;
  }

  if (state.operationRouting?.branch === "anagrafiche_create") {
    const pendingCreate =
      state.operationState?.operation === "anagrafiche_create"
        ? state.operationState
        : null;
    const effectiveIntent = pendingCreate
      ? mergePendingAnagraficheCreateIntent({
          pending: pendingCreate,
          message: state.interpretedMessage,
        })
      : params.createIntent;

    const mergedIntent = mergeAnagraficheCreateIntentWithFill({
      intent: effectiveIntent,
      pending: pendingCreate,
      fill:
        state.operationContextFill?.kind === "anagrafiche_create"
          ? state.operationContextFill
          : null,
      message: state.interpretedMessage,
    });

    if (!mergedIntent) {
      return null;
    }

    const clarification = analyzeAnagraficheCreateIntent(mergedIntent);
    if (clarification.needsClarification) {
      const phase =
        clarification.missing[0] === "type" ? "collect_type" : "collect_data";
      const pendingData = {
        typeSlug: mergedIntent.query.typeSlug ?? null,
        typeLabel: mergedIntent.query.typeLabel ?? null,
        draftData: mergedIntent.query.draftData ?? {},
        suggestedFields: mergedIntent.query.suggestedFields ?? [],
        confirmWrite: false,
      };

      await persistPendingAnagraficheCreateState(state, {
        operation: "anagrafiche_create",
        phase,
        readiness: "collecting",
        data: pendingData,
        missing: clarification.missing,
      });

      const fallbackQuestion = buildAnagraficheCreateQuestion({
        missing: clarification.missing,
        currentQuery: mergedIntent.query,
      });
      return buildAnimaRunResult(state, {
        text: fallbackQuestion,
        strategy: "anagrafiche_create_clarification",
        usedCapabilities: ["anagrafiche.create"],
        debug: {
          matchedBy: mergedIntent.debug.matchedBy,
          query: mergedIntent.query,
          missing: clarification.missing,
          alreadyComposed: false,
        },
      });
    }

    const execution = await executeAnagraficheCreateIntent({
      auth: state.authContext,
      query: mergedIntent.query,
    });

    if (execution.kind === "clarification") {
      await persistPendingAnagraficheCreateState(state, {
        operation: "anagrafiche_create",
        phase: execution.phase,
        readiness:
          execution.phase === "confirm_write" ? "ready" : "collecting",
        data: execution.data,
        missing: execution.missing,
      });

      return buildAnimaRunResult(state, {
        text: execution.question,
        strategy: "anagrafiche_create_clarification",
        usedCapabilities: ["anagrafiche.create"],
        debug: {
          matchedBy: mergedIntent.debug.matchedBy,
          query: mergedIntent.query,
          missing: execution.missing,
          alreadyComposed: false,
        },
      });
    }

    await clearOperationState(state.context.session.sessionId);

    if (execution.kind === "denied") {
      return buildAnimaRunResult(state, {
        text: execution.text,
        strategy: "anagrafiche_create_denied",
        usedCapabilities: ["anagrafiche.create"],
        debug: {
          matchedBy: mergedIntent.debug.matchedBy,
          query: mergedIntent.query,
          deniedReason: execution.reason,
        },
      });
    }

    return buildAnimaRunResult(state, {
      text: execution.result.text,
      strategy: "anagrafiche_create",
      usedCapabilities: ["anagrafiche.create"],
      debug: {
        matchedBy: mergedIntent.debug.matchedBy,
        query: mergedIntent.query,
        createdId: execution.result.createdId,
        typeLabel: execution.result.typeLabel,
        summaryLines: execution.result.summaryLines,
      },
    });
  }

  const pendingRead =
    state.operationState?.operation === "anagrafiche_read"
      ? state.operationState
      : null;
  const effectiveIntent = pendingRead
    ? mergePendingAnagraficheReadIntent({
        pending: pendingRead,
        message: state.interpretedMessage,
      })
    : params.readIntent;

  const mergedIntent = mergeAnagraficheReadIntentWithFill({
    intent: effectiveIntent,
    pending: pendingRead,
    fill:
      state.operationContextFill?.kind === "anagrafiche_read"
        ? state.operationContextFill
        : null,
    message: state.interpretedMessage,
  });

  if (!mergedIntent) {
    return null;
  }

  const clarification = analyzeAnagraficheReadIntent(mergedIntent);
  if (clarification.needsClarification) {
    const phase =
      clarification.missing[0] === "type" ? "collect_type" : "collect_query";
    const pendingData = {
      typeSlug: mergedIntent.query.typeSlug ?? null,
      typeLabel: mergedIntent.query.typeLabel ?? null,
      query: mergedIntent.query.query ?? null,
      requestedFields: mergedIntent.query.requestedFields ?? [],
      wantsList: mergedIntent.query.wantsList ?? false,
      selectedRecordId: mergedIntent.query.selectedRecordId ?? null,
      selectedRecordLabel: mergedIntent.query.selectedRecordLabel ?? null,
      candidateItems: [],
    };

    await persistPendingAnagraficheReadState(state, {
      operation: "anagrafiche_read",
      phase,
      readiness: "collecting",
      data: pendingData,
      missing: clarification.missing,
    });

    const fallbackQuestion = buildAnagraficheReadQuestion({
      missing: clarification.missing,
      currentQuery: mergedIntent.query,
    });
    return buildAnimaRunResult(state, {
      text: fallbackQuestion,
      strategy: "anagrafiche_query_clarification",
      usedCapabilities: ["anagrafiche.read"],
      debug: {
        matchedBy: mergedIntent.debug.matchedBy,
        query: mergedIntent.query,
        missing: clarification.missing,
        alreadyComposed: false,
      },
    });
  }

  const execution = await executeAnagraficheReadIntent({
    auth: state.authContext,
    query: mergedIntent.query,
  });

  if (execution.kind === "clarification") {
    await persistPendingAnagraficheReadState(state, {
      operation: "anagrafiche_read",
      phase: execution.phase,
      readiness: "collecting",
      data: execution.data,
      missing: execution.missing,
    });

    return buildAnimaRunResult(state, {
      text: execution.question,
      strategy: "anagrafiche_query_clarification",
      usedCapabilities: ["anagrafiche.read"],
      debug: {
        matchedBy: mergedIntent.debug.matchedBy,
        query: mergedIntent.query,
        missing: execution.missing,
        candidateItems: execution.data.candidateItems ?? [],
        alreadyComposed: false,
      },
    });
  }

  const rememberedContacts = execution.result.items
    .filter((item) => (item.contactEmails?.length ?? 0) > 0)
    .map((item) => ({
      recordId: item.id,
      typeSlug: item.typeSlug,
      typeLabel: item.typeLabel,
      displayName: item.displayName,
      emails: item.contactEmails ?? [],
      phones: item.contactPhones ?? [],
      updatedAt: new Date().toISOString(),
    }));

  if (rememberedContacts.length) {
    state.contactState = await rememberContacts(
      state.context.session.sessionId,
      rememberedContacts,
    );
  }

  await clearOperationState(state.context.session.sessionId);

  return buildAnimaRunResult(state, {
    text: execution.result.text,
    strategy: "anagrafiche_read",
    usedCapabilities: ["anagrafiche.read"],
    debug: {
      matchedBy: mergedIntent.debug.matchedBy,
      query: mergedIntent.query,
      total: execution.result.total,
      items: execution.result.items,
      listingPresentation: execution.result.presentation,
    },
  });
}
