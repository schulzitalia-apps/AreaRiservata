import mongoose from "mongoose";
import {
  FIELD_CATALOG,
  isReferenceField,
  isReferenceMultiField,
  type FieldKey,
} from "@/config/anagrafiche.fields.catalog";
import { ANAGRAFICHE_REGISTRY } from "@/config/anagrafiche.registry";
import { listAnagrafiche } from "@/server-utils/service/Anagrafiche/list";
import type { AuthContext } from "@/server-utils/lib/auth-context";

/**
 * Risolve dinamicamente le etichette delle anagrafiche basandosi sulla configurazione del registro.
 * Evita costanti hardcoded e garantisce che ogni ID sia associato al tipo corretto configurato nel catalogo.
 */
export async function resolveAtlasReferenceLabels(args: {
  /** Mappa di FieldKey -> array di ID da risolvere per quel campo */
  requests: Partial<Record<FieldKey, string[]>>;
  /** Eventuali ID extra da risolvere per tipi specifici (es. partecipanti eventi) */
  extraByType?: Record<string, string[]>;
  auth: AuthContext;
}): Promise<Record<string, string>> {
  const { requests, extraByType, auth } = args;
  const labelMap: Record<string, string> = {};

  // 1. Raggruppiamo tutti gli ID per targetSlug (tipo di anagrafica)
  // Questo ci permette di fare una sola query per tipo, indipendentemente da quanti campi puntano allo stesso tipo.
  const idsBySlug = new Map<string, Set<string>>();

  // Elaboriamo le richieste basate sui campi del catalogo
  for (const [fieldKey, ids] of Object.entries(requests)) {
    const fieldDef = FIELD_CATALOG[fieldKey as FieldKey];
    if (!isReferenceField(fieldDef) && !isReferenceMultiField(fieldDef)) continue;

    const targetSlug = fieldDef.reference.targetSlug;
    if (!idsBySlug.has(targetSlug)) idsBySlug.set(targetSlug, new Set());
    
    (ids ?? []).forEach(id => {
      if (mongoose.isValidObjectId(id)) idsBySlug.get(targetSlug)!.add(id);
    });
  }

  // Elaboriamo le richieste extra per tipo (es. partecipanti eventi dove lo slug è noto)
  if (extraByType) {
    for (const [slug, ids] of Object.entries(extraByType)) {
      if (!idsBySlug.has(slug)) idsBySlug.set(slug, new Set());
      (ids ?? []).forEach(id => {
        if (mongoose.isValidObjectId(id)) idsBySlug.get(slug)!.add(id);
      });
    }
  }

  if (idsBySlug.size === 0) return {};

  // 2. Performiamo le query raggruppate
  await Promise.all(
    Array.from(idsBySlug.entries()).map(async ([slug, idSet]) => {
      const ids = Array.from(idSet);
      if (ids.length === 0) return;

      const def = ANAGRAFICHE_REGISTRY[slug as any];
      if (!def) return;

      const titleFields = def.preview?.title || [];
      if (!titleFields.length) return;

      try {
        const result = await listAnagrafiche({
          type: slug,
          ids,
          fields: titleFields as any,
          limit: ids.length,
          offset: 0,
          auth,
        });

        for (const item of result.items ?? []) {
          const labelParts = titleFields
            .map(f => String(item.data?.[f] || "").trim())
            .filter(Boolean);
          
          labelMap[item.id] = labelParts.join(" ") || item.id;
        }
      } catch (err) {
        console.error(`[SprintTimelineResolver] Failed to resolve ids for slug ${slug}:`, err);
      }
    })
  );

  // 3. Fallback deterministico: se un ID non è stato risolto, restituiamo l'ID stesso
  // per evitare che l'UI mostri vuoti cosmici.
  for (const idSet of idsBySlug.values()) {
    for (const id of idSet) {
      if (!labelMap[id]) {
        labelMap[id] = id;
      }
    }
  }

  return labelMap;
}
