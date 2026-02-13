import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MailSendMode = "IMMEDIATO" | "ALLA_DATA_EVENTO";

export interface IActionMailRule {
  actionId: string;
  scope: "ANAGRAFICA" | "AULA";
  enabled: boolean;
  sendMode: MailSendMode;
  subjectTemplate: string;
  htmlTemplate: string;
  updatedBy?: Types.ObjectId | string | null;
}

export interface IActionMailRuleDocument extends IActionMailRule, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IActionMailRuleDocument>(
  {
    actionId: { type: String, required: true, trim: true },
    scope: { type: String, required: true, enum: ["ANAGRAFICA", "AULA"] },

    enabled: { type: Boolean, default: false },
    sendMode: {
      type: String,
      enum: ["IMMEDIATO", "ALLA_DATA_EVENTO"],
      default: "IMMEDIATO",
    },

    subjectTemplate: { type: String, default: "", trim: true },
    htmlTemplate: { type: String, default: "", trim: true },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schema.index({ actionId: 1 }, { unique: true });

const ActionMailRuleModel: Model<IActionMailRuleDocument> =
  (mongoose.models.ActionMailRule as Model<IActionMailRuleDocument>) ||
  mongoose.model<IActionMailRuleDocument>("ActionMailRule", schema);

export default ActionMailRuleModel;
