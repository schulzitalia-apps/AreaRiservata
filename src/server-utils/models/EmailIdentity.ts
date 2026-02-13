// src/server-utils/models/EmailIdentity.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IEmailIdentity {
  label: string;                 // "Assistenza", "Commerciale", ...
  fromName: string;              // "EvolveAtlas"
  fromEmail: string;             // "alerts@atlas.evolve3d.it"
  replyToEmail?: string;         // opzionale
  enabled: boolean;
  createdBy?: Types.ObjectId | string;
}

export interface IEmailIdentityDocument extends IEmailIdentity, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const emailIdentitySchema = new Schema<IEmailIdentityDocument>(
  {
    label: { type: String, required: true, trim: true },
    fromName: { type: String, required: true, trim: true },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    replyToEmail: { type: String, trim: true, lowercase: true },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// evita doppioni pratici
emailIdentitySchema.index({ fromEmail: 1 }, { unique: true });

const EmailIdentityModel: Model<IEmailIdentityDocument> =
  (mongoose.models.EmailIdentity as Model<IEmailIdentityDocument>) ||
  mongoose.model<IEmailIdentityDocument>("EmailIdentity", emailIdentitySchema);

export default EmailIdentityModel;
