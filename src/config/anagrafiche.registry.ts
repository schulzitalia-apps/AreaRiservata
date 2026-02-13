// src/config/anagrafiche.registry.ts

import * as Icons from "@/components/Layouts/sidebar/icons";
import { platformConfig } from "./platform.config";
import {
  FIELD_CATALOG,
  type FieldKey,
  type FieldDef,
} from "./anagrafiche.fields.catalog";
import {
  ANAGRAFICA_TYPES,
  type AnagraficaTypeSlug,
  type DetailCardConfig,          // 👈 NEW
} from "./anagrafiche.types.public";

type FieldMap = Record<FieldKey, FieldDef>;

const DEFAULT_DOCUMENT_TYPES = [
  "altro",
  "confermaOrdine",
] as const;

const DEFAULT_PREVIEW = {
  title: ["ragioneSociale", "nome"] as FieldKey[],
  subtitle: ["email", "telefono"] as FieldKey[],
  searchIn: [
    "nome",
    "cognome",
    "email",
    "telefono",
    "codiceFiscale",
  ] as FieldKey[],
};

/**
 * Definizione "interna" di un tipo di anagrafica,
 * usata dal codice applicativo.
 */
export type AnagraficaDef = {
  slug: AnagraficaTypeSlug;
  label: string;
  icon: React.ComponentType<any>;
  collection: string; // Mongo collection per questo tipo
  fields: FieldMap;   // mappa campi effettivamente utilizzati

  documentTypes: readonly string[];

  preview: {
    title: FieldKey[];
    subtitle: FieldKey[];
    searchIn: FieldKey[];
  };

  visibilityOptions: readonly [string, string][];

  /**
   * Indica se questo tipo di anagrafica può partecipare alle Aule.
   * (Propagato dal campo accettaAule nel file pubblico.)
   */
  accettaAule: boolean;

  /**
   * Configurazione grafica opzionale per la card di dettaglio.
   * (Propagata dal campo detailCard nel file pubblico.)
   */
  detailCard?: DetailCardConfig;    // 👈 NEW
};

function pickFields(keys: FieldKey[]): FieldMap {
  const out: Partial<FieldMap> = {};
  keys.forEach((k) => {
    out[k] = FIELD_CATALOG[k];
  });
  return out as FieldMap;
}

export const ANAGRAFICHE_REGISTRY: Record<AnagraficaTypeSlug, AnagraficaDef> =
  ANAGRAFICA_TYPES.reduce(
    (acc, t) => {
      const fields = pickFields(t.fields);

      const preview = {
        title:
          t.preview?.title?.length
            ? t.preview!.title
            : DEFAULT_PREVIEW.title,
        subtitle:
          t.preview?.subtitle?.length
            ? t.preview!.subtitle
            : DEFAULT_PREVIEW.subtitle,
        searchIn:
          t.preview?.searchIn?.length
            ? t.preview!.searchIn
            : DEFAULT_PREVIEW.searchIn,
      };

      const visibilityOptions: readonly [string, string][] = [
        ["", "Solo proprietario"],
        ...Array.from(platformConfig.ROLES).map(
          (r) => [r, r] as [string, string],
        ),
      ];

      acc[t.slug as AnagraficaTypeSlug] = {
        slug: t.slug as AnagraficaTypeSlug,
        label: t.label,
        icon: Icons.User,
        collection: `anagrafiche__${t.slug}`,
        fields,
        documentTypes: (t.documentTypes?.length
          ? t.documentTypes
          : DEFAULT_DOCUMENT_TYPES) as readonly string[],
        preview,
        visibilityOptions,
        accettaAule: !!t.accettaAule,
        detailCard: t.detailCard,   // 👈 NEW: propaghiamo la config UI
      };
      return acc;
    },
    {} as Record<AnagraficaTypeSlug, AnagraficaDef>,
  );

export function getAnagraficheList() {
  return Object.values(ANAGRAFICHE_REGISTRY).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function getAnagraficaDef(slug: string): AnagraficaDef {
  const def = ANAGRAFICHE_REGISTRY[slug as AnagraficaTypeSlug];
  if (!def) throw new Error(`Tipo anagrafica sconosciuto: ${slug}`);
  return def;
}
