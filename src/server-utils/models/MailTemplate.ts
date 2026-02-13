// src/server-utils/models/MailTemplate.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MailEventAutoTimeKind = "point" | "interval" | "deadline" | "recurring_master";
export type MailEventAutoStartAtSource = "now" | "var";

export interface IMailEventAutoConfig {
  enabled?: boolean;

  // evento
  eventoType?: string; // slug eventi.registry
  timeKind?: MailEventAutoTimeKind;

  // start/end
  startAtSource?: MailEventAutoStartAtSource;
  startAtVarPath?: string;

  endAtSource?: "var";
  endAtVarPath?: string;

  allDay?: boolean;

  // visibilità: null/undefined = solo proprietario (come vuoi tu)
  visibilityRole?: string | null;

  // preset JSON (campi evento)
  dataPreset?: Record<string, any>;

  // partecipante opzionale (se vuoi auto-agganciare un’anagrafica)
  partecipante?: {
    anagraficaType?: string;
    anagraficaIdVarPath?: string;
    role?: string | null;
    status?: string | null;
    quantity?: number | null;
    note?: string | null;
  };

  // gruppo/aula opzionale
  gruppo?: {
    gruppoType?: string;
    gruppoIdVarPath?: string;
  };
}

export interface IMailTemplate {
  key: string; // es: "support.new_message", "user.welcome"
  name: string; // label admin
  subject: string; // stringa con {{var}}
  html: string; // html con {{var}}
  enabled: boolean;
  description?: string;
  updatedBy?: Types.ObjectId | string;

  // ✅ configurazione creazione evento lato client
  eventAuto?: IMailEventAutoConfig;
}

export interface IMailTemplateDocument extends IMailTemplate, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ✅ Schema EVENT AUTO permissivo:
 * - niente default “aggressivi”
 * - può essere salvato anche vuoto {}
 * - può essere parziale
 */
const mailEventAutoSchema = new Schema<IMailEventAutoConfig>(
  {
    enabled: { type: Boolean },

    eventoType: { type: String },
    timeKind: {
      type: String,
      enum: ["point", "interval", "deadline", "recurring_master"],
    },

    startAtSource: { type: String, enum: ["now", "var"] },
    startAtVarPath: { type: String },

    endAtSource: { type: String, enum: ["var"], required: false },
    endAtVarPath: { type: String },

    allDay: { type: Boolean },

    visibilityRole: { type: String, default: null },

    // preset JSON (Mixed)
    dataPreset: { type: Schema.Types.Mixed },

    partecipante: {
      anagraficaType: { type: String },
      anagraficaIdVarPath: { type: String },
      role: { type: String, default: null },
      status: { type: String, default: null },
      quantity: { type: Number, default: null },
      note: { type: String, default: null },
    },

    gruppo: {
      gruppoType: { type: String },
      gruppoIdVarPath: { type: String },
    },
  },
  { _id: false }
);

const mailTemplateSchema = new Schema<IMailTemplateDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    description: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // ✅ può essere assente, può essere {}, può essere parziale
    eventAuto: { type: mailEventAutoSchema, required: false, default: undefined },
  },
  {
    timestamps: true,
    minimize: false, // ✅ CRITICO: NON elimina {} dai documenti (e nemmeno subdoc vuoti)
  }
);

const MailTemplateModel: Model<IMailTemplateDocument> =
  (mongoose.models.MailTemplate as Model<IMailTemplateDocument>) ||
  mongoose.model<IMailTemplateDocument>("MailTemplate", mailTemplateSchema);

export default MailTemplateModel;
