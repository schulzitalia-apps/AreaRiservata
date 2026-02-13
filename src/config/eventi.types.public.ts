// src/config/eventi.types.public.ts

/**
 * FILE "PULITO" per chi non è programmatore.
 *
 * Qui definisci:
 *  - l'elenco dei tipi di evento (slug + label)
 *  - quali campi usare per ciascun tipo (scegliendo dal catalogo EVENTO_FIELD_CATALOG)
 *  - la preview (quali campi formano titolo/sottotitolo/ricerca)
 *  - quali tipi di anagrafica e di aula/gruppo può collegare
 *  - (opz) quali forme temporali consentite (una tantum, intervallo, scadenza, ricorrenza)
 */

import type { EventoFieldKey } from "./eventi.fields.catalog";

export type AllowedTimeKind = "point" | "interval" | "deadline" | "recurring";

type EventoPreviewCfg = {
  title: EventoFieldKey[];
  subtitle?: EventoFieldKey[];
  searchIn?: EventoFieldKey[];
};

type EventoDetailCardCfg = {
  /** immagine di copertina (se headerVariant = "cover-avatar") */
  coverSrc?: string;
  /** immagine avatar tondo */
  avatarSrc?: string;
  /** variante header: cover+avatar / solo avatar / nessuno */
  headerVariant?: "cover-avatar" | "avatar-only" | "none";
  /** dimensione avatar */
  avatarSize?: "small" | "medium" | "large";
  /** effetto hover ingrandimento sì/no */
  hoverEffect?: boolean;
};

export type PublicEventoTypeDef = {
  slug: string;                // es. "avvisi"
  label: string;               // etichetta nel menu
  fields: EventoFieldKey[];    // elenco campi (dal catalogo) per questo tipo
  preview?: EventoPreviewCfg;

  /**
   * Tipi di anagrafica che questo evento può collegare
   * (slug dal mondo anagrafiche: "clienti","conferme-ordine", ecc.)
   */
  allowedAnagraficaTypes?: string[];

  /**
   * Tipi di aula/gruppo che questo evento può usare come "gruppo principale"
   * (slug dei tuoi tipi aula/gruppo).
   */
  allowedAulaTypes?: string[];

  /**
   * Quali forme temporali sono consentite per questo tipo di evento.
   * Verranno mappate su timeKind a livello applicativo.
   */
  allowedTimeKinds?: AllowedTimeKind[];

  /**
   * Tipi di documenti allegabili agli eventi di questo tipo.
   * (stessa idea di anagrafiche/aule)
   */
  documentTypes?: string[];

  /**
   * Configurazione grafica della scheda dettaglio (header + avatar).
   */
  detailCard?: EventoDetailCardCfg;
};

export const EVENTO_TYPES: readonly PublicEventoTypeDef[] = [
  {
    slug: "eventi",
    label: "Eventi Schulz",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["agenti"],
    allowedTimeKinds: ["point"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "avvisi_taglio",
    label: "Inizio Taglio",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    // Collegabile alle nuove anagrafiche
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    // Se vuoi poter agganciare anche Cantieri/Agenti:
    allowedAulaTypes: ["cantieri", "agenti"],
    // Un avviso ha una data singola → point/deadline
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "avvisi_ferramenta",
    label: "Montaggio Ferramenta",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["cantieri", "agenti"],
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "avvisi_vetraggio",
    label: "Vetraggio",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["cantieri", "agenti"],
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "avvisi_pronto",
    label: "Pronto a Magazzino",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["cantieri", "agenti"],
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "consegna_prevista",
    label: "Consegna Prevista",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["cantieri", "agenti"],
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },
  {
    slug: "avvisi_speciale",
    label: "Avviso Commessa",
    fields: [
      "titolo",
      "descrizione",
      "stato",
      "priorita",
      "tipoAvviso",
    ],
    preview: {
      title: ["titolo"],
      subtitle: ["tipoAvviso", "priorita"],
      searchIn: ["titolo", "descrizione"],
    },
    allowedAnagraficaTypes: ["clienti", "conferme-ordine"],
    allowedAulaTypes: ["cantieri", "agenti"],
    allowedTimeKinds: ["point", "deadline"],
    documentTypes: ["documento", "screenshot", "altro"],
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-01.png",
      avatarSrc: "/images/illustration/avatar/avatar-01.png",
      headerVariant: "cover-avatar",
      avatarSize: "medium",
      hoverEffect: true,
    },
  },

] as const;

export type EventoTypeSlug = (typeof EVENTO_TYPES)[number]["slug"];
