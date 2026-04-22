import type { AnimaChannel, AnimaSessionInput } from "./types";

export type AnimaNodeId =
  | "input.normalize"
  | "memory.load"
  | "intent.extract"
  | "plan.update"
  | "execution.decide"
  | "guardrails.compose"
  | "response.compose"
  | "memory.commit";

export type AnimaOperationKind =
  | "event_create"
  | "event_update"
  | "event_move"
  | "event_delete"
  | "event_list"
  | "reply_only";

export type AnimaPlanPhase =
  | "collect_type"
  | "collect_time"
  | "collect_title"
  | "collect_notes"
  | "review"
  | "ready";

export type AnimaPlanReadiness =
  | "collecting"
  | "ready"
  | "blocked"
  | "executed";

export type AnimaOperationalData = {
  eventTypeSlug?: string | null;
  eventTypeLabel?: string | null;
  title?: string | null;
  notes?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timeKind?: string | null;
  targetEventId?: string | null;
  listFilters?: Record<string, unknown> | null;
};

export type AnimaActionPlan = {
  operation: AnimaOperationKind;
  phase: AnimaPlanPhase;
  readiness: AnimaPlanReadiness;
  data: AnimaOperationalData;
  missing: string[];
  why: string[];
  sourceTurns: string[];
  updatedAt: string;
};

export type AnimaOperationalMemory = {
  activePlan: AnimaActionPlan | null;
  lastExecutedPlan: AnimaActionPlan | null;
};

export type AnimaConversationMemory = {
  summary: string | null;
  lastReplyStyle?: "plain" | "family" | "brief" | null;
  lastChannelLimit?: string | null;
};

export type AnimaMemoryBundle = {
  operational: AnimaOperationalMemory;
  conversation: AnimaConversationMemory;
};

export type AnimaIntentDelta = {
  inferredOperation?: AnimaOperationKind | null;
  extractedData?: Partial<AnimaOperationalData>;
  missingHints?: string[];
  confidence: number;
  why: string[];
};

export type AnimaExecutionDecision =
  | {
      kind: "execute";
      capability:
        | "eventi.create"
        | "eventi.update"
        | "eventi.move"
        | "eventi.delete"
        | "eventi.list";
      plan: AnimaActionPlan;
    }
  | {
      kind: "clarify";
      plan: AnimaActionPlan;
      questionKey:
        | "event_type"
        | "event_time"
        | "event_title"
        | "event_notes"
        | "confirmation";
    }
  | {
      kind: "reply_only";
      reason:
        | "not_understood"
        | "guardrail"
        | "capability_help"
        | "channel_limit";
    };

export type AnimaGuardrailState = {
  lowValue: boolean;
  unsupportedChannelAction: boolean;
  shouldShortCircuit: boolean;
  reasons: string[];
};

export type AnimaResponseBlueprint = {
  style: "plain" | "family" | "brief";
  promptRole:
    | "confirm_execution"
    | "ask_missing_data"
    | "explain_guardrail"
    | "fallback_help";
  userVisibleData: Record<string, unknown>;
};

export type AnimaRuntimeFrame = {
  input: {
    raw: AnimaSessionInput;
    normalizedText: string;
    channel: AnimaChannel;
    turnId: string;
  };
  memory: AnimaMemoryBundle;
  intentDelta: AnimaIntentDelta | null;
  actionPlan: AnimaActionPlan | null;
  guardrails: AnimaGuardrailState;
  decision: AnimaExecutionDecision | null;
  response: AnimaResponseBlueprint | null;
};

export const ANIMA_RUNTIME_NODE_SEQUENCE: readonly AnimaNodeId[] = [
  "input.normalize",
  "memory.load",
  "intent.extract",
  "plan.update",
  "execution.decide",
  "guardrails.compose",
  "response.compose",
  "memory.commit",
] as const;

export const ANIMA_RUNTIME_PRINCIPLES = [
  "Il piano d'azione e la memoria operativa sono la source of truth del task corrente.",
  "I parser del singolo turno propongono solo delta, non decidono da soli l'esecuzione.",
  "L'azionatore riceve un piano gia consolidato e decide solo execute o clarify.",
  "I guardrail leggono il piano e le memorie, non solo il testo del turno corrente.",
  "Il conversatore non inventa stato: rende visibile il risultato del piano e della decisione.",
] as const;

export function buildEmptyOperationalMemory(): AnimaOperationalMemory {
  return {
    activePlan: null,
    lastExecutedPlan: null,
  };
}

export function canExecuteActionPlan(plan: AnimaActionPlan | null): boolean {
  return !!plan && plan.readiness === "ready" && plan.missing.length === 0;
}

export const ANIMA_RUNTIME_BLUEPRINT = {
  sequence: ANIMA_RUNTIME_NODE_SEQUENCE,
  principles: ANIMA_RUNTIME_PRINCIPLES,
} as const;
