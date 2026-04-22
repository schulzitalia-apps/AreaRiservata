import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.runtime.config";
import type { AnimaLlmTraceStep } from "@/server-utils/anima/core/types";

type CatalogCandidate = {
  id: string;
  label: string;
  aliases?: string[];
};

type CatalogResolution = {
  id: string | null;
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

function normalizeWhy(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item: unknown) => String(item)).filter(Boolean).slice(0, 5)
    : [];
}

function normalizeConfidence(value: unknown): number {
  const confidenceNumber = Number(value);
  return Number.isFinite(confidenceNumber)
    ? Math.max(0, Math.min(1, confidenceNumber))
    : 0.25;
}

export async function resolveCatalogChoiceWithLlm(args: {
  message: string;
  entityName: string;
  candidates: CatalogCandidate[];
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<CatalogResolution | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled || !args.candidates.length) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.catalogResolver.buildSystemPrompt();
  const payload = {
    entityName: args.entityName,
    message: args.message,
    candidates: args.candidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      aliases: candidate.aliases ?? [],
    })),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.catalogResolver.temperature,
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
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    const choiceId =
      typeof parsed?.choiceId === "string" && parsed.choiceId.trim()
        ? parsed.choiceId.trim()
        : null;
    const resolution = {
      id:
        choiceId && args.candidates.some((candidate) => candidate.id === choiceId)
          ? choiceId
          : null,
      confidence: normalizeConfidence(parsed?.confidence),
      why: normalizeWhy(parsed?.why),
    };

    args.traceCollector?.({
      id: `catalog-resolver-${Date.now()}`,
      step: "catalogResolver",
      title: "Catalog Resolver",
      reason:
        "Risolvere una scelta tra slug/label di catalogo usando mediazione LLM strong.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: resolution,
      status: "success",
      error: null,
    });

    return resolution;
  } catch (error: any) {
    args.traceCollector?.({
      id: `catalog-resolver-${Date.now()}`,
      step: "catalogResolver",
      title: "Catalog Resolver",
      reason:
        "Risolvere una scelta tra slug/label di catalogo usando mediazione LLM strong.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "CATALOG_RESOLVER_FAILED"),
    });
    return null;
  }
}
