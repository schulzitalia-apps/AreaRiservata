/**
 * FILE "PULITO" PER LE AZIONI AUTO-EVENTO SULLE ANAGRAFICHE.
 */

import type { AnagraficaTypeSlug } from "./anagrafiche.types.public";
import type { FieldKey } from "./anagrafiche.fields.catalog";

import type {
  EventoTypeSlug,
  AllowedTimeKind,
} from "./eventi.types.public";
import type { EventoFieldKey } from "./eventi.fields.catalog";

import type {
  ActionScope,
  ActionVisibilityKind,
  ActionTriggerKind,
  ActionUiTone,
  ActionTimeSource,
  ActionCondition,
} from "./actions.shared";

import { cond } from "./actions.conditions.helpers";

/**
 * COME COLLEGARE L'ANAGRAFICA AGLI EVENTI GENERATI.
 */
export type AnagraficaPartecipantiStrategy =
  | "NESSUNO"
  | "ANAGRAFICA_PRINCIPALE";

export type PublicAnagraficaActionDef = {
  scope: Extract<ActionScope, "ANAGRAFICA">;
  id: string;
  label: string;
  description?: string;
  anagraficaType: AnagraficaTypeSlug;
  field: FieldKey;
  trigger: ActionTriggerKind;
  eventType: EventoTypeSlug;
  timeKind: Extract<AllowedTimeKind, "point" | "deadline" | "interval">;
  visibility: ActionVisibilityKind;
  windowDaysBefore?: number;
  windowDaysAfter?: number;
  titleTemplate: string;
  descriptionTemplate?: string;
  prefillEventoData?: Partial<Record<EventoFieldKey, any>>;
  partecipantiStrategy: AnagraficaPartecipantiStrategy;
  uiTone?: ActionUiTone;

  /**
   * DA DOVE PRENDERE LA DATA PER L'EVENTO.
   * - "field" (default): usa il campo indicato da `field` (che deve essere di tipo date)
   * - "now":             usa il giorno in cui si triggera l'azione
   */
  timeSource?: ActionTimeSource;

  /**
   * CONDIZIONE OPZIONALE PER FAR SCATTARE L'AZIONE.
   *
   * Esempi:
   *  - totale >= 1000
   *  - stato IN ["confermato","parzialmente-confermato"]
   *  - dataFine >= dataInizio
   *
   * Se omessa → considerata sempre vera.
   */
  condition?: ActionCondition;
};

/**
 * ELENCO DELLE AZIONI AUTO-EVENTO PER LE ANAGRAFICHE.
 */
export const ANAGRAFICHE_ACTIONS: readonly PublicAnagraficaActionDef[] = [
  /* ------------------------------------------------------------------
   *  AVVISO DI CONSEGNA SU CONFERMA D'ORDINE
   *
   *  QUANDO:
   *    quando salvo il campo inizioConsegna su un'anagrafica di tipo
   *    "conferme-ordine".
   *
   *  COSA FA:
   *    crea un evento di tipo "avvisi_pronto" con timeKind "deadline",
   *    visibile in una FINESTRA da 20 giorni prima a 5 giorni dopo
   *    la data di inizio consegna prevista.
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__avviso_consegna",
    label: "Avviso di consegna",
    description:
      "Crea un avviso di consegna collegato alla conferma d'ordine, visibile da 20 giorni prima a 5 giorni dopo l'inizio consegna.",

    anagraficaType: "conferme-ordine",
    field: "inizioConsegna",
    trigger: "ON_SAVE",

    eventType: "avvisi_pronto",
    timeKind: "deadline",
    visibility: "FINESTRA",
    windowDaysBefore: 20,
    windowDaysAfter: 5,

    // Usa il campo data come base temporale (comportamento classico)
    timeSource: "field",

    uiTone: "warning",

    titleTemplate:
      "CDO {{anagrafica.numeroOrdine}} - Spostamento della consegna)",
    descriptionTemplate:
      "La sua consegna prevista {{anagrafica.numeroOrdine}} con riferimento: {{anagrafica.riferimento}} sara' spostata alla data indicata nell'evento.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "high",
      tipoAvviso: "consegna",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",
  },

  /* ------------------------------------------------------------------
   *  CAMBIO STATO COMMESSA → TAGLIO
   *
   *  QUANDO:
   *    quando il campo statoAvanzamento di una "conferma-ordine"
   *    passa (ON_CHANGE) al valore "Taglio".
   *
   *  COSA FA:
   *    crea un evento di tipo "avvisi_taglio" con data = oggi (timeSource="now"),
   *    con testo:
   *      "Gentile cliente, lo stato di avanzamento della commessa NNN
   *       è passato a: Taglio."
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__stato_taglio",
    label: "Cambio stato commessa: Taglio",
    description:
      "Crea un avviso quando la commessa entra in stato Taglio.",

    anagraficaType: "conferme-ordine",
    field: "statoAvanzamento",
    trigger: "ON_CHANGE",

    eventType: "avvisi_taglio",
    timeKind: "point",
    visibility: "SEMPRE",

    // Evento datato “oggi” (giorno del cambio stato)
    timeSource: "now",

    uiTone: "info",

    titleTemplate:
      "Commessa {{anagrafica.numeroOrdine}} - stato: {{anagrafica.statoAvanzamento}}",
    descriptionTemplate:
      "Gentile cliente,\n" +
      "lo stato di avanzamento della commessa {{anagrafica.numeroOrdine}} è passato a: {{anagrafica.statoAvanzamento}}.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "medium",
      tipoAvviso: "taglio",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",

    // Scatta solo se lo stato è esattamente "Taglio"
    condition: cond.eqString(
      cond.path("anagrafica.statoAvanzamento"),
      "Taglio",
    ),
  },

  /* ------------------------------------------------------------------
   *  CAMBIO STATO COMMESSA → VETRAGGIO
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__stato_vetraggio",
    label: "Cambio stato commessa: Vetraggio",
    description:
      "Crea un avviso quando la commessa entra in stato Vetraggio.",

    anagraficaType: "conferme-ordine",
    field: "statoAvanzamento",
    trigger: "ON_CHANGE",

    eventType: "avvisi_vetraggio",
    timeKind: "point",
    visibility: "SEMPRE",

    timeSource: "now",

    uiTone: "info",

    titleTemplate:
      "Commessa {{anagrafica.numeroOrdine}} - stato: {{anagrafica.statoAvanzamento}}",
    descriptionTemplate:
      "Gentile cliente,\n" +
      "lo stato di avanzamento della commessa {{anagrafica.numeroOrdine}} è passato a: {{anagrafica.statoAvanzamento}}.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "medium",
      tipoAvviso: "vetraggio",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",

    condition: cond.eqString(
      cond.path("anagrafica.statoAvanzamento"),
      "Vetraggio",
    ),
  },

  /* ------------------------------------------------------------------
   *  CAMBIO STATO COMMESSA → IMBALLAGGIO
   *
   *  (mappato su eventType = "avvisi_pronto" / "Pronto a Magazzino")
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__stato_imballaggio",
    label: "Cambio stato commessa: Imballaggio",
    description:
      "Crea un avviso quando la commessa entra in stato Imballaggio.",

    anagraficaType: "conferme-ordine",
    field: "statoAvanzamento",
    trigger: "ON_CHANGE",

    eventType: "avvisi_pronto",
    timeKind: "point",
    visibility: "SEMPRE",

    timeSource: "now",

    uiTone: "info",

    titleTemplate:
      "Commessa {{anagrafica.numeroOrdine}} - stato: {{anagrafica.statoAvanzamento}}",
    descriptionTemplate:
      "Gentile cliente,\n" +
      "lo stato di avanzamento della commessa {{anagrafica.numeroOrdine}} è passato a: {{anagrafica.statoAvanzamento}}.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "medium",
      tipoAvviso: "imballaggio",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",

    condition: cond.eqString(
      cond.path("anagrafica.statoAvanzamento"),
      "Imballaggio",
    ),
  },

  /* ------------------------------------------------------------------
   *  CAMBIO STATO COMMESSA → SPEDIZIONE
   *
   *  (mappato su eventType = "consegna_prevista")
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__stato_spedizione",
    label: "Cambio stato commessa: Spedizione",
    description:
      "Crea un avviso quando la commessa entra in stato Spedizione.",

    anagraficaType: "conferme-ordine",
    field: "statoAvanzamento",
    trigger: "ON_CHANGE",

    eventType: "consegna_prevista",
    timeKind: "point",
    visibility: "SEMPRE",

    timeSource: "now",

    uiTone: "info",

    titleTemplate:
      "Commessa {{anagrafica.numeroOrdine}} - stato: {{anagrafica.statoAvanzamento}}",
    descriptionTemplate:
      "Gentile cliente,\n" +
      "lo stato di avanzamento della commessa {{anagrafica.numeroOrdine}} è passato a: {{anagrafica.statoAvanzamento}}.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "high",
      tipoAvviso: "spedizione",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",

    condition: cond.eqString(
      cond.path("anagrafica.statoAvanzamento"),
      "Spedizione",
    ),
  },

  /* ------------------------------------------------------------------
   *  CAMBIO STATO COMMESSA → FERRAMENTA
   *
   *  (mappato su eventType = "avvisi_ferramenta")
   * ------------------------------------------------------------------ */
  {
    scope: "ANAGRAFICA",

    id: "conferme-ordine__stato_ferramenta",
    label: "Cambio stato commessa: Ferramenta",
    description:
      "Crea un avviso quando la commessa entra in stato Ferramenta.",

    anagraficaType: "conferme-ordine",
    field: "statoAvanzamento",
    trigger: "ON_CHANGE",

    eventType: "avvisi_ferramenta",
    timeKind: "point",
    visibility: "SEMPRE",

    timeSource: "now",

    uiTone: "info",

    titleTemplate:
      "Commessa {{anagrafica.numeroOrdine}} - stato: {{anagrafica.statoAvanzamento}}",
    descriptionTemplate:
      "Gentile cliente,\n" +
      "lo stato di avanzamento della commessa {{anagrafica.numeroOrdine}} è passato a: {{anagrafica.statoAvanzamento}}.",

    prefillEventoData: {
      stato: "programmato",
      priorita: "medium",
      tipoAvviso: "ferramenta",
    },

    partecipantiStrategy: "ANAGRAFICA_PRINCIPALE",

    condition: cond.eqString(
      cond.path("anagrafica.statoAvanzamento"),
      "Ferramenta",
    ),
  },
];


/* ------------------------------------------------------------------
 *  COME AGGIUNGERE UNA NUOVA AZIONE:
 *
 *  1) Copia l'oggetto qui sopra.
 *  2) Cambia:
 *     - id                → univoco (es. "clienti__followup_contratto")
 *     - label             → nome leggibile
 *     - description       → spiegazione
 *     - anagraficaType    → slug del tipo anagrafica (es. "clienti")
 *     - field             → un campo di FIELD_CATALOG (può essere anche non data se timeSource="now")
 *     - trigger           → ON_SAVE / ON_CHANGE / ON_FIRST_SET
 *     - eventType         → tipo evento (es. "avvisi")
 *     - timeKind          → "point" | "deadline" | "interval"
 *     - timeSource        → "field" (usa campo data) | "now" (usa oggi)
 *     - visibility        → "SEMPRE" | "DOPO_DATA" | "FINO_A_DATA" | "FINESTRA"
 *     - windowDaysBefore/After (se usi "FINESTRA")
 *     - titleTemplate / descriptionTemplate
 *     - prefillEventoData (facoltativo)
 *     - partecipantiStrategy
 *     - uiTone (facoltativo, per la grafica)
 *     - condition         → opzionale, logica aggiuntiva (numeri, stati, ecc.)
 *  3) Salva il file.
 *  4) Se qualcosa non torna (campo sbagliato, tipo non valido, ecc.),
 *     il sistema segnalerà l'errore a runtime.
 * ------------------------------------------------------------------ */

