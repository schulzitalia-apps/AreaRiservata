import { createMongoStore } from "./memoryStore";
import { createGroqProvider } from "./groqClient";
import { buildBasicNodes, parseSummaryFromModelOutput } from "./nodes";
import { runNodes } from "./runner";

const memory = createMongoStore();

const models = {
  fast: { provider: "groq" as const, model: "llama-3.1-8b-instant", temperature: 0.2 },
};

export async function chatOnce(args: {
  userId: string;
  userMessage: string;
  groqApiKey: string;
  language?: "it" | "en";
}) {
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

  const llm = createGroqProvider(args.groqApiKey);
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
