// src/server-utils/models/DevBoardItem.ts
import mongoose, {
  Schema,
  Types,
  Model,
  Document,
} from "mongoose";

export type DevItemCategory = "bug" | "feature" | "training" | "note";
export type DevItemStatus = "open" | "in_progress" | "done";

export interface IDevBoardItem {
  category: DevItemCategory;
  title: string;
  description: string;          // testo anche lungo, tipo markdown semplice
  status: DevItemStatus;
  versionTag?: string | null;   // es. "0.3.0" se collegato a una release
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
}

export interface IDevBoardItemDoc extends IDevBoardItem, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const devBoardSchema = new Schema<IDevBoardItemDoc>(
  {
    category: {
      type: String,
      enum: ["bug", "feature", "training", "note"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "done"],
      default: "open",
      index: true,
    },
    versionTag: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

devBoardSchema.index({ category: 1, status: 1, createdAt: -1 });

const MODEL_NAME = "DevBoardItem";
const COLLECTION_NAME = "dev_board_items";

const DevBoardItemModel: Model<IDevBoardItemDoc> =
  (mongoose.models[MODEL_NAME] as Model<IDevBoardItemDoc>) ||
  mongoose.model<IDevBoardItemDoc>(MODEL_NAME, devBoardSchema, COLLECTION_NAME);

export default DevBoardItemModel;
