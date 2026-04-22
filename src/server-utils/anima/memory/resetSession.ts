import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export async function resetAnimaSessionMemory(
  sessionId: string | null | undefined,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.deleteOne({ _id: sessionId });
}
