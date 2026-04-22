import { createMongoStore } from "./memoryStore";
import { buildBasicNodes, parseSummaryFromModelOutput } from "./nodes";
import { runNodes } from "./runner";
import {
  createRuntimeChatProvider,
  resolveRuntimeChatSelection,
} from "@/server-utils/llm";

const memory = createMongoStore();

export async function chatOnce(args: {
  userId: string;
  userMessage: string;
  language?: "it" | "en";
}) {
  const selection = resolveRuntimeChatSelection();
  const models = {
    fast: {
      provider: selection.provider,
      model: selection.model,
      temperature: 0.2,
    },
  };

  const prevSummary = await memory.loadSummary(args.userId);

  const ctx = {
    input: {
      userId: args.userId,
      userMessage: args.userMessage,
      language: args.language ?? "it",
    },
    memory: { summary: prevSummary },
    outputs: {},
  };

  const llm = createRuntimeChatProvider(selection.provider);
  const { assistantNode, summarizeNode } = buildBasicNodes();

  const { ctx: outCtx, events } = await runNodes({
    ctx,
    nodes: [assistantNode, summarizeNode],
    models,
    llm,
  });

  const reply = String(outCtx.outputs.reply ?? "");
  const raw = String(outCtx.outputs.newSummaryRaw ?? "");
  const newSummary = parseSummaryFromModelOutput(raw);

  if (newSummary) {
    await memory.saveSummary(args.userId, newSummary);
  }

  return { reply, events, prevSummary, newSummary: newSummary ?? prevSummary };
}
