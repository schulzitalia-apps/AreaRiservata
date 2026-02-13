/**
 * EVOLVE ATLAS — Types condivisi Service Anagrafiche
 * --------------------------------------------------
 * DTO e input types usati da list/get/mutations.
 *
 * Nota filosofica (Atlas):
 * - data è Mixed => Record<string, any> (il tipo forte è nel registry, non in TS)
 * - per questo manteniamo DTO "elastici", ma con regole server-side (casting/unset).
 */

export type DocumentLight = {
  id: string;
  title: string | null;
  category: string | null;
  updatedAt?: string | null;
  visibility?: string | null;
};

export type AttachmentView = {
  _id: string;
  type: string;
  uploadedAt: string | null;
  documentId: string;
  document?: DocumentLight | null;
  note?: string | null;
};

export type AnagraficaFull = {
  id: string;
  data: Record<string, any>;
  visibilityRoles?: string[];
  attachments?: AttachmentView[];
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Update patch-like:
 * - invii SOLO i campi interessati
 * - "" / null / undefined / [] => $unset (rimuove la chiave dal blob data)
 * - chiavi assenti => non toccate
 *
 * NB: `visibilityRoles` è core (fuori da data) => lo aggiorniamo solo se presente.
 */
export type UpdateAnagraficaParams = {
  type: string; // slug Atlas (es. "clienti")
  id: string;   // ObjectId string
  updatedById: string; // ObjectId string

  // patch parziale su data.*
  data?: Record<string, any>;

  // patch su core
  visibilityRoles?: string[] | null;
};
/**
 * Create:
 * - data è un delta iniziale (solo i campi che vuoi impostare)
 * - casting serio + sparse: vuoti/non applicabili NON vengono salvati
 */
export type CreateAnagraficaParams = {
  type: string;   // slug Atlas (es. "clienti")
  userId: string; // ObjectId string (owner/createdBy/updatedBy)

  data?: Record<string, any>;

  // core
  visibilityRoles?: string[] | null;
};

/**
 * Delete:
 * - cancella un record per id
 */
export type DeleteAnagraficaParams = {
  type: string; // slug Atlas
  id: string;   // ObjectId string
};
