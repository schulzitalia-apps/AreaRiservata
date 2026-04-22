import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export type AnimaConversationState = {
  hasWelcomed: boolean;
  stage: "new" | "active";
  updatedAt: string;
};

export async function loadConversationState(
  sessionId: string,
): Promise<AnimaConversationState> {
  if (!sessionId) {
    return {
      hasWelcomed: false,
      stage: "new",
      updatedAt: new Date().toISOString(),
    };
  }

  await connectToDatabase();
  const doc = await AnimaMemoryModel.findById(sessionId).lean();
  const state = doc?.conversationState;

  return {
    hasWelcomed: !!state?.hasWelcomed,
    stage: state?.stage === "active" ? "active" : "new",
    updatedAt: state?.updatedAt
      ? new Date(state.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function saveConversationState(
  sessionId: string,
  state: AnimaConversationState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        conversationState: {
          hasWelcomed: state.hasWelcomed,
          stage: state.stage,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}
