import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  Types,
} from "mongoose";

export interface IBarcodeDoc extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

const barcodeSchema = new Schema<IBarcodeDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
  },
  { timestamps: true }
);

// NB: niente type annotation strana → evitiamo TS2344
const BarcodeModel: Model<IBarcodeDoc> =
  (models.Barcode_v1 as Model<IBarcodeDoc>) ||
  model<IBarcodeDoc>("Barcode_v1", barcodeSchema);

export default BarcodeModel;
