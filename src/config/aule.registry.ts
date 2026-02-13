// src/config/aule.registry.ts

import {
  AULE_TYPES,
  type PublicAulaTypeDef,
  type AulaPreviewCfg,
  type AulaPartecipantePreviewCfg,
} from "./aule.types.public";
import {
  AULA_FIELD_CATALOG,
  type AulaFieldKey,
  type AulaFieldDef,
  AULA_PARTECIPANTE_FIELD_CATALOG,
  type AulaPartecipanteFieldKey,
  type AulaPartecipanteFieldDef,
} from "./aule.fields.catalog";
import { platformConfig } from "./platform.config";

/* ----------------------------- TIPI RISOLTI ----------------------------- */

export type ResolvedAulaPreview = {
  title: AulaFieldKey[];
  subtitle: AulaFieldKey[];
  searchIn: AulaFieldKey[];
};

export type ResolvedPartecipantePreview = {
  title: AulaPartecipanteFieldKey[];
  subtitle: AulaPartecipanteFieldKey[];
};

/**
 * Def completo usato dal resto dell'app
 */
export type AulaDef = Omit<
  PublicAulaTypeDef,
  | "fields"
  | "preview"
  | "partecipanteFields"
  | "partecipantePreview"
  | "documentTypes"
  | "detailCard"
> & {
  fields: Record<AulaFieldKey, AulaFieldDef>;
  preview: ResolvedAulaPreview;

  partecipanteFields: AulaPartecipanteFieldKey[];
  partecipanteFieldDefs: Record<
    AulaPartecipanteFieldKey,
    AulaPartecipanteFieldDef
  >;
  partecipantePreview: ResolvedPartecipantePreview;

  documentTypes: readonly string[];
  visibilityOptions: readonly [string, string][];
  collection: string;

  detailCard: {
    coverSrc: string;
    avatarSrc: string;
    headerVariant: "cover-avatar" | "avatar-only" | "none";
    avatarSize: "small" | "medium" | "large";
    hoverEffect: boolean;
  };
};

const REGISTRY: Record<string, AulaDef> = {};

/* ------------------------- DEFAULT DOCUMENT TYPES --------------------------- */

const DEFAULT_AULA_DOCUMENT_TYPES = [
  "altro",
  "confermaOrdine",
] as const;

/* ------------------------- DEFAULT DETAIL CARD ----------------------------- */

const DEFAULT_DETAIL_CARD = {
  coverSrc: "/images/illustration/cover/cover-03.png",
  avatarSrc: "/images/illustration/avatar/avatar-03.png",
  headerVariant: "cover-avatar" as const,
  avatarSize: "medium" as const,
  hoverEffect: true,
};

/* --------------------------- COSTRUZIONE REGISTRO -------------------------- */

for (const t of AULE_TYPES) {
  // campi aula
  const fields: Record<AulaFieldKey, AulaFieldDef> = {} as any;
  for (const key of t.fields) {
    fields[key] = AULA_FIELD_CATALOG[key];
  }

  // preview aula (con default)
  const rawPrev: AulaPreviewCfg = t.preview ?? {
    title: ["nomeCantiere"],
    subtitle: [],
    searchIn: ["nomeCantiere", "indirizzoCantiere"],
  };

  const preview: ResolvedAulaPreview = {
    title:
      rawPrev.title && rawPrev.title.length ? rawPrev.title : ["nomeCantiere"],
    subtitle: rawPrev.subtitle ?? [],
    searchIn:
      rawPrev.searchIn && rawPrev.searchIn.length
        ? rawPrev.searchIn
        : rawPrev.title ?? ["nomeAula"],
  };

  // campi partecipante (default: ruolo, note, dataIscrizione se esistono)
  const defaultPartecipanteKeys: AulaPartecipanteFieldKey[] = (
    ["ruolo", "note", "dataIscrizione"] as AulaPartecipanteFieldKey[]
  ).filter((k) => k in AULA_PARTECIPANTE_FIELD_CATALOG);

  const partecipanteFields: AulaPartecipanteFieldKey[] =
    t.partecipanteFields && t.partecipanteFields.length
      ? t.partecipanteFields
      : defaultPartecipanteKeys;

  const partecipanteFieldDefs: Record<
    AulaPartecipanteFieldKey,
    AulaPartecipanteFieldDef
  > = {} as any;

  for (const k of partecipanteFields) {
    partecipanteFieldDefs[k] = AULA_PARTECIPANTE_FIELD_CATALOG[k];
  }

  const rawPPrev: AulaPartecipantePreviewCfg = t.partecipantePreview ?? {};

  const partecipantePreview: ResolvedPartecipantePreview = {
    title:
      rawPPrev.title && rawPPrev.title.length
        ? rawPPrev.title
        : (["ruolo"] as AulaPartecipanteFieldKey[]),
    subtitle: rawPPrev.subtitle ?? [],
  };

  const collection = `aule__${t.slug}`;

  // documentTypes: specifico oppure default
  const documentTypes = (t.documentTypes?.length
    ? t.documentTypes
    : DEFAULT_AULA_DOCUMENT_TYPES) as readonly string[];

  // visibilityOptions: speculare alle anagrafiche
  const visibilityOptions: readonly [string, string][] = [
    ["", "Solo proprietario"],
    ...Array.from(platformConfig.ROLES).map(
      (r) => [r, r] as [string, string],
    ),
  ];

  // detailCard: specifico per tipo oppure default comune
  const detailCard = {
    coverSrc: t.detailCard?.coverSrc ?? DEFAULT_DETAIL_CARD.coverSrc,
    avatarSrc: t.detailCard?.avatarSrc ?? DEFAULT_DETAIL_CARD.avatarSrc,
    headerVariant:
      t.detailCard?.headerVariant ?? DEFAULT_DETAIL_CARD.headerVariant,
    avatarSize: t.detailCard?.avatarSize ?? DEFAULT_DETAIL_CARD.avatarSize,
    hoverEffect:
      t.detailCard?.hoverEffect ?? DEFAULT_DETAIL_CARD.hoverEffect,
  };

  REGISTRY[t.slug] = {
    ...t,
    fields,
    preview,
    partecipanteFields,
    partecipanteFieldDefs,
    partecipantePreview,
    collection,
    documentTypes,
    visibilityOptions,
    detailCard,
  };
}

/* ------------------------------- EXPORT API -------------------------------- */

export function getAulaDef(slug: string): AulaDef {
  const def = REGISTRY[slug];
  if (!def) throw new Error(`Tipo aula sconosciuto: ${slug}`);
  return def;
}

export function listAuleDef(): AulaDef[] {
  return Object.values(REGISTRY);
}

/**
 * Helper legacy usato dalla sidebar.
 * Ritorna solo slug + label (come prima di queste modifiche).
 */
export function getAuleList(): { slug: string; label: string }[] {
  return listAuleDef().map((d) => ({ slug: d.slug, label: d.label }));
}
