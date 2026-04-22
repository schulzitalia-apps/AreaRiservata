import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.runtime.config";
import type { AnimaLlmTraceStep, AnimaRecentTurn } from "@/server-utils/anima/core/types";
import type { SprintTimelineReadResult } from "./sprintTimeline.types";

export async function composeSprintTimelinePriorityAdvice(args: {
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  userMessage: string;
  rankedTasks: SprintTimelineReadResult;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<string | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer;
  if (!modelConfig.model) {
    return null;
  }

  const systemPrompt = ANIMA_PROMPTS_CONFIG.nodes.taskAdvisor.buildSystemPrompt();
  const payload = {
    userDisplayName: args.userDisplayName ?? null,
    conversationSummary: args.conversationSummary ?? "",
    recentTurns: args.recentTurns ?? [],
    userMessage: args.userMessage,
    rankedTasks: args.rankedTasks.items.slice(0, 8),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.taskAdvisor.temperature,
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
      id: `task-advisor-${Date.now()}`,
      step: "taskAdvisor",
      title: "Sprint Timeline Task Advisor",
      reason: "Consigliare il task da attaccare per primo analizzando stato, priorita, descrizioni e scadenze.",
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
      id: `task-advisor-${Date.now()}`,
      step: "taskAdvisor",
      title: "Sprint Timeline Task Advisor",
      reason: "Consigliare il task da attaccare per primo analizzando stato, priorita, descrizioni e scadenze.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "TASK_ADVISOR_FAILED"),
    });
    return null;
  }
}
