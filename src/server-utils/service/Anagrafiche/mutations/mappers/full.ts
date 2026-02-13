import type { AnagraficaFull } from "../../types";

/**
 * Mapper: doc Mongo -> DTO AnagraficaFull (light)
 * ----------------------------------------------
 * Qui non facciamo join su documents/owners:
 * - questo mapper è per l'output della mutation update
 * - i join "pesanti" restano in getById o in pipeline dedicate
 *
 * Se vuoi mantenere la stessa forma del tuo getById (con join documents),
 * puoi:
 * - riusare getById dopo update (2 query)
 * - oppure introdurre una join qui (ma aumenti il costo di ogni update)
 */
export function mapToAnagraficaFull(raw: any): AnagraficaFull {
  return {
    id: String(raw._id),
    data: raw.data || {},
    visibilityRoles: Array.isArray(raw.visibilityRoles) ? raw.visibilityRoles : [],
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    attachments: Array.isArray(raw.attachments) ? raw.attachments : undefined,
  };
}
