// Store/models/azioni.ts

import type { EventoPreview } from "./eventi";

/**
 * Le "Azioni" sono eventi auto-generati (autoEvent)
 * che passano dal motore di visibilità.
 * Riutilizziamo la stessa shape di EventoPreview.
 */
export type AzionePreview = EventoPreview;

export type AzioneBucket = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: AzionePreview[];
  error?: string | null;
};

export type AzioniState = {
  byType: Record<string, AzioneBucket>;
};
