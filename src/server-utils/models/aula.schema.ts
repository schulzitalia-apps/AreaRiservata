// src/server-utils/models/aula.schema.ts

import { Schema, Types, Document as MDoc } from "mongoose";

/**
 * Attachment generico, speculare a quello usato sulle Anagrafiche.
 * type      -> tipo di allegato (guidato dal config)
 * documentId-> ref al Document_v2
 * uploadedAt-> data upload
 * note      -> nota opzionale
 */
export interface IAulaAttachment {
  type: string;
  documentId: Types.ObjectId;
  uploadedAt: Date;
  note?: string | null;
}

/**
 * Partecipante a una Aula.
 * - anagraficaId: id dell'anagrafica collegata
 * - joinedAt: data di ingresso
 * - dati: oggetto dinamico guidato dal config aule.partecipanti
 */
export interface IAulaPartecipante {
  /**
   * Riferimento all'anagrafica collegata (obbligatorio)
   */
  anagraficaId: Types.ObjectId;

  /**
   * Data di ingresso nell'aula (obbligatorio)
   */
  joinedAt: Date;

  /**
   * Dati dinamici del partecipante (ruolo, note, qualunque campo
   * deciso dal config aule.partecipanti)
   *
   * Esempi: { ruolo: "Titolar", note: "...", presenze: 10 }
   */
  dati: Record<string, any>;
}

export interface IAulaDoc extends MDoc {
  _id: Types.ObjectId;

  /**
   * Slug del tipo di aula, es. "corsi-atleti"
   */
  tipoSlug: string;

  /**
   * Campi configurabili dell'aula (nomeAula, descrizione, …)
   */
  dati: Record<string, any>;

  /**
   * Visibilità dell'aula.
   * Concetto speculare a IAnagraficaDoc.visibilityRole:
   * - se null -> nessuna regola speciale
   * - altrimenti restringe la visibilità a un certo ruolo
   */
  visibilityRole?: string | null;

  /**
   * Allegati collegati all'aula.
   * Simili agli attachments delle Anagrafiche:
   * - type: slug configurato (es. "materiale", "verbale", "foto")
   * - documentId: ref al Document_v2
   * - uploadedAt: data di upload
   * - note: stringa opzionale
   */
  attachments: IAulaAttachment[];

  /**
   * Elenco partecipanti.
   * Ogni partecipante ha:
   *  - anagraficaId (statico)
   *  - joinedAt (statico)
   *  - dati (dinamico, guidato dal config)
   */
  partecipanti: IAulaPartecipante[];

  owner: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export function buildAulaSchema() {
  // sub-schema per gli attachment dell'aula
  const AttachmentSchema = new Schema<IAulaAttachment>({
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document_v2",
      required: true,
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: () => new Date(),
    },
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
  });

  // sub-schema per un partecipante (static + dinamico)
  const PartecipanteSchema = new Schema<IAulaPartecipante>(
    {
      anagraficaId: { type: Schema.Types.ObjectId, required: true },
      joinedAt: { type: Date, required: true },

      // contenitore generico per i campi definiti da config
      dati: { type: Schema.Types.Mixed, default: {} },
    },
    {
      _id: false, // niente _id separato per il sotto-documento
    },
  );

  return new Schema<IAulaDoc>(
    {
      tipoSlug: { type: String, required: true, index: true },

      // dati configurabili dell'aula (nomeAula, descrizione, ecc.)
      dati: { type: Schema.Types.Mixed, default: {} },

      /**
       * Visibilità dell'aula, in modo simile alle anagrafiche.
       * Usabile per filtrare aule visibili solo a certi ruoli.
       */
      visibilityRole: {
        type: String,
        default: null,
        trim: true,
        maxlength: 60,
        index: true,
      },

      /**
       * Allegati dell'aula: materiale, documenti, foto, ecc.
       */
      attachments: {
        type: [AttachmentSchema],
        default: [],
      },

      // array di partecipanti
      partecipanti: {
        type: [PartecipanteSchema],
        default: [],
      },

      owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,
    },
  );
}
