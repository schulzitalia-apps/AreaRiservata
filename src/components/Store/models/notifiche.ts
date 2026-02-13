// src/components/Store/models/notifiche.ts

import type { EventoPreview } from "./eventi";

/**
 * Notifiche "preferenze eventi":
 * sono basate su eventi normali (NON autoEvent),
 * filtrate lato server con config preferenze.
 */
export type NotificaPreferenzaPreview = EventoPreview & {
  /** Tipo evento (slug) */
  type: string;

  /** Categoria per distinguere lato UI */
  category: "preferenze_eventi";

  /** Stato calcolato dal motore (opzionale) */
  state: "UPCOMING" | "PAST" | null;
};

export type NotifichePreferenzeBucket = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: NotificaPreferenzaPreview[];
  error?: string | null;
};

export type NotifichePreferenzeState = {
  /**
   * bucket per tipo evento (slug).
   * Chiave = type (EventoTypeSlug).
   */
  byType: Record<string, NotifichePreferenzeBucket>;
};
