import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongoose-connection";
import BarcodeModel, { IBarcodeDoc } from "../models/barcode.schema";

export type BarcodeDTO = {
  id: string;
  userId: string;
  action: string;
  createdAt: string;
  updatedAt: string;
};

function mapDoc(d: IBarcodeDoc): BarcodeDTO {
  return {
    id: String(d._id),
    userId: String(d.userId),
    action: d.action,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

/* 1) LISTA TUTTO ------------------------------------------------------------ */

export async function listAllBarcodes(): Promise<BarcodeDTO[]> {
  await connectToDatabase();

  const docs = await BarcodeModel.find().sort({ updatedAt: -1 }).lean<IBarcodeDoc[]>();
  return docs.map((d) => mapDoc(d as any));
}

/* 2) CREA / AGGIORNA COLLEGAMENTO (UPSERT PER USER) -------------------------- */
/**
 * ✅ IMPORTANTISSIMO:
 * prima creava sempre un nuovo documento.
 * ora aggiorna quello esistente per userId (se c'è), altrimenti lo crea.
 *
 * Inoltre ripulisce eventuali duplicati esistenti per lo stesso userId.
 */
export async function createBarcode(params: {
  userId: string;
  action: string;
}): Promise<BarcodeDTO> {
  const { userId, action } = params;

  await connectToDatabase();

  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("userId non valido");
  }

  const userOid = new mongoose.Types.ObjectId(userId);
  const normalizedAction = action.trim();

  // 1) upsert: update se esiste, insert se non esiste
  const doc = await BarcodeModel.findOneAndUpdate(
    { userId: userOid },
    { $set: { action: normalizedAction } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean<IBarcodeDoc | null>();

  if (!doc) {
    throw new Error("Impossibile salvare associazione barcode");
  }

  // 2) cleanup: se in passato sono stati creati duplicati, li elimino
  // (mantengo quello appena salvato)
  await BarcodeModel.deleteMany({
    userId: userOid,
    _id: { $ne: (doc as any)._id },
  });

  return mapDoc(doc as any);
}

/* 3) PATCH PER ID ----------------------------------------------------------- */

export async function updateBarcodeById(params: {
  id: string;
  patch: { userId?: string; action?: string };
}): Promise<BarcodeDTO | null> {
  const { id, patch } = params;

  await connectToDatabase();

  const update: any = {};
  if (patch.userId) {
    if (!mongoose.isValidObjectId(patch.userId)) {
      throw new Error("userId non valido");
    }
    update.userId = new mongoose.Types.ObjectId(patch.userId);
  }
  if (typeof patch.action === "string") {
    update.action = patch.action.trim();
  }

  const updated = await BarcodeModel.findByIdAndUpdate(id, update, {
    new: true,
  }).lean<IBarcodeDoc | null>();

  if (!updated) return null;
  return mapDoc(updated as any);
}

/* 4) OTTIENI AZIONE DA ID UTENTE ------------------------------------------- */

export async function getActionByUserId(userId: string): Promise<string | null> {
  await connectToDatabase();

  if (!mongoose.isValidObjectId(userId)) return null;

  const oid = new mongoose.Types.ObjectId(userId);

  // ✅ leggo SEMPRE l'ultimo aggiornato
  const doc = await BarcodeModel
    .findOne({ userId: oid })
    .sort({ updatedAt: -1 })
    .lean<{ action: string } | null>();

  return doc ? String(doc.action) : null;
}
