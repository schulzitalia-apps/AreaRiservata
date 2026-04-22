import type { SenseInterpretation } from "@/server-utils/anima/nodes/senseInterpreter";
import type { OperationGuardrailResult } from "@/server-utils/anima/core/operationGuardrails";
import type { PendingOperationState } from "@/server-utils/anima/memory/sessionState";

export type OperationRouterBranch =
  | "cancel_active_operation"
  | "mail_followup_pending"
  | "generic_mail_pending"
  | "event_create_flow"
  | "generic_mail_new"
  | "mail_digest"
  | "missing_profile_email"
  | "event_list"
  | "event_recent"
  | "anagrafiche_read"
  | "anagrafiche_create"
  | "sprint_timeline_read"
  | "low_value"
  | "unsupported_reminder"
  | "event_discovery"
  | "orange_guardrail"
  | "not_understood";

export type OperationRouterDecision = {
  branch: OperationRouterBranch;
  reason: string;
  activeOperation: PendingOperationState["operation"] | null;
  usedSignals: string[];
};

export function routeAnimaOperation(args: {
  operationState: PendingOperationState | null;
  operationGuardrail: OperationGuardrailResult;
  senseInterpretation: SenseInterpretation | null;
  hasCreateIntent: boolean;
  hasListIntent: boolean;
  hasRecentIntent: boolean;
  hasAnagraficheReadIntent: boolean;
  hasAnagraficheCreateIntent: boolean;
  hasSprintTimelineReadIntent: boolean;
  hasGenericMailIntent: boolean;
  wantsMail: boolean;
  wantsDigestMail: boolean;
  hasProfileEmail: boolean;
  lowValueMatched: boolean;
  unsupportedReminderMatched: boolean;
  supportsDiscovery: boolean;
  hasAuthContext: boolean;
}): OperationRouterDecision {
  const activeOperation = args.operationState?.operation ?? null;
  const usedSignals: string[] = [];
  const senseDecision = args.senseInterpretation?.operationDecision ?? "none";
  const senseCapability = args.senseInterpretation?.likelyCapability ?? "unknown";
  const senseRoute = args.senseInterpretation?.route ?? "guardrail";
  const senseWantsNewOperation = senseDecision === "open_new";
  const senseWantsOpenOperation = senseDecision === "continue_open";
  const senseSupportsOperation =
    senseWantsNewOperation || senseWantsOpenOperation;

  if (
    args.operationGuardrail.mode === "active_operation" &&
    args.operationGuardrail.intent === "cancel"
  ) {
    return {
      branch: "cancel_active_operation",
      reason: args.operationGuardrail.reason,
      activeOperation,
      usedSignals: ["operationGuardrail.cancel"],
    };
  }

  if (activeOperation === "mail_followup") {
    return {
      branch: "mail_followup_pending",
      reason: "pending_mail_followup_has_priority",
      activeOperation,
      usedSignals: ["operationState.mail_followup"],
    };
  }

  if (activeOperation === "generic_mail") {
    return {
      branch: "generic_mail_pending",
      reason: "pending_generic_mail_has_priority",
      activeOperation,
      usedSignals: ["operationState.generic_mail"],
    };
  }

  if (activeOperation === "event_create") {
    usedSignals.push("operationState.event_create");
    if (
      args.operationGuardrail.mode === "active_operation" &&
      (args.operationGuardrail.intent === "submit" ||
        args.operationGuardrail.intent === "complete" ||
        args.operationGuardrail.intent === "unknown_but_bound")
    ) {
      usedSignals.push(`operationGuardrail.${args.operationGuardrail.intent}`);
    }

    return {
      branch: "event_create_flow",
      reason: "pending_event_create_has_priority",
      activeOperation,
      usedSignals,
    };
  }

  if (activeOperation === "event_list") {
    return {
      branch: "event_list",
      reason: "pending_event_list_has_priority",
      activeOperation,
      usedSignals: ["operationState.event_list"],
    };
  }

  if (activeOperation === "sprint_timeline_read") {
    return {
      branch: "sprint_timeline_read",
      reason: "pending_sprint_timeline_read_has_priority",
      activeOperation,
      usedSignals: ["operationState.sprint_timeline_read"],
    };
  }

  if (activeOperation === "anagrafiche_read") {
    return {
      branch: "anagrafiche_read",
      reason: "pending_anagrafiche_read_has_priority",
      activeOperation,
      usedSignals: ["operationState.anagrafiche_read"],
    };
  }

  if (activeOperation === "anagrafiche_create") {
    return {
      branch: "anagrafiche_create",
      reason: "pending_anagrafiche_create_has_priority",
      activeOperation,
      usedSignals: ["operationState.anagrafiche_create"],
    };
  }

  if (args.hasCreateIntent && args.hasAuthContext) {
    return {
      branch: "event_create_flow",
      reason: "new_event_create_detected",
      activeOperation,
      usedSignals: [
        "createIntent",
        ...(args.senseInterpretation?.likelyCapability === "event_create"
          ? ["sense.event_create"]
          : []),
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "event_create" &&
    senseSupportsOperation &&
    (senseRoute === "event_operation" || senseRoute === "active_operation")
  ) {
    return {
      branch: "event_create_flow",
      reason: "sense_event_create_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.event_create",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (
    args.hasGenericMailIntent &&
    !args.hasListIntent &&
    !args.hasCreateIntent
  ) {
    return {
      branch: "generic_mail_new",
      reason: "generic_mail_detected",
      activeOperation,
      usedSignals: [
        "genericMailIntent",
        ...(args.senseInterpretation?.likelyCapability === "generic_mail"
          ? ["sense.generic_mail"]
          : []),
      ],
    };
  }

  if (
    senseCapability === "generic_mail" &&
    senseSupportsOperation &&
    (senseRoute === "mail_operation" || senseRoute === "active_operation") &&
    !args.hasListIntent &&
    !args.hasCreateIntent
  ) {
    return {
      branch: "generic_mail_new",
      reason: "sense_generic_mail_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.generic_mail",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (args.wantsMail && !args.hasProfileEmail) {
    return {
      branch: "missing_profile_email",
      reason: "mail_requested_but_profile_email_missing",
      activeOperation,
      usedSignals: ["mailIntent", "missingProfileEmail"],
    };
  }

  if (
    args.wantsDigestMail &&
    args.hasListIntent &&
    args.hasAuthContext &&
    args.hasProfileEmail
  ) {
    return {
      branch: "mail_digest",
      reason: "events_digest_mail_detected",
      activeOperation,
      usedSignals: ["mailIntent", "listIntent"],
    };
  }

  if (args.hasSprintTimelineReadIntent && args.hasAuthContext) {
    return {
      branch: "sprint_timeline_read",
      reason: "sprint_timeline_read_detected",
      activeOperation,
      usedSignals: [
        "sprintTimelineReadIntent",
        ...(args.senseInterpretation?.likelyCapability === "unknown"
          ? []
          : [`sense.${args.senseInterpretation?.likelyCapability}`]),
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "sprint_timeline_read" &&
    senseSupportsOperation
  ) {
    return {
      branch: "sprint_timeline_read",
      reason: "sense_sprint_timeline_read_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.sprint_timeline_read",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (args.hasAnagraficheReadIntent && args.hasAuthContext) {
    return {
      branch: "anagrafiche_read",
      reason: "anagrafiche_read_detected",
      activeOperation,
      usedSignals: [
        "anagraficheReadIntent",
        ...(args.senseInterpretation?.likelyCapability === "unknown"
          ? []
          : [`sense.${args.senseInterpretation?.likelyCapability}`]),
      ],
    };
  }

  if (args.hasAnagraficheCreateIntent && args.hasAuthContext) {
    return {
      branch: "anagrafiche_create",
      reason: "anagrafiche_create_detected",
      activeOperation,
      usedSignals: [
        "anagraficheCreateIntent",
        ...(args.senseInterpretation?.likelyCapability === "unknown"
          ? []
          : [`sense.${args.senseInterpretation?.likelyCapability}`]),
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "anagrafiche_read" &&
    senseSupportsOperation
  ) {
    return {
      branch: "anagrafiche_read",
      reason: "sense_anagrafiche_read_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.anagrafiche_read",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "anagrafiche_create" &&
    senseSupportsOperation
  ) {
    return {
      branch: "anagrafiche_create",
      reason: "sense_anagrafiche_create_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.anagrafiche_create",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (args.hasListIntent && args.hasAuthContext) {
    return {
      branch: "event_list",
      reason: "event_list_detected",
      activeOperation,
      usedSignals: [
        "listIntent",
        ...(args.senseInterpretation?.likelyCapability === "event_list"
          ? ["sense.event_list"]
          : []),
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "event_list" &&
    senseSupportsOperation &&
    (senseRoute === "event_operation" || senseRoute === "active_operation")
  ) {
    return {
      branch: "event_list",
      reason: "sense_event_list_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.event_list",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (args.hasRecentIntent && args.hasAuthContext) {
    return {
      branch: "event_recent",
      reason: "event_recent_detected",
      activeOperation,
      usedSignals: [
        "recentIntent",
        ...(args.senseInterpretation?.likelyCapability === "event_recent"
          ? ["sense.event_recent"]
          : []),
      ],
    };
  }

  if (
    args.hasAuthContext &&
    senseCapability === "event_recent" &&
    senseSupportsOperation &&
    (senseRoute === "event_operation" || senseRoute === "active_operation")
  ) {
    return {
      branch: "event_recent",
      reason: "sense_event_recent_operation_detected",
      activeOperation,
      usedSignals: [
        "sense.event_recent",
        `sense.route:${senseRoute}`,
        `sense.operationDecision:${senseDecision}`,
      ],
    };
  }

  if (args.lowValueMatched && args.operationGuardrail.mode === "free") {
    return {
      branch: "low_value",
      reason: "low_value_guardrail",
      activeOperation,
      usedSignals: ["lowValueMatched"],
    };
  }

  if (args.unsupportedReminderMatched) {
    return {
      branch: "unsupported_reminder",
      reason: "unsupported_reminder_detected",
      activeOperation,
      usedSignals: ["unsupportedReminderMatched"],
    };
  }

  if (args.supportsDiscovery) {
    return {
      branch: "event_discovery",
      reason: "event_discovery_detected",
      activeOperation,
      usedSignals: ["supportsDiscovery"],
    };
  }

  if (args.senseInterpretation?.guardrailColor === "orange") {
    return {
      branch: "orange_guardrail",
      reason: "orange_guardrail_from_sense_interpreter",
      activeOperation,
      usedSignals: ["sense.orange"],
    };
  }

  return {
    branch: "not_understood",
    reason: "no_branch_matched",
    activeOperation,
    usedSignals: args.senseInterpretation
      ? [
          `sense.route:${args.senseInterpretation.route}`,
          `sense.capability:${args.senseInterpretation.likelyCapability}`,
        ]
      : [],
  };
}
