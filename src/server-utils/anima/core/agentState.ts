import type { AnimaContext, AnimaLlmTraceStep, AnimaRunResult } from "./types";
import type { SenseInterpretation } from "../nodes/senseInterpreter";
import type { EmotionalGuardrailResult } from "../nodes/emotionalGuardrail";
import type { AnyOperationContextFillResult } from "../nodes/operationContextFiller";
import type { OperationRouterDecision } from "../nodes/operationRouter";
import type { OperationSwitchDecision } from "../nodes/operationSwitcher";
import type { PendingOperationState } from "../memory/sessionState";
import type { AnimaConversationState } from "../memory/conversationState";
import type { ContactState } from "../memory/contactState";
import type { AuthContext } from "@/server-utils/lib/auth-context";

export type AnimaAgentState = {
  isTerminal: boolean; // Tells the loop to stop
  finalResult: AnimaRunResult | null; // Will store the final AnimaRunResult

  // Core Inputs
  context: AnimaContext;
  originalMessage: string;
  authContext: AuthContext | null;
  resolverMode: "includes" | "catalog_tokens";

  // Tracked State
  conversationState: AnimaConversationState;
  operationState: PendingOperationState | null;
  contactState: ContactState | null;
  conversationSummary: string | null;
  operationSwitchDecision: OperationSwitchDecision | null;
  operationArbitration: {
    action: "keep" | "drop_active";
    reason: string;
    fromOperation: PendingOperationState["operation"] | null;
    toCapability: string | null;
  } | null;

  // Pipeline Variables
  interpretedMessage: string;
  senseInterpretation: SenseInterpretation | null;
  emotionalGuardrail: EmotionalGuardrailResult | null;
  operationContextFill: AnyOperationContextFillResult | null;
  operationRouting: OperationRouterDecision | null;
  operationExecution: Record<string, any> | null;

  // Debug & Tracing
  llmTrace: AnimaLlmTraceStep[];
};
