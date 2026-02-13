import mongoose, { Schema, Document, Model } from "mongoose";

export type ActionMailJobStatus = "PENDING" | "SENT" | "FAILED";

export interface IActionMailJob {
  status: ActionMailJobStatus;

  scope: "ANAGRAFICA" | "AULA";
  actionId: string;

  // collegamento al “target” che ha generato l’evento
  target: {
    anagraficaType?: string;
    anagraficaId?: string;
    aulaType?: string;
    aulaId?: string;
  };

  // quando dovrebbe partire (es. startAt dell’evento)
  scheduledAt: Date;

  // payload già “renderizzato” (così la routine è banale)
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;

  error?: string;
}

export interface IActionMailJobDocument extends IActionMailJob, Document {
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IActionMailJobDocument>(
  {
    status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING" },

    scope: { type: String, enum: ["ANAGRAFICA", "AULA"], required: true },
    actionId: { type: String, required: true },

    target: {
      anagraficaType: { type: String },
      anagraficaId: { type: String },
      aulaType: { type: String },
      aulaId: { type: String },
    },

    scheduledAt: { type: Date, required: true },

    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    replyTo: { type: String },

    error: { type: String },
  },
  { timestamps: true }
);

schema.index({ status: 1, scheduledAt: 1 });

const ActionMailJobModel: Model<IActionMailJobDocument> =
  (mongoose.models.ActionMailJob as Model<IActionMailJobDocument>) ||
  mongoose.model<IActionMailJobDocument>("ActionMailJob", schema);

export default ActionMailJobModel;
