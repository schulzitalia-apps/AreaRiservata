// src/config/eventi.fields.catalog.ts

export type EventoFieldInputType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "select";

export type EventoSelectOpt = readonly [string, string];

export type EventoFieldDef = {
  label: string;
  type: EventoFieldInputType;
  enabled?: boolean;
  locked?: boolean;
  max?: number;
  hint?: string;
  options?: readonly EventoSelectOpt[];
};

// === CATALOGO COMPLETO CAMPI EVENTO (ridotto agli Avvisi) ===
// (chiavi in italiano, etichette in italiano)
export const EVENTO_FIELD_CATALOG = {
  titolo: {
    label: "Titolo",
    type: "text",
    max: 200,
  },

  descrizione: {
    label: "Descrizione",
    type: "textarea",
    max: 5000,
  },

  dataEvento: {
    label: "Data",
    type: "date",
    hint: "Data dell'avviso.",
  },

  stato: {
    label: "Stato evento",
    type: "select",
    options: [
      ["bozza", "Bozza"],
      ["programmato", "Programmato"],
      ["in_corso", "In corso"],
      ["completato", "Completato"],
      ["annullato", "Annullato"],
    ],
  },

  priorita: {
    label: "Priorità",
    type: "select",
    options: [
      ["low", "Bassa"],
      ["normal", "Normale"],
      ["high", "Alta"],
      ["urgent", "Urgente"],
    ],
  },

  tipoAvviso: {
    label: "Tipologia avviso",
    type: "select",
    options: [
      ["generico", "Generico"],
      ["consegna", "Avviso di Consegna"],
      ["tecnico", "Avviso Tecnico"],
      ["commerciale", "Avviso Commerciale"],
    ],
  },
} as const;

export type EventoFieldKey = keyof typeof EVENTO_FIELD_CATALOG;
