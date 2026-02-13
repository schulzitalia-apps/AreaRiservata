import mongoose, { Schema } from "mongoose";

export type AnimaMemoryDoc = {
  _id: string;      // userId (es. "whatsapp:+39...")
  summary: string;  // memoria sintetica
  createdAt?: Date;
  updatedAt?: Date;
};

const AnimaMemorySchema = new Schema<AnimaMemoryDoc>(
  {
    _id: { type: String, required: true },
    summary: { type: String, default: "" },
  },
  { timestamps: true }
);

export const AnimaMemoryModel =
  (mongoose.models.AnimaMemory as mongoose.Model<AnimaMemoryDoc>) ||
  mongoose.model<AnimaMemoryDoc>("AnimaMemory", AnimaMemorySchema);
