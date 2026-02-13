import { ROLES } from "@/types/roles";

/**
 * Config piattaforma "base":
 * - dati testuali generali
 * - lista RUOLI disponibili (usata anche per visibilityRole)
 * - lista globale delle CATEGORIE DOCUMENTO
 *
 * NB:
 *  - le anagrafiche per tipo scelgono un sottoinsieme di `documentTypes`
 *    nel loro config (anagrafiche.types.public.ts / anagrafiche.registry.ts)
 *  - il modulo "documenti" usa TUTTE le categorie definite qui.
 */

export const platformConfig = {
  platformName: "Schulz AREA RISERVATA",
  mainSectionName: "Area Riservata",
  signInButtonLabel: "Accedi",
  breadcrumbSignIn: "Accedi all'Area Riservata'",
  platformDescription: "L'area per la gestione dei documenti di Schulz",

  /**
   * Path di redirect dopo il login con successo.
   * Puoi modificarlo in base alla piattaforma (es. "/dashboard", "/home", ecc.).
   */
  signInRedirectPath: "/calendar",

  /**
   * Ruoli applicativi disponibili.
   * Vengono dal file "@/types/roles" e li
   * riesportiamo qui per comodità.
   */
  ROLES,

  /**
   * Categorie documento GLOBALI.
   * - Usate dal modulo documenti (upload, filtri, admin)
   * - Ogni tipo di anagrafica può selezionare un sottoinsieme di queste
   *   come `documentTypes` nel proprio config.
   *
   * Qui sono incluse tutte le categorie che abbiamo usato
   * in:
   *  - anagrafiche.types.public.ts (Persone, Clienti, Contatti, Ordini, Acquisti…)
   *  - vecchia config documenti
   */
  documentTypes: [
    // Flusso ordine / fatturazione
    "ordineAcquisto",
    "confermaOrdine",
    "fattura",
    "ricevutaPagamento",
    "preventivo",

    // Documenti tecnici / prodotto
    "documentoTecnico",
    "relazioneTecnica",
    "schedaProdotto",
    "manualeOperativo",

    // Documenti Eventi
    "documento",
    "nota",
    "allegato",

    // Catch-all
    "altro",
  ] as const,
} as const;

// Tipi derivati comodi in giro per l’app
export type PlatformConfig = typeof platformConfig;

/** Categoria documento singola (string union) */
export type DocumentCategory = (typeof platformConfig.documentTypes)[number];

/** Ruolo applicativo singolo (string union) */
export type Role = (typeof platformConfig.ROLES)[number];
