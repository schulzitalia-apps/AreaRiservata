import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.runtime.config";
import type {
  AnimaLlmTraceStep,
  AnimaRecentTurn,
} from "@/server-utils/anima/core/types";
import {
  buildRegistryAwareness,
  buildScopedRegistryAwareness,
  type AnimaRegistryAwareness,
  type AnimaRegistryScope,
} from "@/server-utils/anima/core/registryAwareness";

function inferRegistryScope(operationOrStrategy?: string | null): AnimaRegistryScope {
  const normalized = String(operationOrStrategy ?? "").toLowerCase();
  if (normalized.includes("anagrafiche")) return "anagrafiche";
  if (normalized.includes("sprint_timeline")) return "sprint_timeline";
  if (
    normalized.includes("event") ||
    normalized.includes("mail") ||
    normalized.includes("reminder")
  ) {
    return "eventi";
  }
  return "all";
}

function getScopedRecentTurns(
  recentTurns: AnimaRecentTurn[] | undefined,
  operationOrStrategy?: string | null,
) {
  const turns = recentTurns ?? [];
  if (!operationOrStrategy) {
    return turns.slice(-2);
  }
  return turns.slice(-2);
}

export async function composeOrangeContextReply(args: {
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  message: string;
  capabilities: string[];
  registryAwareness?: AnimaRegistryAwareness | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.responseComposer.orangeGuardrail.buildSystemPrompt();

  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: getScopedRecentTurns(args.recentTurns),
    conversationSummary: args.conversationSummary ?? "",
    userMessage: args.message,
    capabilities: args.capabilities,
    registryAwareness: args.registryAwareness ?? buildRegistryAwareness(),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.responseComposer.orangeGuardrail.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const text = String(raw ?? "").trim();
    args.traceCollector?.({
      id: `orange-${Date.now()}`,
      step: "responseComposer.orangeGuardrail",
      title: "Orange Response Composer",
      reason:
        "Costruire una risposta naturale quando il contesto è rilevante ma ancora vago.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: { text },
      status: "success",
      error: null,
    });
    return text || null;
  } catch (error: any) {
    args.traceCollector?.({
      id: `orange-${Date.now()}`,
      step: "responseComposer.orangeGuardrail",
      title: "Orange Response Composer",
      reason:
        "Costruire una risposta naturale quando il contesto è rilevante ma ancora vago.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "ORANGE_RESPONSE_COMPOSER_FAILED"),
    });
    return null;
  }
}

export async function composeWelcomeReply(args: {
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  capabilities: string[];
  examples: string[];
  registryAwareness?: AnimaRegistryAwareness | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.responseComposer.welcome.buildSystemPrompt();

  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: getScopedRecentTurns(args.recentTurns),
    conversationSummary: args.conversationSummary ?? "",
    capabilities: args.capabilities,
    examples: args.examples,
    registryAwareness: args.registryAwareness ?? buildRegistryAwareness(),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.responseComposer.welcome.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const text = String(raw ?? "").trim();
    args.traceCollector?.({
      id: `welcome-${Date.now()}`,
      step: "responseComposer.welcome",
      title: "Welcome Response Composer",
      reason:
        "Aprire la sessione con un saluto naturale e capability-aware, non puramente templated.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: { text },
      status: "success",
      error: null,
    });
    return text || null;
  } catch (error: any) {
    args.traceCollector?.({
      id: `welcome-${Date.now()}`,
      step: "responseComposer.welcome",
      title: "Welcome Response Composer",
      reason:
        "Aprire la sessione con un saluto naturale e capability-aware, non puramente templated.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "WELCOME_RESPONSE_COMPOSER_FAILED"),
    });
    return null;
  }
}

export async function composeOperationClarificationReply(args: {
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  message: string;
  operation: string;
  phase?: string | null;
  missing: string[];
  nextField?: string | null;
  pendingData?: Record<string, unknown> | null;
  extractedThisTurn?: Record<string, unknown> | null;
  registryAwareness?: AnimaRegistryAwareness | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.responseComposer.operationClarification.buildSystemPrompt();

  const registryScope = inferRegistryScope(args.operation);
  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: getScopedRecentTurns(args.recentTurns, args.operation),
    conversationSummary: "",
    userMessage: args.message,
    operation: args.operation,
    phase: args.phase ?? null,
    missing: args.missing,
    nextField: args.nextField ?? null,
    pendingData: args.pendingData ?? null,
    extractedThisTurn: args.extractedThisTurn ?? null,
    registryAwareness:
      args.registryAwareness ?? buildScopedRegistryAwareness(registryScope),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.responseComposer.operationClarification
          .temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const text = String(raw ?? "").trim();
    args.traceCollector?.({
      id: `operation-clarification-${Date.now()}`,
      step: "responseComposer.operationClarification",
      title: "Operation Clarification Composer",
      reason:
        "Formulare la prossima domanda operativa in modo naturale partendo dal JSON parziale.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: { text },
      status: "success",
      error: null,
    });
    return text || null;
  } catch (error: any) {
    args.traceCollector?.({
      id: `operation-clarification-${Date.now()}`,
      step: "responseComposer.operationClarification",
      title: "Operation Clarification Composer",
      reason:
        "Formulare la prossima domanda operativa in modo naturale partendo dal JSON parziale.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(
        error?.message ?? "OPERATION_CLARIFICATION_COMPOSER_FAILED",
      ),
    });
    return null;
  }
}

export async function composeFinalResponse(args: {
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  message: string;
  operationResult: Record<string, any>;
  memorySupport?: Record<string, unknown> | null;
  responseGuidance?: Record<string, unknown> | null;
  registryAwareness?: AnimaRegistryAwareness | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.responseComposer.finalResponse.buildSystemPrompt();

  const operationName =
    typeof args.responseGuidance?.operation === "string"
      ? args.responseGuidance.operation
      : typeof args.operationResult?.strategy === "string"
        ? args.operationResult.strategy
        : null;
  const registryScope = inferRegistryScope(operationName);
  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: getScopedRecentTurns(args.recentTurns, operationName),
    conversationSummary: operationName ? "" : args.conversationSummary ?? "",
    userMessage: args.message,
    operationResult: args.operationResult,
    memorySupport: args.memorySupport ?? null,
    responseGuidance: args.responseGuidance ?? null,
    registryAwareness:
      args.registryAwareness ?? buildScopedRegistryAwareness(registryScope),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.responseComposer.finalResponse.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const text = String(raw ?? "").trim();
    args.traceCollector?.({
      id: `final-response-${Date.now()}`,
      step: "responseComposer.finalResponse",
      title: "Final Response Composer",
      reason:
        "Formulare la risposta finale all'utente inglobando dinamicamente il risultato delle operazioni chiuse/fallite.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: { text },
      status: "success",
      error: null,
    });
    return text || null;
  } catch (error: any) {
    args.traceCollector?.({
      id: `final-response-${Date.now()}`,
      step: "responseComposer.finalResponse",
      title: "Final Response Composer",
      reason:
        "Formulare la risposta finale all'utente inglobando dinamicamente il risultato delle operazioni chiuse/fallite.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "FINAL_RESPONSE_COMPOSER_FAILED"),
    });
    return null;
  }
}
