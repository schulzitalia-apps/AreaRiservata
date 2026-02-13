import mongoose from "mongoose";

/**
 * Builder: audit ops
 * ------------------
 * Atlas mantiene audit fields core fuori da `data`.
 *
 * - update/patch: aggiorniamo sempre `updatedBy`
 * - create: settiamo owner + createdBy + updatedBy (uguali all'inizio)
 *
 * Nota timestamps:
 * - createdAt/updatedAt li gestisce mongoose timestamps (se abilitati nello schema)
 */

/* -------------------------------- UPDATE/PATCH ----------------------------- */

export function buildAuditPatchOps(updatedById: string) {
  const updatedBy = new mongoose.Types.ObjectId(updatedById);

  return {
    $set: {
      updatedBy,
    },
  };
}

/* ----------------------------------- CREATE -------------------------------- */

export function buildAuditCreateFields(userId: string) {
  const owner = new mongoose.Types.ObjectId(userId);

  return {
    owner,
    createdBy: owner,
    updatedBy: owner,
  };
}
