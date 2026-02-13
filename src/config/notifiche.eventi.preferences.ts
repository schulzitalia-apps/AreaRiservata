// src/config/notifiche.eventi.preferences.ts

import type { EventoTypeSlug } from "@/config/eventi.types.public";
import { EVENTO_TYPES } from "@/config/eventi.types.public";

export type PrefVisibilityMode =
  | "SEMPRE"
  | "FINESTRA"
  | "SOLO_PRIMA"
  | "SOLO_DOPO";

export type EventoNotificationPreference = {
  slug: EventoTypeSlug;

  /** switch principale */
  enabled: boolean;

  /** startAt = appuntamento, endAt = scadenza/deadline */
  base?: "startAt" | "endAt";

  /**
   * - SEMPRE: sempre visibile (sconsigliata)
   * - FINESTRA: [base - beforeDays, base + afterDays]
   * - SOLO_PRIMA: [base - beforeDays, base)
   * - SOLO_DOPO: (base, base + afterDays]
   */
  mode?: PrefVisibilityMode;

  beforeDays?: number;
  afterDays?: number;

  /** taglia l’afterDays se vuoi interrompere prima */
  stopAfterDays?: number;

  /** mostra anche un po' dopo come "passato" */
  includePast?: boolean;
  pastDays?: number;

  /** filtri semplici sui campi evento (data.stato) */
  excludeStatuses?: string[];

  /** notificare solo se esist ricordati alcuni campi data.<k> */
  requireFields?: string[];
};

const DEFAULT_PREF: Omit<EventoNotificationPreference, "slug"> = {
  enabled: true,

  // di default: notificami quando l’evento è vicino (prima)
  base: "startAt",
  mode: "FINESTRA",
  beforeDays: 4,

  // di default non mostro dopo, a meno che tu lo abiliti
  afterDays: 4,
  includePast: false,
  pastDays: 5,

  // evita spam su bozza/annullato
  excludeStatuses: ["bozza", "annullato"],
};

type PrefOverrides = Partial<Omit<EventoNotificationPreference, "slug">>;

/**
 * Override “per tipo”.
 * Qui metti solo ciò che differisce dal DEFAULT.
 */
const OVERRIDES: Partial<Record<EventoTypeSlug, PrefOverrides>> = {

  // esempi (se ti servono)
  // ordine_merce: { beforeDays: 3 },
  // arrivo_merce: { beforeDays: 3 },
};

export const EVENTI_NOTIFICATION_PREFERENCES: readonly EventoNotificationPreference[] =
  EVENTO_TYPES.map((t) => {
    const slug = t.slug as EventoTypeSlug;
    return {
      slug,
      ...DEFAULT_PREF,
      ...(OVERRIDES[slug] ?? {}),
    };
  }) as readonly EventoNotificationPreference[];

/** helper comodo */
export function getEventoNotificationPreference(
  slug: EventoTypeSlug,
): EventoNotificationPreference | undefined {
  return EVENTI_NOTIFICATION_PREFERENCES.find((p) => p.slug === slug);
}
