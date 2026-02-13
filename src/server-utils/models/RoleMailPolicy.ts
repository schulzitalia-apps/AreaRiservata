// src/server-utils/models/RoleMailPolicy.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { AppRole } from "@/types/roles";

export interface IRoleMailPolicy {
  role: AppRole;
  canSend: boolean;
  senderIdentityId?: Types.ObjectId | string; // default FROM per quel ruolo
}

export interface IRoleMailPolicyDocument extends IRoleMailPolicy, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roleMailPolicySchema = new Schema<IRoleMailPolicyDocument>(
  {
    role: { type: String, required: true, unique: true },
    canSend: { type: Boolean, default: false },
    senderIdentityId: { type: Schema.Types.ObjectId, ref: "EmailIdentity" },
  },
  { timestamps: true }
);

const RoleMailPolicy: Model<IRoleMailPolicyDocument> =
  (mongoose.models.RoleMailPolicy as Model<IRoleMailPolicyDocument>) ||
  mongoose.model<IRoleMailPolicyDocument>("RoleMailPolicy", roleMailPolicySchema);

export default RoleMailPolicy;
