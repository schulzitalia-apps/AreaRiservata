// src/server-utils/service/Anagrafiche/list/builders/pagination.ts

/**
 * EVOLVE ATLAS — Builder Pagination (safeLimit / safeOffset)
 * ---------------------------------------------------------
 * Centralizza la sanitizzazione dei parametri di paginazione:
 * - limit: capped (max 200) per evitare query troppo costose
 * - offset: non negativo
 *
 * Nota:
 * - La paginazione a offset è OK per PMI e liste standard.
 * - Se in futuro serve infinite scroll robusto su dataset enormi,
 *   si può introdurre cursor pagination come variante.
 */
export function buildPagination(limit?: number, offset?: number) {
  const safeLimit = Math.min(typeof limit === "number" ? limit : 25, 200);
  const safeOffset = Math.max(0, typeof offset === "number" ? offset : 0);

  return { safeLimit, safeOffset };
}
