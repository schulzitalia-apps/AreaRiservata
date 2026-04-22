import type { PendingOperationState } from "../memory/sessionState";
import { parseOptionalNotesAnswer } from "../features/eventi/eventi.create";

export type OperationGuardrailResult =
  | { mode: "free" }
  | {
      mode: "active_operation";
      intent:
        | "cancel"
        | "submit"
        | "complete"
        | "continue"
        | "unknown_but_bound";
      reason: string;
    };

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCancellation(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("annulla") ||
    normalized.includes("lascia stare") ||
    normalized.includes("ferma") ||
    normalized.includes("stop")
  );
}

function isSubmit(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized === "invia" ||
    normalized === "conferma" ||
    normalized === "vai" ||
    normalized === "ok invia" ||
    normalized === "procedi"
  );
}

export function evaluateOperationGuardrails(args: {
  message: string;
  operationState: PendingOperationState | null;
}): OperationGuardrailResult {
  if (!args.operationState) {
    return { mode: "free" };
  }

  if (isCancellation(args.message)) {
    return {
      mode: "active_operation",
      intent: "cancel",
      reason: "user_cancelled_active_operation",
    };
  }

  if (args.operationState.readiness === "ready" && isSubmit(args.message)) {
    return {
      mode: "active_operation",
      intent: "submit",
      reason: "user_submitted_ready_operation",
    };
  }

  if (
    args.operationState.operation === "mail_followup" ||
    args.operationState.operation === "generic_mail"
  ) {
    return {
      mode: "active_operation",
      intent: "complete",
      reason: "mail_operation_waiting_for_confirmation_or_missing_slot",
    };
  }

  if (
    args.operationState.operation === "event_create" &&
    args.operationState.phase === "collect_notes" &&
    typeof parseOptionalNotesAnswer(args.message) !== "undefined"
  ) {
    return {
      mode: "active_operation",
      intent: "complete",
      reason: "notes_answer_for_active_operation",
    };
  }

  if (
    args.operationState.operation === "event_create" &&
    (args.operationState.phase === "collect_title" ||
      args.operationState.phase === "collect_time" ||
      args.operationState.phase === "collect_type")
  ) {
    return {
      mode: "active_operation",
      intent: "complete",
      reason: "active_operation_waiting_for_required_slot",
    };
  }

  if (
    args.operationState.operation === "anagrafiche_create" &&
    (args.operationState.phase === "collect_type" ||
      args.operationState.phase === "collect_data" ||
      args.operationState.phase === "confirm_write")
  ) {
    return {
      mode: "active_operation",
      intent: "complete",
      reason: "anagrafiche_create_waiting_for_next_slot_or_confirmation",
    };
  }

  return {
    mode: "active_operation",
    intent: "unknown_but_bound",
    reason: "active_operation_should_override_generic_guardrails",
  };
}
