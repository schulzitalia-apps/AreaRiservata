import type { Model } from "mongoose";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * Writer: create su DB
 * --------------------
 * Side-effect DB isolato (testabilità + separazione responsabilità).
 *
 * Nota:
 * - qui NON castiamo: il casting sta nei builder (funzioni pure).
 */
type CreatePayload = {
  data: Record<string, any>;
  visibilityRoles: string[];
  owner: any;
  createdBy: any;
  updatedBy: any;
};

export async function writeCreateAnagrafica(
  Model: Model<IAnagraficaDoc>,
  payload: CreatePayload,
): Promise<any> {
  const created = await Model.create(payload);
  return created;
}
