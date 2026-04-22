import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.runtime.config";
import type { AnimaLlmTraceStep } from "@/server-utils/anima/core/types";

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

function clipText(value: string, maxChars: number): string {
  return value.length <= maxChars
    ? value
    : `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function buildOperationSnapshotSummary(
  operationSnapshot: Record<string, unknown> | null | undefined,
): string | null {
  if (!operationSnapshot) return null;

  const operation =
    typeof operationSnapshot.operation === "string"
      ? operationSnapshot.operation
      : null;
  const phase =
    typeof operationSnapshot.phase === "string"
      ? operationSnapshot.phase
      : null;
  const missing = Array.isArray(operationSnapshot.missing)
    ? operationSnapshot.missing.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const data =
    operationSnapshot.data && typeof operationSnapshot.data === "object"
      ? (operationSnapshot.data as Record<string, unknown>)
      : null;

  if (operation === "event_create") {
    const knownBits = [
      typeof data?.eventTypeLabel === "string" && data.eventTypeLabel.trim()
        ? `tipo ${data.eventTypeLabel.trim()}`
        : null,
      typeof data?.title === "string" && data.title.trim()
        ? `titolo "${data.title.trim()}"`
        : null,
      typeof data?.startAt === "string" && data.startAt.trim()
        ? `quando ${data.startAt.trim()}`
        : null,
    ].filter(Boolean);

    const missingText =
      missing.length > 0 ? ` Mancano: ${missing.join(", ")}.` : "";
    return `Operazione aperta: creazione evento.${knownBits.length > 0 ? ` Raccolto: ${knownBits.join(", ")}.` : ""}${missingText}`;
  }

  if (operation === "generic_mail") {
    const knownBits = [
      typeof data?.to === "string" && data.to.trim()
        ? `destinatario ${data.to.trim()}`
        : null,
      typeof data?.subject === "string" && data.subject.trim()
        ? `oggetto "${data.subject.trim()}"`
        : null,
    ].filter(Boolean);
    const missingText =
      missing.length > 0 ? ` Mancano: ${missing.join(", ")}.` : "";
    return `Operazione aperta: mail generica.${knownBits.length > 0 ? ` Raccolto: ${knownBits.join(", ")}.` : ""}${missingText}`;
  }

  if (operation === "mail_followup") {
    return `Operazione aperta: follow-up mail${phase ? ` in fase ${phase}` : ""}.`;
  }

  return operation
    ? `Operazione attiva: ${operation}${phase ? ` (${phase})` : ""}.`
    : null;
}

function buildDeterministicSummary(args: {
  previousSummary?: string | null;
  userMessage: string;
  assistantReply: string;
  operationSnapshot?: Record<string, unknown> | null;
}): string | null {
  const parts = [
    buildOperationSnapshotSummary(args.operationSnapshot),
    args.previousSummary?.trim()
      ? `Memoria precedente: ${args.previousSummary.trim()}`
      : null,
    args.userMessage.trim()
      ? `Ultima richiesta: ${args.userMessage.trim()}`
      : null,
    args.assistantReply.trim()
      ? `Ultima risposta: ${args.assistantReply.trim()}`
      : null,
  ].filter(Boolean) as string[];

  if (parts.length === 0) return null;

  return clipText(
    parts.join(" "),
    ANIMA_PROMPTS_CONFIG.nodes.shortTermMemorySummarizer.maxSummaryChars,
  );
}

function sanitizeModelSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const summary = value.trim();
  if (!summary) return null;
  if (summary.startsWith("{") || summary.includes('"previousSummary"')) {
    return null;
  }

  return clipText(
    summary,
    ANIMA_PROMPTS_CONFIG.nodes.shortTermMemorySummarizer.maxSummaryChars,
  );
}

export async function updateShortTermMemorySummary(args: {
  previousSummary?: string | null;
  userMessage: string;
  assistantReply: string;
  operationSnapshot?: Record<string, unknown> | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  const fallbackSummary = buildDeterministicSummary(args);

  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return fallbackSummary;
  }

  const modelConfig =
    ANIMA_RUNTIME_CONFIG.targetRuntime.models.shortTermMemorySummarizer;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return fallbackSummary;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.shortTermMemorySummarizer.buildSystemPrompt();

  const payload = {
    previousSummary: args.previousSummary ?? "",
    userMessage: args.userMessage,
    assistantReply: args.assistantReply,
    operationSnapshot: args.operationSnapshot ?? null,
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature:
        ANIMA_PROMPTS_CONFIG.nodes.shortTermMemorySummarizer.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) {
      args.traceCollector?.({
        id: `memory-short-${Date.now()}`,
        step: "shortTermMemorySummarizer",
        title: "Short-term Memory Summarizer",
        reason: "Aggiornare la memoria breve della sessione dopo il turno.",
        provider: completion.provider,
        model: completion.model,
        usage: completion.usage,
        purpose: modelConfig.purpose,
        systemPrompt,
        input: payload,
        rawResponse: raw,
        parsedResponse: {
          summary: fallbackSummary,
          source: "deterministic_fallback:no_json",
        },
        status: fallbackSummary ? "success" : "failed",
        error: fallbackSummary ? null : "SHORT_MEMORY_SUMMARIZER_NO_JSON",
      });
      return fallbackSummary;
    }
    const parsed = JSON.parse(jsonStr);
    const summary = sanitizeModelSummary(parsed?.summary) ?? fallbackSummary;
    args.traceCollector?.({
      id: `memory-short-${Date.now()}`,
      step: "shortTermMemorySummarizer",
      title: "Short-term Memory Summarizer",
      reason: "Aggiornare la memoria breve della sessione dopo il turno.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: {
        summary,
        source: sanitizeModelSummary(parsed?.summary)
          ? "llm"
          : "deterministic_fallback",
      },
      status: "success",
      error: null,
    });
    return summary;
  } catch (error: any) {
    args.traceCollector?.({
      id: `memory-short-${Date.now()}`,
      step: "shortTermMemorySummarizer",
      title: "Short-term Memory Summarizer",
      reason: "Aggiornare la memoria breve della sessione dopo il turno.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      parsedResponse: {
        summary: fallbackSummary,
        source: "deterministic_fallback",
      },
      status: fallbackSummary ? "success" : "failed",
      error: fallbackSummary
        ? null
        : String(error?.message ?? "SHORT_MEMORY_SUMMARIZER_FAILED"),
    });
    return fallbackSummary;
  }
}
