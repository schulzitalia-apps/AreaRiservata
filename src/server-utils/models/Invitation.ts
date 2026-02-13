// src/server-utils/models/Invitation.ts


//Da gestire prima di mandarla online

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInvitation {
  userId: Types.ObjectId;
  tokenHash: string;        // sha256(token) (select: false)
  expiresAt: Date;
  usedAt?: Date;
  createdBy?: Types.ObjectId;
}

export interface IInvitationDocument extends IInvitation, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, select: false, index: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// opzionale: TTL (cancella automaticamente inviti scaduti)
// NB: MongoDB TTL usa solo un campo Date e cancella dopo la scadenza.
// Qui usiamo expiresAt: quando passa, Mongo può eliminarlo.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const InvitationModel: Model<IInvitationDocument> =
  (mongoose.models.Invitation as Model<IInvitationDocument>) ||
  mongoose.model<IInvitationDocument>("Invitation", invitationSchema);

export default InvitationModel;
