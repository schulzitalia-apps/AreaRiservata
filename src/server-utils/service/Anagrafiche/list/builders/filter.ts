// src/server-utils/service/Anagrafiche/list/builders/filter.ts
import type { FilterQuery } from "mongoose";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * EVOLVE ATLAS — Builder Filter (dominio + composizione)
 * -----------------------------------------------------
 * Questo file centralizza:
 * 1) i filtri di dominio (business)
 * 2) la composizione finale con l'access filter (ACL)
 *
 * Principi:
 * - i builder non fanno DB (funzioni pure)
 * - combinazione "safe": includiamo solo i pezzi non vuoti
 *
 * Visibilità complessa:
 * - input API resta `visibilityRole?: string` (compatibilità)
 * - filtro effettivo: `visibilityRoles: <role>` (array contains)
 */

/**
 * Costruisce il filtro di dominio (business).
 *
 * Include (se presenti):
 * - searchFilter (solo se query attiva)
 * - docType (attachments.type)
 * - visibilityRole (array contains su visibilityRoles)
 */
export function buildDomainFilter(args: {
  searchFilter?: FilterQuery<IAnagraficaDoc> | null;
  docType?: string;
  visibilityRole?: string;
}): FilterQuery<IAnagraficaDoc> {
  const conditions: FilterQuery<IAnagraficaDoc>[] = [];

  if (args.searchFilter) conditions.push(args.searchFilter);
  if (args.docType) conditions.push({ "attachments.type": args.docType });

  // array contains: matcha documenti che contengono quel valore
  if (args.visibilityRole) conditions.push({ visibilityRoles: args.visibilityRole });

  return conditions.length ? ({ $and: conditions } as any) : ({} as any);
}

/**
 * Combina filtro di dominio + filtro ACL in un'unica query.
 *
 * Regola:
 * - se entrambi presenti => $and
 * - se uno è vuoto => usa l'altro
 */
export function combineFilters<T = any>(
  baseFilter: FilterQuery<T>,
  accessFilter: FilterQuery<T>,
): FilterQuery<T> {
  const combined: FilterQuery<T>[] = [];

  if (baseFilter && Object.keys(baseFilter as any).length) combined.push(baseFilter);
  if (accessFilter && Object.keys(accessFilter as any).length) combined.push(accessFilter);

  return combined.length > 1
    ? ({ $and: combined } as any)
    : (combined[0] as any) || baseFilter || ({} as any);
}
