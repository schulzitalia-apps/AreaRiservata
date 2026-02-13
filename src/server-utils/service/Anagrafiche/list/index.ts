// src/server-utils/service/Anagrafiche/list/index.ts

/**
 * EVOLVE ATLAS — Service Export (Anagrafiche/list)
 * -----------------------------------------------
 * Re-export pulito della feature `list`.
 * Serve a mantenere import stabili e leggibili.
 */

export { listAnagrafiche } from "./list";
export type { ListAnagraficheParams } from "./list";
export type { AnagraficaPreview } from "./mappers/preview";
export type { ListSortKey } from "./builders/sort";
