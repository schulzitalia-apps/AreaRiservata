// src/server-utils/service/Anagrafiche/list/list.ts
import type { FilterQuery } from "mongoose";

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

import { buildMongoAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

import { buildSearchFilter } from "./builders/search";
import { buildDomainFilter, combineFilters } from "./builders/filter";
import { buildPreviewProjection } from "./builders/projection";
import { buildListSort, type ListSortKey } from "./builders/sort";
import { buildPagination } from "./builders/pagination";

import { buildOwnerMap } from "./joins/owners";
import { mapDocsToPreview, type AnagraficaPreview } from "./mappers/preview";

/**
 * EVOLVE ATLAS — List Anagrafiche (orchestratore)
 * ----------------------------------------------
 * Orchestratore “pipeline style” della list.
 *
 * Sequenza logica:
 * 1) read config (def)
 * 2) build search filter (opzionale)
 * 3) build domain filter
 * 4) build ACL filter (access-engine)
 * 5) combine filters
 * 6) projection/sort/pagination
 * 7) query + count (parallel)
 * 8) joins (owners)
 * 9) mapping preview DTO
 *
 * Nota performance:
 * - la search viene aggiunta SOLO se `query` è presente
 * - projection limita i campi a quelli necessari (preview o subset dinamico)
 */
export type ListAnagraficheParams = {
  type: string; // slug: "clienti", "conferme-ordine"
  query?: string;
  limit?: number;
  offset?: number;
  docType?: string;

  /**
   * Filtro dominio opzionale:
   * - se passato, restringe ai record che contengono QUEL ruolo/policy nell'array
   */
  visibilityRole?: string;

  /**
   * Sort whitelistato (uniforme e sicuro):
   * - updatedAt/createdAt
   * - campi preview (title/subtitle/searchIn) => data.<campo> indicizzati da model
   */
  sort?: ListSortKey;

  /**
   * Projection dinamica (subset di data.*):
   * - se omesso/vuoto => default preview (title/subtitle/searchIn)
   * - se presente => include SOLO quei data.<field>, whitelistati su def.fields
   */
  fields?: FieldKey[];

  auth: AuthContext;
};

export async function listAnagrafiche(
  params: ListAnagraficheParams,
): Promise<{ items: AnagraficaPreview[]; total: number }> {
  const {
    type,
    query,
    limit,
    offset,
    docType,
    visibilityRole,
    sort: sortKey,
    fields,
    auth,
  } = params;

  await connectToDatabase();

  const slug = type as AnagraficaTypeSlug;
  const def = getAnagraficaDef(slug);
  const Model = getAnagraficaModel(slug);

  // 1) Search (opzionale)
  const searchFilter = buildSearchFilter(def, query);

  // 2) Dominio
  const baseFilter = buildDomainFilter({
    searchFilter,
    docType,
    visibilityRole,
  });

  // 3) ACL centralizzato
  // Nota typing:
  // - buildMongoAccessFilter potrebbe essere tipizzato su mongodb.Filter
  // - qui lo normalizziamo come FilterQuery per Mongoose
  const accessFilter = buildMongoAccessFilter<IAnagraficaDoc>(
    auth,
    slug,
  ) as unknown as FilterQuery<IAnagraficaDoc>;

  // 4) Combine (Mongoose FilterQuery)
  const filter = combineFilters<IAnagraficaDoc>(
    baseFilter as FilterQuery<IAnagraficaDoc>,
    accessFilter,
  );

  // DEBUG MIRATO:
  // - solo per conferme-ordine
  // - solo per query 2970
  // - stampa i pezzi per vedere se data.numeroOrdine entra davvero nel filtro finale
  if (slug === "conferme-ordine" && (query ?? "").trim() === "2970") {
    console.log("[DEBUG conferme-ordine search]", {
      query: (query ?? "").trim(),
      searchIn: def?.preview?.searchIn,
      fieldDefNumeroOrdine: def?.fields?.numeroOrdine,
      searchFilter,
      baseFilter,
      accessFilter,
      filter,
    });

    // (extra) stampa stringificata per copiare/incollare in Compass
    try {
      console.log("[DEBUG conferme-ordine filter JSON]", JSON.stringify(filter));
    } catch {
      // ignore
    }
  }

  // 5) Projection / Sort / Pagination
  const projection = buildPreviewProjection(def, fields);
  const sort = buildListSort(def, sortKey); // ✅ sort uniforme e whitelistato sui preview fields
  const { safeLimit, safeOffset } = buildPagination(limit, offset);

  // 6) Query + Count (parallel)
  const [docs, total] = await Promise.all([
    Model.find(filter)
      .select(projection as any)
      .sort(sort as any)
      .skip(safeOffset)
      .limit(safeLimit)
      .lean(),
    Model.countDocuments(filter),
  ]);

  // 7) Joins
  const ownerMap = await buildOwnerMap(docs as any[]);

  // 8) Map output
  const items = mapDocsToPreview(docs as any[], def, ownerMap);

  return { items, total };
}
