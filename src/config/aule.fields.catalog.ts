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

//Trello-Like: Sprint Concept
  sprintLabel: {
    label: "Sprint Label",
    type: "text"
  },
  inizioSprint: {
    label: "Inizio Sprint",
    type: "date"
  },
  fineSprint: {
    label: "Fine Sprint",
    type: "date"
  },
  statoAvanzamento: {
    label: "Stato Sprint",
    type: "text",
  },
  valutazioneSprint: {
    label: "Valutazione Sprint",
    type: "select",
    options: [
      ["obbiettivi non raggiunti", "Obbiettivi non Raggiunti"],
      ["obbiettivi parzialmente raggiunti", "Obbiettivi Parzialmente Raggiunti"],
      ["obbiettivi totalmente raggiunti", "Obbiettivi Totalmente Raggiunti"],
      ["aspettative superate", "Aspettative Superate"],
    ]
  },
  descrizioneSprint: {
    label: "Descrizione Sprint",
    type: "textarea"
  },
  obbiettiviSprint: {
    label: "Obbiettivi Sprint",
    type: "textarea"
  }

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
  azioneAttesa: {
    label: "Azione Attesa",
    type: "text",
  }
} as const;

export type AulaPartecipanteFieldKey =
  keyof typeof AULA_PARTECIPANTE_FIELD_CATALOG;
