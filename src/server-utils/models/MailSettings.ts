// src/server-utils/models/MailSettings.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMailSettings {
  key: "global";
  systemSenderIdentityId?: Types.ObjectId | string; // per avvisi automatici
  enabled: boolean;
}

export interface IMailSettingsDocument extends IMailSettings, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mailSettingsSchema = new Schema<IMailSettingsDocument>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    systemSenderIdentityId: { type: Schema.Types.ObjectId, ref: "EmailIdentity" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const MailSettingsModel: Model<IMailSettingsDocument> =
  (mongoose.models.MailSettings as Model<IMailSettingsDocument>) ||
  mongoose.model<IMailSettingsDocument>("MailSettings", mailSettingsSchema);

export default MailSettingsModel;
