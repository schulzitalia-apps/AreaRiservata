/**
 * FILE "PULITO" PER LE AZIONI AUTO-EVENTO SULLE AULE (GRUPPI / CORSI).
 *
 * Qui definisci REGOLE del tipo:
 *
 *   "Quando salvo il campo DATA_X su un certo tipo di aula,
 *    crea automaticamente un EVENTO collegato all'aula
 *    e, se vuoi, a tutti i partecipanti".
 *
 * Anche qui:
 *  - l'evento viene creato SUBITO al salvataggio,
 *  - il "quando mostrarlo" è gestito da frontend/API tramite visibility.
 *
 * ⚠️ DA TOCCARE:
 *   - l'elenco AULE_ACTIONS in fondo al file
 *   - i valori dei singoli oggetti (id, aulaType, field, eventType, ecc.)
 *
 * ⚠️ DA NON TOCCARE:
 *   - i type e gli import in alto
 *   - il nome della costante AULE_ACTIONS
 */

import type { AulaTypeSlug } from "./aule.types.public";
import type {
  AulaFieldKey,
  AulaPartecipanteFieldKey,
} from "./aule.fields.catalog";

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

/**
 * COME COLLEGARE I PARTECIPANTI DELL'AULA AGLI EVENTI GENERATI.
 *
 * - "NESSUNO":
 *      l'evento non avrà partecipanti auto-agganciati.
 *
 * - "TUTTI_PARTECIPANTI_AULA":
 *      tutti i partecipanti dell'aula vengono aggiunti all'evento.
 */
export type AulaPartecipantiStrategy =
  | "NESSUNO"
  | "TUTTI_PARTECIPANTI_AULA";

/**
 * COME COLLEGARE L'AULA COME "GRUPPO" DELL'EVENTO.
 *
 * - "NONE":
 *      l'evento non avrà un gruppo principale collegato.
 *
 * - "AULA_COME_GRUPPO":
 *      l'evento avrà gruppo={ gruppoType: aulaTypeSlug, gruppoId: aulaId }.
 */
export type AulaGruppoStrategy =
  | "NONE"
  | "AULA_COME_GRUPPO";

/**
 * Definizione di UNA singola azione auto-evento collegata a un campo
 * di un certo tipo di aula.
 *
 * - field:            campo che "fa scattare" l'azione (anche non date)
 * - timeSource:
 *     - "field": usa il valore del campo (deve essere un campo data)
 *     - "now":   usa la data/ora attuale per l'evento
 *
 * - condition (opzionale):
 *     logica di business aggiuntiva (numeri, stati, confronti tra campi, ecc.)
 *     vedi ActionCondition in actions.shared.ts
 */
export type PublicAulaActionDef = {
  scope: Extract<ActionScope, "AULA">;
  id: string;
  label: string;
  description?: string;
  aulaType: AulaTypeSlug;
  field: AulaFieldKey | AulaPartecipanteFieldKey;
  trigger: ActionTriggerKind;
  eventType: EventoTypeSlug;
  timeKind: Extract<AllowedTimeKind, "point" | "deadline" | "interval">;
  visibility: ActionVisibilityKind;
  windowDaysBefore?: number;
  windowDaysAfter?: number;
  titleTemplate: string;
  descriptionTemplate?: string;
  prefillEventoData?: Partial<Record<EventoFieldKey, any>>;
  partecipantiStrategy: AulaPartecipantiStrategy;
  gruppoStrategy: AulaGruppoStrategy;
  uiTone?: ActionUiTone;

  /**
   * DA DOVE PRENDERE LA DATA PER L'EVENTO.
   * - "field" (default): usa il campo indicato da `field` (che deve essere di tipo date)
   * - "now":             usa il giorno in cui si triggera l'azione
   */
  timeSource?: ActionTimeSource;

  /**
   * CONDIZIONE OPZIONALE PER FAR SCATTARE L'AZIONE.
   * Se omessa → viene considerata sempre vera.
   */
  condition?: ActionCondition;
};

/**
 * ELENCO DELLE AZIONI AUTO-EVENTO PER LE AULE.
 *
 * 👇 Qui sotto puoi AGGIUNGERE / MODIFICARE le azioni.
 *
 * COME AGGIUNGERE UNA NUOVA AZIONE:
 *
 *  1) Copia uno degli esempi (interni) o creane uno da zero.
 *  2) Cambia:
 *     - id                → univoco (es. "cantieri__inizio_lavori")
 *     - label             → nome leggibile
 *     - description       → spiegazione
 *     - aulaType          → slug del tipo aula (es. "cantieri","agenti")
 *     - field             → un campo di AULA_FIELD_CATALOG o AULA_PARTECIPANTE_FIELD_CATALOG
 *     - trigger           → ON_SAVE / ON_CHANGE / ON_FIRST_SET
 *     - eventType         → tipo evento (es. "avvisi")
 *     - timeKind          → "point" | "deadline" | "interval"
 *     - timeSource        → "field" (usa campo data) | "now" (usa oggi)
 *     - visibility        → "SEMPRE" | "DOPO_DATA" | "FINO_A_DATA" | "FINESTRA"
 *     - windowDaysBefore/After (se usi "FINESTRA")
 *     - titleTemplate / descriptionTemplate
 *     - prefillEventoData (facoltativo)
 *     - partecipantiStrategy / gruppoStrategy
 *     - uiTone (facoltativo, per la grafica)
 *     - condition         → opzionale, logica aggiuntiva (numeri, stati, ecc.)
 */
export const AULE_ACTIONS: readonly PublicAulaActionDef[] = [
  // Esempio (commentato) di azione con timeSource="now":
  //
  // {
  //   scope: "AULA",
  //
  //   id: "corsi__chiusura_avviso",
  //   label: "Avviso chiusura corso",
  //   description: "Crea un evento il giorno in cui il corso passa a stato 'chiuso'.",
  //
  //   aulaType: "corsi-base",
  //   field: "statoCorso", // campo non data
  //   trigger: "ON_CHANGE",
  //
  //   eventType: "avvisi",
  //   timeKind: "interval",
  //   timeSource: "now",   // usa la data di oggi
  //
  //   visibility: "SEMPRE",
  //   windowDaysBefore: 0,
  //   windowDaysAfter: 0,
  //
  //   titleTemplate: "Corso {{aula.codice}} chiuso",
  //   descriptionTemplate: "Il corso {{aula.nome}} è stato chiuso il {{field}}.",
  //
  //   partecipantiStrategy: "TUTTI_PARTECIPANTI_AULA",
  //   gruppoStrategy: "AULA_COME_GRUPPO",
  //   uiTone: "warning",
  //
  //   // condition: ... (vedi helpers cond.*)
  // },
];
