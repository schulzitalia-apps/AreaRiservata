// src/server-utils/models/Profile.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProfile {
  userId: Types.ObjectId | string;
  fullName?: string;
  phone?: string;
  bio?: string;
  avatarKey?: string;
}

export interface IProfileDocument extends IProfile, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfileDocument>(
  {
    // ⚠️ niente index: true qui
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    bio: { type: String, trim: true },
    avatarKey: { type: String, trim: true },
  },
  { timestamps: true }
);

// unico indice e unico punto dove lo dichiariamo
profileSchema.index({ userId: 1 }, { unique: true });

const ProfileModel: Model<IProfileDocument> =
  (mongoose.models.Profile as Model<IProfileDocument>) ||
  mongoose.model<IProfileDocument>("Profile", profileSchema);

export default ProfileModel;
