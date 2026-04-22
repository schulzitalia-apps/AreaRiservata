import { ANIMA_COMPONENT_CONFIG } from "./anima.config";
import type { AnimaContext, AnimaReply, AnimaRunResult } from "./types";

export function buildAnimaReply(text: string): AnimaReply {
  return {
    text: String(text ?? "").trim(),
  };
}

export function buildAnimaRunResult(args: {
  context: AnimaContext;
  text: string;
  strategy?: AnimaRunResult["meta"]["strategy"];
  usedCapabilities?: AnimaRunResult["meta"]["usedCapabilities"];
  debug?: Record<string, any>;
}): AnimaRunResult {
  const runtimeLlm = {
    provider: ANIMA_COMPONENT_CONFIG.llm.provider,
    chatModel:
      ANIMA_COMPONENT_CONFIG.llm.provider === "glm"
        ? ANIMA_COMPONENT_CONFIG.llm.providers.glm.model
        : ANIMA_COMPONENT_CONFIG.llm.providers.groq.model,
    llmActivatedSteps: ANIMA_COMPONENT_CONFIG.execution.llmActivatedSteps,
  };

  return {
    ok: true,
    reply: buildAnimaReply(args.text),
    context: args.context,
    meta: {
      strategy: args.strategy ?? "fallback_chat",
      usedCapabilities: args.usedCapabilities ?? ["conversation.reply"],
      debug: {
        runtimeLlm,
        ...(args.debug ?? {}),
      },
    },
  };
}
