// src/config/eventi.registry.ts

import * as Icons from "@/components/Layouts/sidebar/icons";
import { platformConfig } from "./platform.config";
import {
  EVENTO_FIELD_CATALOG,
  type EventoFieldKey,
  type EventoFieldDef,
} from "./eventi.fields.catalog";
import {
  EVENTO_TYPES,
  type EventoTypeSlug,
  type AllowedTimeKind,
} from "./eventi.types.public";

type EventoFieldMap = Record<EventoFieldKey, EventoFieldDef>;

const DEFAULT_PREVIEW = {
  title: ["titolo"] as EventoFieldKey[],
  subtitle: [] as EventoFieldKey[],
  searchIn: ["titolo", "descrizione"] as EventoFieldKey[],
};

// default se nel file pubblico non metti niente
const DEFAULT_EVENTO_DOCUMENT_TYPES = [
  "nota",
  "allegato",
  "altro",
] as const;

// default grafico header eventi
const DEFAULT_DETAIL_CARD = {
  coverSrc: "/images/illustration/cover/cover-01.png",
  avatarSrc: "/images/illustration/avatar/avatar-01.png",
  headerVariant: "cover-avatar" as "cover-avatar" | "avatar-only" | "none",
  avatarSize: "medium" as "small" | "medium" | "large",
  hoverEffect: true,
};

export type EventoDef = {
  slug: EventoTypeSlug;
  label: string;
  icon: React.ComponentType<any>;
  collection: string;
  fields: EventoFieldMap;

  preview: {
    title: EventoFieldKey[];
    subtitle: EventoFieldKey[];
    searchIn: EventoFieldKey[];
  };

  visibilityOptions: readonly [string, string][];

  allowedAnagraficaTypes: readonly string[];
  allowedAulaTypes: readonly string[];
  allowedTimeKinds: readonly AllowedTimeKind[];

  /** tipi di documento allegabili a questo tipo di evento */
  documentTypes: readonly string[];

  /** configurazione grafica header / floating card */
  detailCard: {
    coverSrc: string;
    avatarSrc: string;
    headerVariant: "cover-avatar" | "avatar-only" | "none";
    avatarSize: "small" | "medium" | "large";
    hoverEffect: boolean;
  };
};

function pickEventoFields(keys: EventoFieldKey[]): EventoFieldMap {
  const out: Partial<EventoFieldMap> = {};
  keys.forEach((k) => {
    out[k] = EVENTO_FIELD_CATALOG[k];
  });
  return out as EventoFieldMap;
}

export const EVENTI_REGISTRY: Record<EventoTypeSlug, EventoDef> =
  EVENTO_TYPES.reduce(
    (acc, t) => {
      const fields = pickEventoFields(t.fields);

      const preview = {
        title:
          t.preview?.title?.length ? t.preview!.title : DEFAULT_PREVIEW.title,
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

      const rawDetail = (t as any).detailCard ?? {};
      const detailCard = {
        coverSrc: rawDetail.coverSrc ?? DEFAULT_DETAIL_CARD.coverSrc,
        avatarSrc: rawDetail.avatarSrc ?? DEFAULT_DETAIL_CARD.avatarSrc,
        headerVariant:
          rawDetail.headerVariant ?? DEFAULT_DETAIL_CARD.headerVariant,
        avatarSize: rawDetail.avatarSize ?? DEFAULT_DETAIL_CARD.avatarSize,
        hoverEffect:
          rawDetail.hoverEffect === undefined
            ? DEFAULT_DETAIL_CARD.hoverEffect
            : !!rawDetail.hoverEffect,
      };

      acc[t.slug as EventoTypeSlug] = {
        slug: t.slug as EventoTypeSlug,
        label: t.label,
        icon: Icons.User, // o Icons.Calendar se preferisci
        collection: `eventi__${t.slug}`,
        fields,
        preview,
        visibilityOptions,
        allowedAnagraficaTypes: (t.allowedAnagraficaTypes ??
          []) as readonly string[],
        allowedAulaTypes: (t.allowedAulaTypes ?? []) as readonly string[],
        allowedTimeKinds: (t.allowedTimeKinds ??
          ["point", "interval", "deadline", "recurring"]) as readonly AllowedTimeKind[],
        documentTypes: (t.documentTypes?.length
          ? t.documentTypes
          : DEFAULT_EVENTO_DOCUMENT_TYPES) as readonly string[],
        detailCard,
      };

      return acc;
    },
    {} as Record<EventoTypeSlug, EventoDef>,
  );

export function getEventiList() {
  return Object.values(EVENTI_REGISTRY).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function getEventoDef(slug: string): EventoDef {
  const def = EVENTI_REGISTRY[slug as EventoTypeSlug];
  if (!def) throw new Error(`Tipo evento sconosciuto: ${slug}`);
  return def;
}
