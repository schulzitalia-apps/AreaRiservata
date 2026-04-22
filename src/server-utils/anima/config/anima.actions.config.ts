export type AnimaActionFieldDefinition = {
  key: string;
  required: boolean;
  description: string;
  missingLabel?: string;
};

export type AnimaActionDefinition = {
  key: string;
  label: string;
  executeWhenRequiredFieldsArePresent: boolean;
  fields: readonly AnimaActionFieldDefinition[];
};

export const ANIMA_ACTIONS_CONFIG = {
  event_create: {
    key: "event_create",
    label: "Creazione evento",
    executeWhenRequiredFieldsArePresent: true,
    fields: [
      {
        key: "eventType",
        required: true,
        description: "Tipo evento selezionato o risolto.",
        missingLabel: "tipo evento",
      },
      {
        key: "title",
        required: true,
        description: "Titolo leggibile dell'evento.",
        missingLabel: "titolo",
      },
      {
        key: "startAt",
        required: true,
        description: "Data/orario iniziale dell'evento.",
        missingLabel: "data/orario",
      },
      {
        key: "notes",
        required: false,
        description: "Note opzionali dell'evento.",
      },
      {
        key: "endAt",
        required: false,
        description: "Orario finale, se l'evento e un intervallo.",
      },
      {
        key: "timeKind",
        required: false,
        description: "point o interval.",
      },
    ],
  },
  generic_mail: {
    key: "generic_mail",
    label: "Invio mail generica",
    executeWhenRequiredFieldsArePresent: true,
    fields: [
      {
        key: "to",
        required: true,
        description: "Indirizzo email destinatario.",
        missingLabel: "destinatario",
      },
      {
        key: "message",
        required: true,
        description: "Messaggio email da inviare.",
        missingLabel: "contenuto",
      },
      {
        key: "subject",
        required: false,
        description: "Oggetto opzionale della mail.",
      },
    ],
  },
} as const satisfies Record<string, AnimaActionDefinition>;

export type AnimaActionKey = keyof typeof ANIMA_ACTIONS_CONFIG;
