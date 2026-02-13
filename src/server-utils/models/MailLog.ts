// src/server-utils/models/MailLog.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MailLogStatus = "queued" | "sent" | "failed";

export interface IMailLog {
  createdBy?: Types.ObjectId | string; // utente che ha causato l'invio
  to: string[];
  fromEmail: string;
  fromName: string;
  subject: string;
  templateKey?: string;
  provider: "resend";
  providerMessageId?: string;
  status: MailLogStatus;
  errorMessage?: string;
  meta?: Record<string, any>;
}

export interface IMailLogDocument extends IMailLog, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mailLogSchema = new Schema<IMailLogDocument>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    to: [{ type: String, required: true }],
    fromEmail: { type: String, required: true },
    fromName: { type: String, required: true },
    subject: { type: String, required: true },
    templateKey: { type: String },
    provider: { type: String, default: "resend" },
    providerMessageId: { type: String },
    status: { type: String, required: true },
    errorMessage: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

mailLogSchema.index({ createdAt: -1 });

const MailLogModel: Model<IMailLogDocument> =
  (mongoose.models.MailLog as Model<IMailLogDocument>) ||
  mongoose.model<IMailLogDocument>("MailLog", mailLogSchema);

export default MailLogModel;
