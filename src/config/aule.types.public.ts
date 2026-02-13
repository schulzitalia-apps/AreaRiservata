// src/config/aule.types.public.ts

import type {
  AulaFieldKey,
  AulaPartecipanteFieldKey,
} from "./aule.fields.catalog";
import type { AnagraficaTypeSlug } from "./anagrafiche.types.public";
import type { Role } from "./platform.config";

export type AulaPreviewCfg = {
  title: AulaFieldKey[];
  subtitle?: AulaFieldKey[];
  searchIn?: AulaFieldKey[];
};

export type AulaPartecipantePreviewCfg = {
  title?: AulaPartecipanteFieldKey[];
  subtitle?: AulaPartecipanteFieldKey[];
};

export type PublicAulaTypeDef = {
  slug: string; // es. "cantieri"
  label: string; // nome mostrato nel menu
  anagraficaSlug: AnagraficaTypeSlug; // tipo anagrafica collegato
  creatorRoles: Role[]; // ruoli che possono creare questo tipo di aula
  fields: AulaFieldKey[]; // campi usati (dal catalogo)
  preview?: AulaPreviewCfg; // opzionale

  /**
   * Tipi di documento allegabile all'Aula.
   * Se non specificato, useremo una lista di default in aule.registry.ts
   * (es. "materialeDidattico", "registroPresenze", ...).
   */
  documentTypes?: string[];

  /**
   * Config dei PARTECIPANTI
   * - quali campi del catalogo usare
   * - come comporre la preview (titolo/sottotitolo)
   */
  partecipanteFields?: AulaPartecipanteFieldKey[];
  partecipantePreview?: AulaPartecipantePreviewCfg;

  /**
   * Aspetto grafico della scheda dettaglio (view / edit),
   * stesso schema di Anagrafiche.
   */
  detailCard?: {
    coverSrc?: string;
    avatarSrc?: string;
    headerVariant?: "cover-avatar" | "avatar-only" | "none";
    avatarSize?: "small" | "medium" | "large";
    hoverEffect?: boolean;
  };
};

export const AULE_TYPES: readonly PublicAulaTypeDef[] = [
  /* ------------------------------------------------------------------ */
  /*                             CANTIERE                               */
  /* ------------------------------------------------------------------ */
  {
    slug: "cantieri",
    label: "Cantieri",
    // raggruppa Conferme d'Ordine
    anagraficaSlug: "conferme-ordine",
    creatorRoles: ["Super", "Amministrazione"],

    fields: [
      "nomeCantiere",
      "indirizzoCantiere",
    ],

    preview: {
      title: ["nomeCantiere"],
      subtitle: ["indirizzoCantiere"],
      searchIn: ["nomeCantiere", "indirizzoCantiere"],
    },

    // stile header come ora
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-03.png",
      avatarSrc: "/images/illustration/avatar/avatar-03.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },

    // partecipanteFields / partecipantePreview non specificati:
    // userai i default (es. ruolo + note + dataIscrizione)
  },

  /* ------------------------------------------------------------------ */
  /*                               AGENTE                               */
  /* ------------------------------------------------------------------ */
  {
    slug: "agenti",
    label: "Agenti",
    // raggruppa Clienti
    anagraficaSlug: "clienti",
    creatorRoles: ["Super", "Commerciale"],

    fields: [
      "nomeAgente",
      "cognomeAgente",
      "emailAgente",
      "indirizzoAgente",
      "telefonoAgente",
    ],

    preview: {
      title: ["nomeAgente"],
      subtitle: ["emailAgente"],
      searchIn: [
        "nomeAgente",
        "cognomeAgente",
        "emailAgente",
        "indirizzoAgente",
        "telefonoAgente",
      ],
    },

    // stesso stile header per ora
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-03.png",
      avatarSrc: "/images/illustration/avatar/avatar-03.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
] as const;

export type AulaTypeSlug = (typeof AULE_TYPES)[number]["slug"];
