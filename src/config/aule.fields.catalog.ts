// src/config/aule.fields.catalog.ts

export type AulaFieldInputType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "number";

export type AulaSelectOpt = readonly [string, string];

export type AulaFieldDef = {
  label: string;
  type: AulaFieldInputType;
  max?: number;
  hint?: string;
  options?: readonly AulaSelectOpt[];
};

export const AULA_FIELD_CATALOG = {
  // CANTIERE
  nomeCantiere: {
    label: "Nome Cantiere",
    type: "text",
    max: 200,
  },
  indirizzoCantiere: {
    label: "Indirizzo Cantiere",
    type: "text",
    max: 400,
  },
  dataCantiere: {
    label: "Data Cantiere",
    type: "date",
    max: 400,
  },

  // AGENTE (che raggruppa Clienti)
  nomeAgente: {
    label: "Nome",
    type: "text",
    max: 120,
  },
  cognomeAgente: {
    label: "Cognome",
    type: "text",
    max: 120,
  },
  emailAgente: {
    label: "Email",
    type: "text", // niente "email" nel tipo, quindi text
    max: 200,
  },
  indirizzoAgente: {
    label: "Indirizzo",
    type: "text",
    max: 400,
  },
  telefonoAgente: {
    label: "Telefono",
    type: "text", // niente "tel" nel tipo, quindi text
    max: 40,
  },

} as const;

export type AulaFieldKey = keyof typeof AULA_FIELD_CATALOG;

/* ------------------------------------------------------------------ */
/*               CATALOGHI PER I CAMPI PARTECIPANTE                   */
/* ------------------------------------------------------------------ */

export type AulaPartecipanteFieldInputType =
  | "text"
  | "textarea"
  | "date"
  | "number";

export type AulaPartecipanteFieldDef = {
  label: string;
  type: AulaPartecipanteFieldInputType;
  max?: number;
  hint?: string;
};

export const AULA_PARTECIPANTE_FIELD_CATALOG = {
  ruolo: {
    label: "Ruolo in aula",
    type: "text",
    max: 200,
  },
  note: {
    label: "Note sul partecipante",
    type: "textarea",
    max: 1000,
  },
  dataIscrizione: {
    label: "Data ingresso",
    type: "date",
  },
  voto: {
    label: "Voto Ottenuto",
    type: "number",
  },
} as const;

export type AulaPartecipanteFieldKey =
  keyof typeof AULA_PARTECIPANTE_FIELD_CATALOG;
