import { Schema, Types, Document as MDoc } from "mongoose";

export type TimeKind =
  | "point"
  | "interval"
  | "deadline"
  | "recurring_master"
  | "recurring_occurrence";

export interface IEventoPartecipante {
  anagraficaType: string;          // es. "persone", "clienti", "ordini"
  anagraficaId: Types.ObjectId;    // ref dinamica ad Anagrafica_v2__*
  role?: string | null;            // "partecipante", "docente", "cliente"…
  status?: string | null;          // "previsto","presente","assente","letto","risolto"…
  quantity?: number | null;        // utile per prodotti, consumi, ecc.
  note?: string | null;
}

export interface IEventoGruppoRef {
  gruppoType: string;              // slug/type aula/gruppo
  gruppoId: Types.ObjectId;        // id aula/gruppo
}

export interface IEventoRecurrence {
  rrule?: string | null;           // solo sul MASTER
  until?: Date | null;             // opzionale
  count?: number | null;           // opzionale

  masterId?: Types.ObjectId | null; // solo sulle OCCURRENCE
}

export interface IEventoAttachment {
  type: string;                    // validato da config
  documentId: Types.ObjectId;      // ref Document_v2
  uploadedAt: Date;
  note?: string | null;
}

export interface IEventoDoc extends MDoc {
  _id: Types.ObjectId;

  /**
   * Se valorizzato → evento creato automaticamente da una "Action".
   * Contiene una piccola stringa codificata (es. "A|corsi-atleti__avvio_corso")
   * che il motore userà per risalire alla regola nel config.
   *
   * Se null/undefined → evento normale creato a mano.
   */
  _autoEvent?: string | null;

  // Campi dinamici configurabili a livello di tipo evento
  data: Record<string, any>;

  // --- CORE TEMPORALE ---
  timeKind: TimeKind;
  startAt?: Date | null;
  endAt?: Date | null;
  allDay?: boolean;

  recurrence?: IEventoRecurrence | null;

  // --- RELAZIONI ---
  gruppo?: IEventoGruppoRef | null;      // aula/gruppo principale (opzionale)
  partecipanti: IEventoPartecipante[];   // anagrafiche coinvolte

  // --- ACL / ALLEGATI ---
  visibilityRole?: string | null;
  attachments: IEventoAttachment[];

  owner: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export function buildEventoSchema() {
  const attachmentSchema = new Schema<IEventoAttachment>({
    type: { type: String, required: true, trim: true, index: true },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document_v2",
      required: true,
      index: true,
    },
    uploadedAt: { type: Date, default: () => new Date() },
    note: { type: String, default: null, trim: true, maxlength: 1000 },
  });

  const partecipanteSchema = new Schema<IEventoPartecipante>(
    {
      anagraficaType: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60,
        index: true,
      },
      anagraficaId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },
      role: { type: String, default: null, trim: true, maxlength: 100 },
      status: { type: String, default: null, trim: true, maxlength: 60 },
      quantity: { type: Number, default: null },
      note: { type: String, default: null, trim: true, maxlength: 1000 },
    },
    { _id: false },
  );

  const gruppoSchema = new Schema<IEventoGruppoRef>(
    {
      gruppoType: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60,
        index: true,
      },
      gruppoId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },
    },
    { _id: false },
  );

  const recurrenceSchema = new Schema<IEventoRecurrence>(
    {
      rrule: { type: String, default: null, trim: true, maxlength: 500 },
      until: { type: Date, default: null },
      count: { type: Number, default: null },

      masterId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true,
      },
    },
    { _id: false },
  );

  const schema = new Schema<IEventoDoc>(
    {
      /**
       * Stringa di meta per eventi auto-generati.
       * Non viene mostrata in UI, serve solo ai motori.
       */
      _autoEvent: { type: String, default: null, index: true },

      data: { type: Schema.Types.Mixed, default: {} },

      timeKind: {
        type: String,
        enum: [
          "point",
          "interval",
          "deadline",
          "recurring_master",
          "recurring_occurrence",
        ],
        required: true,
        index: true,
      },
      startAt: { type: Date, default: null, index: true },
      endAt: { type: Date, default: null, index: true },
      allDay: { type: Boolean, default: false },

      recurrence: { type: recurrenceSchema, default: null },

      gruppo: { type: gruppoSchema, default: null },

      partecipanti: { type: [partecipanteSchema], default: [] },

      visibilityRole: {
        type: String,
        default: null,
        trim: true,
        maxlength: 60,
        index: true,
      },
      attachments: { type: [attachmentSchema], default: [] },

      owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
    { timestamps: true },
  );

  // 🔒 Validazione incrociata temporale
  schema.pre("validate", function (next) {
    const doc = this as IEventoDoc;

    const { timeKind, startAt, endAt, recurrence } = doc;
    const rec = recurrence || {};

    function fail(msg: string) {
      return next(new Error(`[Evento validation] ${msg}`));
    }

    if (!timeKind) {
      return fail("timeKind è obbligatorio");
    }

    switch (timeKind) {
      case "point": {
        if (!startAt) return fail("timeKind=point richiede startAt valorizzato");
        if (endAt) doc.endAt = null; // ripulisci se messo per sbaglio
        if (rec.masterId) return fail("timeKind=point non può avere masterId");
        break;
      }

      case "interval": {
        if (!startAt || !endAt) {
          return fail("timeKind=interval richiede sia startAt che endAt");
        }
        if (endAt <= startAt) {
          return fail("endAt deve essere maggiore di startAt per timeKind=interval");
        }
        if (rec.masterId) return fail("timeKind=interval non può avere masterId");
        break;
      }

      case "deadline": {
        if (!endAt) {
          return fail("timeKind=deadline richiede endAt valorizzato");
        }
        if (startAt) doc.startAt = null; // ripulisci
        if (rec.masterId) return fail("timeKind=deadline non può avere masterId");
        if (rec.rrule) return fail("timeKind=deadline non supporta rrule");
        break;
      }

      case "recurring_master": {
        if (!startAt) {
          return fail("timeKind=recurring_master richiede startAt (orario base)");
        }
        if (!rec.rrule) {
          return fail("timeKind=recurring_master richiede recurrence.rrule");
        }
        if (rec.masterId) {
          return fail("recurrence.masterId deve essere null sul master");
        }
        break;
      }

      case "recurring_occurrence": {
        if (!startAt) {
          return fail("timeKind=recurring_occurrence richiede startAt");
        }
        if (!rec.masterId) {
          return fail("timeKind=recurring_occurrence richiede recurrence.masterId");
        }
        // su un'occurrence non vogliamo rrule/until/count
        if (rec.rrule) rec.rrule = null;
        if (rec.count != null) rec.count = null;
        if (rec.until) rec.until = null;
        break;
      }

      default:
        return fail(`timeKind non gestito: ${timeKind as string}`);
    }

    return next();
  });

  return schema;
}
