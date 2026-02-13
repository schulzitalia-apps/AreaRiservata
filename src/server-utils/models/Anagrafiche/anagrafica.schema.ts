// src/server-utils/models/Anagrafiche/anagrafica.schema.ts
import { Schema, Types, Document as MDoc } from "mongoose";

/**
 * EVOLVE ATLAS — Modello dati flessibile (config-driven)
 * -----------------------------------------------------
 * Lo "schema Anagrafiche" è uno dei mattoni fondamentali del sistema flessibile Evolve Atlas.
 * In Atlas, i "tipi" vengono definiti da configurazione e la struttura dati deve poter
 * adattarsi senza migrazioni rigide continue.
 *
 * I tre principali tipi di dato flessibile in Atlas sono:
 * 1) Anagrafiche: strutture dati per archiviazione (questa entità).
 * 2) Aule: strutture dati simili alle anagrafiche, ma orientate al raggruppamento di anagrafiche.
 * 3) Eventi: strutture dati tipo anagrafica, con una data/tempo che le colloca nel calendario.
 *
 * Scelta architetturale chiave:
 * - `data` contiene TUTTI i campi "custom" (configurati per tipo).
 * - alcuni campi "core" restano FUORI da `data` perché devono essere:
 *   - strutturati (schema dedicato)
 *   - indicizzabili
 *   - consistenti fra i vari tipi
 *
 * Nota: le interfacce TS usano la convenzione `I*` (Interface) per distinguere i contratti
 * di tipo dalla logica runtime e dai model Mongoose.
 */

/**
 * Documento principale: Anagrafiche (Mongoose Document)
 * ----------------------------------------------------
 * Questa è la "mappa generale" dell'entità. Le tipizzazioni dei blocchi core (attachments/aule)
 * sono definite più sotto per mantenere una progressione: prima capisco COSA è l'Anagrafiche,
 * poi scendo nei dettagli.
 */
export interface IAnagraficaDoc extends MDoc {
  _id: Types.ObjectId;

  /**
   * Campi dinamici (config-driven).
   * Può contenere stringhe, numeri, boolean, oggetti annidati, array, ecc.
   * La validazione/forma di questi campi è gestita a livello applicativo tramite Atlas config.
   */
  data: Record<string, any>;

  /**
   * Campi "core" (stabili, strutturati, indicizzabili).
   * Restano fuori da `data` per evitare ambiguità e per consentire indici/query efficienti.
   *
   * Visibilità complessa:
   * - array di ruoli/policy
   * - consente record visibili a più ruoli
   * - indicizzato come multikey index
   */
  visibilityRoles: string[];
  attachments: IAttachment[];

  /**
   * Partecipazioni a Aule.
   * Popolato solo se il tipo anagrafica è abilitato al modulo Aule.
   */
  aule: IAulaPartecipazione[];

  /**
   * ACL / Audit
   */
  owner: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;

  /**
   * Timestamp (gestiti da Mongoose via `timestamps: true`)
   */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Allegato associato all'anagrafica.
 * `type` viene validato a livello applicativo via configurazione (non hard-coded nello schema).
 */
export interface IAttachment {
  type: string;
  documentId: Types.ObjectId; // ref: Document_v2
  uploadedAt: Date;
  note?: string | null;
}

/**
 * Partecipazione a una Aula.
 * - aulaId: id dell'aula
 * - aulaType: slug del tipo di aula (es. "corso_collettivo", "lezione_privata"…)
 * - joinedAt: data di ingresso
 * - role: ruolo eventuale (opzionale)
 */
export interface IAulaPartecipazione {
  aulaId: Types.ObjectId;
  aulaType: string;
  joinedAt: Date;
  role?: string | null;
}

/**
 * Factory dello schema Mongoose
 * ----------------------------
 * Obiettivo: produrre uno Schema coerente col paradigma config-driven:
 * - `data` resta flessibile (Mixed)
 * - i campi core sono strutturati (schema dedicati + indici)
 * - audit e timestamps standardizzati
 *
 * Cosa espone:
 * - ritorna uno Schema<IAnagraficaDoc> pronto per essere agganciato a un model altrove
 * - non crea side effects (non registra model, non fa query, non legge config)
 */
export function buildAnagraficaSchema() {
  /**
   * Sub-schema: attachments
   * - `documentId` referenzia Document_v2 (utile per populate)
   * - indici su campi usati frequentemente in query
   */
  const attachmentSchema = new Schema<IAttachment>(
    {
      type: { type: String, required: true, trim: true, index: true },
      documentId: {
        type: Schema.Types.ObjectId,
        ref: "Document_v2",
        required: true,
        index: true,
      },
      uploadedAt: { type: Date, default: () => new Date() },
      note: { type: String, default: null, trim: true, maxlength: 1000 },
    },
    { _id: false },
  );

  /**
   * Sub-schema: partecipazioni ad Aule
   * `{ _id: false }` evita l'_id per ogni elemento dell'array: meno rumore e peso.
   * Se in futuro serviranno update puntuali su singolo elemento via _id, si può rivalutare.
   */
  const aulaPartecipazioneSchema = new Schema<IAulaPartecipazione>(
    {
      aulaId: {
        type: Schema.Types.ObjectId,
        // quando definiremo il modello Aula possiamo aggiungere: ref: "Aula_v1" (o simile)
        required: true,
        index: true,
      },
      aulaType: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60,
        index: true,
      },
      joinedAt: { type: Date, default: () => new Date() },
      role: { type: String, default: null, trim: true, maxlength: 100 },
    },
    { _id: false },
  );

  /**
   * Schema principale: Anagrafiche
   * - `data` è Mixed: flessibile per i campi custom (Atlas)
   * - campi core separati e strutturati
   * - audit standard
   */
  const schema = new Schema<IAnagraficaDoc>(
    {
      data: { type: Schema.Types.Mixed, default: {} },

      /**
       * Visibilità complessa (array):
       * - multikey index (1 entry per elemento dell'array)
       * - best practice: pochi ruoli per record (es. 1–3)
       */
      visibilityRoles: {
        type: [String],
        default: [],
        trim: true,
        maxlength: 60,
        index: true,
      },

      attachments: { type: [attachmentSchema], default: [] },

      /**
       * Partecipazioni a Aule:
       * campo core (come visibilityRoles/attachments), NON in `data`,
       * per mantenerlo strutturato e indicizzabile.
       */
      aule: { type: [aulaPartecipazioneSchema], default: [] },

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

  /**
   * Indici su timestamp
   * -------------------
   * `timestamps: true` crea createdAt/updatedAt, ma NON crea indici automaticamente.
   * Indicizziamo createdAt perché spesso utile per:
   * - ordinamenti "ultimi creati"
   * - filtri per range temporale di creazione
   */
  schema.index({ createdAt: -1 });
  schema.index({ updatedAt: -1 });

  /**
   * Indici su `data.*`
   * -----------------
   * Gli indici dei campi custom non sono qui perché dipendono dal tipo (Atlas config).
   * Vengono creati dinamicamente nella factory del model per "tipo anagrafica".
   */
  return schema;
}
