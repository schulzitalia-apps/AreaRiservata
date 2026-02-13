// src/server-utils/service/Anagrafiche/list/mappers/preview.ts
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { OwnerInfo } from "../joins/owners";

/**
 * EVOLVE ATLAS — Mapper Preview
 * ----------------------------
 * Trasforma i documenti Mongo (lean) nel DTO di preview usato dall’API/UI.
 *
 * Obiettivo:
 * - costruire `displayName` (title) e `subtitle` (subtitle)
 * - normalizzare `visibilityRoles` ad array
 * - aggiungere ownerName tramite ownerMap
 *
 * Nota:
 * - i mappers non fanno DB/fetch: solo trasformazione dati.
 */

export type AnagraficaPreview = {
  id: string;
  data: Record<string, any>;
  displayName: string;
  subtitle: string | null;
  updatedAt: string;
  visibilityRoles?: string[];
  ownerId?: string | null;
  ownerName?: string | null;
};

function joinVals(data: Record<string, any>, keys: FieldKey[]) {
  return (keys || [])
    .map((k) => data?.[k] ?? "")
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(String);
}

export function mapDocsToPreview(
  docs: any[],
  def: any,
  ownerMap: Map<string, OwnerInfo>,
): AnagraficaPreview[] {
  return (docs || []).map((m: any) => {
    const data = m?.data || {};

    const displayName = joinVals(data, def.preview.title).join(" ");
    const subtitle = joinVals(data, def.preview.subtitle || []).join(" · ") || null;

    const ownerIdStr = m?.owner ? String(m.owner) : null;
    const ownerInfo = ownerIdStr ? ownerMap.get(ownerIdStr) : undefined;

    return {
      id: String(m._id),
      data,
      displayName: displayName || "(senza titolo)",
      subtitle,
      updatedAt: m?.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
      visibilityRoles: Array.isArray(m?.visibilityRoles) ? m.visibilityRoles : [],
      ownerId: ownerIdStr,
      ownerName: ownerInfo?.name || null,
    };
  });
}
