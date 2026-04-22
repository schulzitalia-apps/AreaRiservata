import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export async function loadConversationSummary(
  sessionId: string,
): Promise<string> {
  if (!sessionId) return "";

  await connectToDatabase();
  const doc = await AnimaMemoryModel.findById(sessionId).lean();
  return typeof doc?.summary === "string" ? doc.summary.trim() : "";
}

export async function saveConversationSummary(
  sessionId: string,
  summary: string,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        summary: String(summary ?? "").trim(),
      },
    },
    { upsert: true },
  );
}
