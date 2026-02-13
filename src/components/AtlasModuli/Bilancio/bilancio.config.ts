export type DestinazioneKey = "ricercaesviluppo" | "marketing" | "utile_azienda" | "utile_soci" | "spese_commerciali";

export type DestinazioneItem = {
  key: DestinazioneKey;
  label: string;
  pct: number; // 0..1
  color: string;
};

/**
 * ✅ CONFIG: percentuali destinazione
 * Somma ideale = 1.0
 * Se non è 1.0, normalizziamo automaticamente (vedi compute).
 */
export const DESTINAZIONE_CONFIG: DestinazioneItem[] = [
  { key: "ricercaesviluppo", label: "Ricerca e Sviluppo", pct: 0.15, color: "#7C3AED" },
  { key: "marketing", label: "Marketing e Pubblicità", pct: 0.15, color: "#38BDF8" },
  { key: "utile_azienda", label: "Utile Aziendale", pct: 0.30, color: "#22C55E" },
  { key: "utile_soci", label: "Utile Soci", pct: 0.20, color: "#FB7185" },
  { key: "spese_commerciali", label: "Spese Commerciali", pct: 0.20, color: "#ffa905" },
];

/** Aliquota simulatore tassa utile (richiesta: 26%) */
export const UTILE_TAX_RATE = 0.26;
