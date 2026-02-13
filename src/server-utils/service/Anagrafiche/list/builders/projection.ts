// src/server-utils/service/Anagrafiche/list/builders/projection.ts
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

/**
 * EVOLVE ATLAS — Builder Projection (preview + dinamica)
 * -----------------------------------------------------
 * Costruisce la projection per la list.
 *
 * Comportamento:
 * - default (fields assente/vuoto): preview projection (title/subtitle/searchIn)
 * - dinamico (fields presente): include SOLO data.<fields> richiesti,
 *   whitelistati sui campi definiti dal tipo (def.fields).
 *
 * Obiettivo:
 * - prendere SOLO i campi necessari alla UI (riduce payload e tempo)
 * - includere sempre:
 *   - data.<keys> (preview o subset dinamico)
 *   - owner (per join owners)
 *   - updatedAt (sorting/visualizzazione)
 *   - visibilityRoles (badge/diagnostica/permessi)
 *
 * Nota:
 * - i campi `data.*` sono dinamici; la projection li seleziona in modo esplicito.
 * - `fields` viene sanitizzato (dedupe + whitelist + cap).
 */

const MAX_FIELDS = 50;

function getPreviewKeys(def: any): FieldKey[] {
  const previewKeys = new Set<FieldKey>([
    ...def.preview.title,
    ...(def.preview.subtitle || []),
    ...(def.preview.searchIn || []),
  ]);
  return Array.from(previewKeys);
}

function getTypeAllowedKeys(def: any): Set<FieldKey> {
  // def.fields è una FieldMap: Record<FieldKey, FieldDef>
  // quindi le chiavi rappresentano l'insieme dei campi supportati dal tipo.
  const keys = Object.keys(def.fields || {}) as FieldKey[];
  return new Set<FieldKey>(keys);
}

function normalizeRequestedFields(def: any, fields?: FieldKey[]): FieldKey[] {
  // default: preview keys (comportamento attuale)
  if (!fields || fields.length === 0) return getPreviewKeys(def);

  const allowed = getTypeAllowedKeys(def);

  // dedupe + whitelist + cap
  const uniq = Array.from(new Set(fields)).filter((k) => allowed.has(k));
  return uniq.slice(0, MAX_FIELDS);
}

export function buildPreviewProjection(def: any, fields?: FieldKey[]) {
  const keys = normalizeRequestedFields(def, fields);

  const dataProjection: Record<string, 1> = {};
  keys.forEach((k) => {
    dataProjection[`data.${k}`] = 1;
  });

  return {
    ...dataProjection,
    owner: 1,
    updatedAt: 1,
    visibilityRoles: 1,
  } as const;
}
