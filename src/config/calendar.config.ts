// src/components/AtlasModuli/Calendario/Calendario.config.ts

export type CalendarConfig = {
  /** ordine di apparizione dei tipi evento (slug) */
  colorOrder: string[];
  features: {
    /** mostra / nasconde "Modalità selezione" (switch + voce nel menu) */
    selectionMode: boolean;
  };
};

export const CALENDAR_CONFIG: CalendarConfig = {
  // metti qui gli slug nell'ordine che vuoi per filtri + colori
  colorOrder: [ "eventi", "avvisi_ferramenta", "avvisi_taglio", "avvisi_vetraggio", "avvisi_pronto", "consegna_prevista", "avvisi_speciale"],

  features: {
    selectionMode: false,
  },
};
