import type { Model } from "mongoose";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * Writer: delete su DB
 * --------------------
 * Side-effect DB isolato (testabilità + separazione responsabilità).
 *
 * Nota:
 * - qui NON facciamo controlli input: sono nei builder (normalize input)
 * - qui NON facciamo ACL: se serve, va composto a monte (filter + findOneAndDelete)
 */
type DeletePayload = {
  id: string;
};

export async function writeDeleteAnagrafica(
  Model: Model<IAnagraficaDoc>,
  payload: DeletePayload,
): Promise<any | null> {
  const deleted = await Model.findByIdAndDelete(payload.id).lean();
  return deleted ?? null;
}
