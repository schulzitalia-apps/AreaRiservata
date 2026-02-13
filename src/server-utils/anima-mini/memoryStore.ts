import type { MemoryStore } from "./types";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export function createMongoStore(): MemoryStore {
  return {
    async loadSummary(userId: string) {
      if (!userId) return "";

      await connectToDatabase();
      const doc = await AnimaMemoryModel.findById(userId).lean();
      return String(doc?.summary ?? "");
    },

    async saveSummary(userId: string, summary: string) {
      if (!userId) return;

      await connectToDatabase();
      const clean = String(summary ?? "").trim();

      await AnimaMemoryModel.updateOne(
        { _id: userId },
        { $set: { summary: clean } },
        { upsert: true }
      );
    },
  };
}
