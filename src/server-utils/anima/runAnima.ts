// runAnima.ts
// Entry point pubblico del runtime Anima.
// Inizializza l'AnimaAgentState e delega l'intera esecuzione all'Agent Loop.
// NON contiene logica applicativa - tutta la logica si trova in:
//   core/agentLoop.ts    - pipeline state-machine
//   features/ executors  - domain executors (eventi, mail, conversation)
//   core/stateHelpers.ts - shared utilities

import type { AnimaRunResult, AnimaSessionInput } from "./core/types";
import { buildAnimaContext } from "./core/context";
import { ANIMA_COMPONENT_CONFIG } from "./core/anima.config";
import { loadConversationState } from "./memory/conversationState";
import { loadContactState } from "./memory/contactState";
import { loadPendingOperationState } from "./memory/sessionState";
import { loadConversationSummary } from "./memory/summaryState";
import { runAnimaLoop } from "./core/agentLoop";
import type { AnimaAgentState } from "./core/agentState";

export async function runAnima(args: {
  input: AnimaSessionInput;
}): Promise<AnimaRunResult> {
  const context = buildAnimaContext(args.input);

  // ── Carica lo stato persistito dalla sessione corrente ──────────────────
  const [conversationState, operationState, contactState, conversationSummary] = await Promise.all([
    loadConversationState(context.session.sessionId),
    loadPendingOperationState(context.session.sessionId),
    loadContactState(context.session.sessionId),
    loadConversationSummary(context.session.sessionId),
  ]);

  // ── Risolve l'auth context dal contesto di rete ─────────────────────────
  const authContext =
    context.auth?.role && typeof context.auth.isAdmin === "boolean"
      ? {
          userId: context.user.userId,
          role: context.auth.role as any,
          isAdmin: context.auth.isAdmin,
          keyScopes: context.auth.keyScopes,
        }
      : null;

  // ── Risolve la modalità di risoluzione degli event type ─────────────────
  const resolverMode =
    context.debugOptions?.eventTypeResolver ??
    ANIMA_COMPONENT_CONFIG.models.router.defaultEventTypeResolver;

  // ── Costruisce lo stato iniziale dell'agente ─────────────────────────────
  const initialState: AnimaAgentState = {
    isTerminal: false,
    finalResult: null,

    context,
    originalMessage: context.input.message,
    authContext,
    resolverMode,

    conversationState,
    operationState,
    contactState,
    conversationSummary,
    operationSwitchDecision: null,
    operationArbitration: null,

    interpretedMessage: context.input.message,
    senseInterpretation: null,
    emotionalGuardrail: null,
    operationContextFill: null,
    operationRouting: null,
    operationExecution: null,

    llmTrace: [],
  };

  // ── Esegue il loop agente e ritorna il risultato finale ──────────────────
  const finalState = await runAnimaLoop(initialState);

  if (!finalState.finalResult) {
    throw new Error("[Anima] Agent loop terminato senza produrre un risultato.");
  }

  return finalState.finalResult;
}
