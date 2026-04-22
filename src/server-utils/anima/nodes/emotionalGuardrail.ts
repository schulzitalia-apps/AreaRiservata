import { createRuntimeChatProvider } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.runtime.config";
import type {
  AnimaLlmTraceStep,
  AnimaRecentTurn,
} from "@/server-utils/anima/core/types";
import type { SenseInterpretation } from "@/server-utils/anima/nodes/senseInterpreter";
import { buildRegistryAwareness } from "@/server-utils/anima/core/registryAwareness";

export type EmotionalGuardrailResult = {
  guardrailColor: "orange" | "red";
  responseMode: "functional" | "extended";
  confidence: number;
  why: string[];
};

function extractFirstJsonObject(text: string): string | null {
  const s = text.trim();
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function normalizeConfidence(value: unknown): number {
  const confidenceNumber = Number(value);
  return Number.isFinite(confidenceNumber)
    ? Math.max(0, Math.min(1, confidenceNumber))
    : 0.25;
}

function normalizeWhy(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item: unknown) => String(item)).filter(Boolean).slice(0, 5)
    : [];
}

function normalizeResult(raw: any): EmotionalGuardrailResult {
  return {
    guardrailColor: raw?.guardrailColor === "orange" ? "orange" : "red",
    responseMode: raw?.responseMode === "extended" ? "extended" : "functional",
    confidence: normalizeConfidence(raw?.confidence),
    why: normalizeWhy(raw?.why),
  };
}

export async function runEmotionalGuardrail(args: {
  message: string;
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  senseInterpretation?: SenseInterpretation | null;
  activeOperation?: {
    operation: string;
    phase?: string | null;
    readiness?: string | null;
    missing?: string[];
  } | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<EmotionalGuardrailResult | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.emotionalEvaluator;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const llm = createRuntimeChatProvider(modelConfig.provider);
  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.emotionalEvaluator.buildSystemPrompt();

  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    userMessage: args.message,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    senseInterpretation: args.senseInterpretation ?? null,
    activeOperation: args.activeOperation ?? null,
    registryAwareness: buildRegistryAwareness(),
  };

  try {
    const completion = await llm.chat({
      model: modelConfig.model,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.emotionalEvaluator.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    });
    const raw = completion.content;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    const normalized = normalizeResult(parsed);
    args.traceCollector?.({
      id: `emotional-guardrail-${Date.now()}`,
      step: "emotionalEvaluator",
      title: "Emotional Guardrail",
      reason:
        "Distinguere i casi arancioni dai veri fallback rossi quando il turno resta ambiguo.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: completion.usage ?? null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: normalized,
      status: "success",
      error: null,
    });
    return normalized;
  } catch (error: any) {
    args.traceCollector?.({
      id: `emotional-guardrail-${Date.now()}`,
      step: "emotionalEvaluator",
      title: "Emotional Guardrail",
      reason:
        "Distinguere i casi arancioni dai veri fallback rossi quando il turno resta ambiguo.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "EMOTIONAL_GUARDRAIL_FAILED"),
    });
    return null;
  }
}
