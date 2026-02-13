// src/config/anagrafiche.fields.catalog.ts

/**
 * EVOLVE ATLAS — Field Catalog
 * ----------------------------
 * Tipi di campo config-driven per:
 * - FE: rendering + validazioni base
 * - BE: casting/normalizzazione per salvare dati "conformi" (data è Mixed)
 *
 * Filosofia Atlas:
 * - `data` resta Mixed (flessibile)
 * - la conformità viene dalla configurazione (FieldDef) + logica BE
 * - per campi non applicabili: meglio NON salvare la chiave (sparse)
 */

/* ---------------------------------- TIPI ---------------------------------- */

export type FieldInputType =
/**
 * TEXT
 * - Natura: string
 * - Uso: qualunque testo breve (nome, codice, ragione sociale, ecc.)
 */
  | "text"

  /**
   * EMAIL
   * - Natura: string
   * - Uso: contatti (validazione FE; BE la tratta come string)
   */
  | "email"

  /**
   * TEL
   * - Natura: string
   * - Uso: telefono (validazione FE; BE la tratta come string)
   */
  | "tel"

  /**
   * NUMBER
   * - Natura: number (double)
   * - Uso: importi, quantità, metriche
   * - Nota: FE spesso manda string => BE cast a Number se possibile
   */
  | "number"

  /**
   * NUMBER ARRAY
   * - Natura: number[]
   * - Uso: lista di valori numerici (misure, serie di punti “mono-dimensione”)
   * - Nota: BE cast ogni entry; rimuove vuoti/non numerici
   */
  | "numberArray"

  /**
   * DATE
   * - Natura: Date (BSON Date)
   * - Uso: date senza ora rilevante (fattura, consegna, ecc.)
   * - Nota: FE manda ISO string => BE cast a Date
   */
  | "date"

  /**
   * RANGE DATE / DATE RANGE
   * - Natura: { start: Date; end: Date }
   * - Uso: periodi (contratti, validità, noleggi, ferie, dal/al)
   */
  | "rangeDate"

  /**
   * TEXTAREA
   * - Natura: string (lunga)
   * - Uso: note, descrizioni, testi PDF
   */
  | "textarea"

  /**
   * SELECT (single)
   * - Natura: string (valore tra options)
   * - Uso: stato, categoria singola
   */
  | "select"

  /**
   * MULTISELECT (array di select)
   * - Natura: string[]
   * - Uso: più categorie/label ma controllate (whitelist su options)
   */
  | "multiselect"

  /**
   * LABEL ARRAY (array di label libere)
   * - Natura: string[]
   * - Uso: tag liberi senza options (non whitelistati)
   */
  | "labelArray"

  /**
   * BOOLEAN
   * - Natura: boolean
   * - Uso: flag (attivo, pagato, confermato, ecc.)
   * - Nota: FE spesso manda "true"/"false" => BE cast
   */
  | "boolean"

  /**
   * REFERENCE (single)
   * - Natura: ObjectId
   * - Uso: relazione verso anagrafica/aula/evento
   */
  | "reference"

  /**
   * REFERENCE MULTI (array di reference)
   * - Natura: ObjectId[]
   * - Uso: relazione multipla (contatti di un cliente, articoli collegati, partecipanti)
   */
  | "referenceMulti"

  /**
   * RANGE NUMBER
   * - Natura: { from: number; to: number }
   * - Uso: range (prezzo min/max, età min/max, soglie)
   */
  | "rangeNumber"

  /**
   * GEO POINT
   * - Natura: { lat: number; lng: number }
   * - Uso: posizione su mappa (sede, cantiere, consegna)
   */
  | "geoPoint"

  /**
   * GEO POINT ARRAY
   * - Natura: GeoPoint[]
   * - Uso: percorso/traccia/insieme di punti (route, poligono semplice, tappe)
   */
  | "geoPointArray"

  /**
   * PAIR NUMBER (coppia numerica singola)
   * - Natura: { a: number; b: number }
   * - Uso: dimensioni (L,H), coordinate locali (x,y), misure tecniche (diametro,lunghezza)
   */
  | "pairNumber"

  /**
   * LABEL -> VALUE (string) PAIRS
   * - Natura: { label: string; value: string }[]
   * - Uso: specifiche tecniche / parametri “presentabili” senza inventare nuove chiavi
   */
  | "labelValuePairs"

  /**
   * ENUM MAP / KEY-VALUE NUMBER
   * - Natura: { key: string; value: number }[]
   * - Uso: breakdown numerici (costo per categoria, KPI per voce, ripartizioni)
   * - Nota: se vuoi chiave controllata, puoi anche legarla a options in futuro.
   */
  | "keyValueNumber"

  /**
   * ADDRESS (indirizzo strutturato)
   * - Natura: oggetto strutturato
   * - Uso: quando vuoi normalizzare indirizzi e/o avere indirizzi multipli
   */
  | "address";

/**
 * Per select/multiselect:
 * - tuple [value, label]
 */
export type SelectOpt = readonly [string, string];

export type ReferenceKind = "anagrafica" | "aula" | "evento";

export type ReferenceConfig = {
  kind: ReferenceKind;
  targetSlug: string;
  resourceBasePath?: string;
  previewField?: string;
};

/* -------------------------- TIPI VALORE (STRUTTURE) -------------------------- */

export type RangeNumber = {
  from: number;
  to: number;
};

export type RangeDate = {
  start: Date;
  end: Date;
};

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type PairNumber = {
  a: number;
  b: number;
};

export type LabelValuePair = {
  label: string;
  value: string;
};

export type KeyValueNumber = {
  key: string;
  value: number;
};

/**
 * Address
 * -------
 * Forma minima “gestionale-friendly”.
 * Se in futuro vuoi, puoi aggiungere:
 * - regione, nazione, coordinate, note consegna, ecc.
 */
export type Address = {
  street?: string;     // via/piazza + civico
  city?: string;       // città
  zip?: string;        // CAP
  province?: string;   // provincia
  country?: string;    // paese (default "IT" se vuoi)
  extra?: string;      // scala, interno, citofono, ecc.
};

/* -------------------------------- FieldDef -------------------------------- */

export type FieldDef = {
  label: string;
  type: FieldInputType;
  enabled?: boolean;
  locked?: boolean;

  /**
   * max:
   * - text/textarea: max chars
   * - number: max valore (se lo usi così) o vincolo UI
   */
  max?: number;

  hint?: string;

  /**
   * options:
   * - select/multiselect (whitelist FE)
   */
  options?: readonly SelectOpt[];

  /**
   * reference:
   * - reference/referenceMulti
   */
  reference?: ReferenceConfig;
};

/* ------------------------------ FIELD CATALOG ------------------------------ */

export const FIELD_CATALOG = {
    /* ------------------------------------------------------------------ */
    /*                         CLIENTI                                    */
    /* ------------------------------------------------------------------ */


  // (PDF: Scheda anagrafica) :contentReference[oaicite:4]{index=4}
  ragioneSociale: {
    label: "Ragione sociale rivenditore",
    type: "text",
    max: 200,
  },

  agente: {
    label: "Agente",
    type: "text",
    max: 200,
  },

  indirizzo: {
    label: "Indirizzo sede legale",
    type: "text",
    max: 400,
  },

  citta: {
    label: "Località",
    type: "text",
    max: 120,
  },

  provincia: {
    label: "Provincia",
    type: "text",
    max: 20,
  },

  cap: {
    label: "CAP",
    type: "text",
    max: 20,
  },

  indirizzoDestinazioneMerce: {
    label: "Indirizzo destinazione merce",
    type: "text",
    max: 400,
  },

  indirizzoSpedizioneDocumenti: {
    label: "Indirizzo spedizione documenti",
    type: "text",
    max: 400,
  },

  codiceFiscale: {
    label: "Codice fiscale",
    type: "text",
    max: 40,
  },

  partitaIva: {
    label: "Partita IVA",
    type: "text",
    max: 40,
  },

  codiceUnivocoSdi: {
    label: "Codice univoco SDI",
    type: "text",
    max: 20,
  },

  pec: {
    label: "PEC",
    type: "email",
    max: 200,
  },

  telefono: {
    label: "Telefono",
    type: "tel",
    max: 40,
  },

  cellulare: {
    label: "Cellulare",
    type: "tel",
    max: 40,
  },

  email: {
    label: "E-mail",
    type: "email",
    max: 200,
  },

  referenteCommerciale: {
    label: "Referente commerciale",
    type: "text",
    max: 200,
  },

  referenteCommercialeTel: {
    label: "Recapito telefonico (referente commerciale)",
    type: "tel",
    max: 40,
  },

  referenteCommercialeMail: {
    label: "Mail (referente commerciale)",
    type: "email",
    max: 200,
  },

  referenteAmministrazione: {
    label: "Referente amministrazione",
    type: "text",
    max: 200,
  },

  referenteAmministrazioneTel: {
    label: "Recapito telefonico (referente amministrazione)",
    type: "tel",
    max: 40,
  },

  referenteAmministrazioneMail: {
    label: "Mail (referente amministrazione)",
    type: "email",
    max: 200,
  },

  competitorPresenti: {
    label: "Competitor presenti",
    type: "textarea",
    max: 2000,
  },

  superficieEspositiva: {
    label: "Superficie espositiva",
    type: "text",
    max: 100,
  },

  bancaAppoggio: {
    label: "Banca d'appoggio",
    type: "text",
    max: 200,
  },

  abi: {
    label: "ABI",
    type: "text",
    max: 20,
  },

  cab: {
    label: "CAB",
    type: "text",
    max: 20,
  },

  iban: {
    label: "IBAN",
    type: "text",
    max: 40,
  },

  noteConsegna: {
    label: "Note per la consegna",
    type: "textarea",
    max: 4000,
    hint:
      "Specificare se destinazione diversa dalla propria sede e segnalare eventuali problemi di accessibilità dei mezzi di consegna, ecc.",
  },

  bancaliLegno: {
    label: "Bancali legno",
    type: "select",
    options: [
      ["si", "Sì"],
      ["no", "No"],
    ],
  },

  dataSchedaAnagrafica: {
    label: "Data (scheda anagrafica)",
    type: "date",
  },

  nomeAgente: {
    label: "Nome agente",
    type: "text",
    max: 200,
  },

  firmaCliente: {
    label: "Firma cliente",
    type: "text",
    max: 200,
  },

  note: {
    label: "Note (generiche)",
    type: "text",
    max: 600,
  },

  // campo che avevi già (lo lascio)
  sconto_alu: {
    label: "Sconto alluminio ALU",
    type: "number",
  },


  condizioniCliente: {
    label: "Partner / rivenditore (cliente)",
    type: "reference",
    reference: {
      kind: "anagrafica",
      targetSlug: "clienti",
      resourceBasePath: "anagrafiche",
      previewField: "ragioneSociale",
    },
  },

  codiceClienteCondizioni: {
    label: "Codice cliente",
    type: "text",
    max: 100,
  },

  scontisticaProdotti: {
    label: "Scontistica per classe/prodotto",
    type: "textarea",
    max: 8000,
    hint:
      "Una riga per prodotto: CLASSE | DESCRIZIONE | SCONTO | DATA INIZIO | DATA FINE\n" +
      "Esempio:\n" +
      "AU | Alluminio Silk | 50% | 2026-02-05 |\n" +
      "PERSIANE | Persiane in Alluminio | 50% | |",
  },

  modalitaPagamentoRighe: {
    label: "Modalità di pagamento (righe)",
    type: "textarea",
    max: 2000,
    hint:
      "Una riga: CODICE | DESCRIZIONE | DATA INIZIO | DATA FINE\n" +
      "Esempio:\n" +
      " | 30% acconto + saldo R.B.A. 30/60 gg | 2026-02-05 |",
  },

  contributoTrasporto: {
    label: "Contributo trasporto (condizione)",
    type: "text",
    max: 400,
    hint: "Esempio: Come da tabella trasporti a listino",
  },

  dataCondizioniCommerciali: {
    label: "Data (condizioni commerciali)",
    type: "date",
  },

  firmaCondizioni: {
    label: "Firma (condizioni commerciali)",
    type: "text",
    max: 200,
  },

  /* ------------------------------------------------------------------ */
  /*                   VERIFICA DATI ANAGRAFICI (PDF)                    */
  /* ------------------------------------------------------------------ */
  // (PDF: Verifica dati anagrafici) :contentReference[oaicite:6]{index=6}

  verificaCliente: {
    label: "Cliente (riferimento)",
    type: "reference",
    reference: {
      kind: "anagrafica",
      targetSlug: "clienti",
      resourceBasePath: "anagrafiche",
      previewField: "ragioneSociale",
    },
  },

  sedeLegale: {
    label: "Sede legale",
    type: "text",
    max: 400,
  },

  sedeAmministrativa: {
    label: "Sede amministrativa",
    type: "text",
    max: 400,
  },

  fax: {
    label: "Fax",
    type: "tel",
    max: 40,
  },

  dataVerificaDati: {
    label: "Data (verifica dati)",
    type: "date",
  },

  timbroEFirma: {
    label: "Timbro e firma",
    type: "text",
    max: 200,
  },

  /* ------------------------------------------------------------------ */
  /*                         PRIVACY CLIENTE (PDF)                       */
  /* ------------------------------------------------------------------ */
  // (PDF: Privacy cliente) :contentReference[oaicite:7]{index=7}

  privacyCliente: {
    label: "Cliente (riferimento)",
    type: "reference",
    reference: {
      kind: "anagrafica",
      targetSlug: "clienti",
      resourceBasePath: "anagrafiche",
      previewField: "ragioneSociale",
    },
  },

  privacyData: {
    label: "Data (privacy)",
    type: "date",
  },

  privacyFirma: {
    label: "Firma per il consenso",
    type: "text",
    max: 200,
  },


    referente: {
      label: "Referente",
      type: "text",
      max: 200,
    },
    indirizzolegale: {
      label: "Indirizzo Sede Legale",
      type: "text",
      max: 400,
    },
    indirizzoOperativo: {
      label: "Indirizzo Sede Operativa",
      type: "text",
      max: 400,
    },

    localita: {
      label: "Località",
      type: "text",
      max: 120,
    },
    codiceunivoco: {
      label: "Cod. Univoco",
      type: "text",
      max: 120,
    },
    piva: {
      label: "P.Iva",
      type: "text",
      max: 120,
    },
    codicefiscale: {
      label: "Codice Fiscale",
      type: "text",
      max: 120,
    },

    Genere: {
      label: "Genere",
      type: "select",
      options: [
        ["maschio", "Maschio"],
        ["femmina", "Femmina"],
      ],
    },
    tipoCliente: {
      label: "Tipo Cliente",
      type: "select",
      options: [
        ["privato", "Privato"],
        ["azienda", "Azienda"],
        ["cooperativa", "Cooperativa"],
      ],
    },
    settoreEconomico: {
      label: "Settore Economico",
      type: "select",
      options: [
        [
          "AGRICOLTURA, SILVICOLTURA E PESCA",
          "AGRICOLTURA, SILVICOLTURA E PESCA",
        ],
        ["ATTIVITÀ ESTRATTIVE", "ATTIVITÀ ESTRATTIVE"],
        ["ATTIVITÀ MANIFATTURIERE", "ATTIVITÀ MANIFATTURIERE"],
        [
          "FORNITURA DI ENERGIA ELETTRICA, GAS, VAPORE E ARIA CONDIZIONATA",
          "FORNITURA DI ENERGIA ELETTRICA, GAS, VAPORE E ARIA CONDIZIONATA",
        ],
        [
          "FORNITURA DI ACQUA; GESTIONE DI RETI FOGNARIE, ATTIVITÀ DI TRATTAMENTO DEI RIFIUTI E RISANAMENTO",
          "FORNITURA DI ACQUA; GESTIONE DI RETI FOGNARIE, ATTIVITÀ DI TRATTAMENTO DEI RIFIUTI E RISANAMENTO",
        ],
        ["COSTRUZIONI", "COSTRUZIONI"],
        [
          "COMMERCIO ALL'INGROSSO E AL DETTAGLIO",
          "COMMERCIO ALL'INGROSSO E AL DETTAGLIO",
        ],
        ["TRASPORTO E MAGAZZINAGGIO", "TRASPORTO E MAGAZZINAGGIO"],
        [
          "ATTIVITÀ DEI SERVIZI DI ALLOGGIO E DI RISTORAZIONE",
          "ATTIVITÀ DEI SERVIZI DI ALLOGGIO E DI RISTORAZIONE",
        ],
        [
          "ATTIVITÀ EDITORIALI, TRASMISSIONI RADIOFONICHE E PRODUZIONE E DISTRIBUZIONE DI CONTENUTI",
          "ATTIVITÀ EDITORIALI, TRASMISSIONI RADIOFONICHE E PRODUZIONE E DISTRIBUZIONE DI CONTENUTI",
        ],
        [
          "TELECOMUNICAZIONI, PROGRAMMAZIONE E CONSULENZA INFORMATICA, INFRASTRUTTURE INFORMATICHE E ALTRE ATTIVITÀ DEI SERVIZI D'INFORMAZIONE",
          "TELECOMUNICAZIONI, PROGRAMMAZIONE E CONSULENZA INFORMATICA, INFRASTRUTTURE INFORMATICHE E ALTRE ATTIVITÀ DEI SERVIZI D'INFORMAZIONE",
        ],
        [
          "ATTIVITÀ FINANZIARIE E ASSICURATIVE",
          "ATTIVITÀ FINANZIARIE E ASSICURATIVE",
        ],
        ["ATTIVITÀ IMMOBILIARI", "ATTIVITÀ IMMOBILIARI"],
        [
          "ATTIVITÀ PROFESSIONALI, SCIENTIFICHE E TECNICHE",
          "ATTIVITÀ PROFESSIONALI, SCIENTIFICHE E TECNICHE",
        ],
        [
          "ATTIVITÀ AMMINISTRATIVE E DI SERVIZI DI SUPPORTO",
          "ATTIVITÀ AMMINISTRATIVE E DI SERVIZI DI SUPPORTO",
        ],
        [
          "AMMINISTRAZIONE PUBBLICA E DIFESA; ASSICURAZIONE SOCIALE OBBLIGATORIA",
          "AMMINISTRAZIONE PUBBLICA E DIFESA; ASSICURAZIONE SOCIALE OBBLIGATORIA",
        ],
        ["ISTRUZIONE E FORMAZIONE", "ISTRUZIONE E FORMAZIONE"],
        [
          "ATTIVITÀ PER LA SALUTE UMANA E DI ASSISTENZA SOCIALE",
          "ATTIVITÀ PER LA SALUTE UMANA E DI ASSISTENZA SOCIALE",
        ],
        [
          "ATTIVITÀ ARTISTICHE, SPORTIVE E DI DIVERTIMENTO",
          "ATTIVITÀ ARTISTICHE, SPORTIVE E DI DIVERTIMENTO",
        ],
        ["ALTRE ATTIVITÀ DI SERVIZI", "ALTRE ATTIVITÀ DI SERVIZI"],
      ],
    },
    telefonoFisso: {
      label: "Numero di telefono Fisso",
      type: "tel",
      max: 40,
    },
    telefonoMobile: {
      label: "Numero di telefono Mobile",
      type: "tel",
      max: 40,
    },

    sconto: {
      label: "Sconto %",
      type: "number",
      max: 20,
    },


    /* ------------------------------------------------------------------ */
    /*                        CONFERMA D'ORDINE                           */
    /* ------------------------------------------------------------------ */

    codiceCliente: {
      label: "Codice Cliente",
      type: "reference",
      max: 100,
      reference: {
        kind: "anagrafica",
        targetSlug: "clienti",
        resourceBasePath: "anagrafiche",
        previewField: "ragioneSociale",
      },
    },
    valoreCommessa:
      {label: "Valore Conferma",
       type: "number"  },

    numeroOrdine: {
      label: "Numero Ordine",
      type: "number",
      max: 50,
    },
    riferimento: {
      label: "Riferimento",
      type: "text",
      max: 200,
    },
    inizioConsegna: {
      label: "Inizio Consegna",
      type: "date",
    },
    fineConsegna: {
      label: "Fine Consegna",
      type: "date",
    },
    statoAvanzamento: {
      label: "Stato di Avanzamento",
      type: "text",
    },

    /* ------------------------------------------------------------------ */
    /*                         FORNITORI                                  */
    /* ------------------------------------------------------------------ */

    tipoFornitore: {
      label: "Tipo Fornitore",
      type: "select",
      options: [
        ["privato", "Privato"],
        ["azienda", "Azienda"],
        ["cooperativa", "Cooperativa"],
      ],
    },

    tempidiconsegna: {
      label: "Tempi di consegna",
      type: "text",
      max: 100,
    },

    /* ------------------------------------------------------------------ */
    /*                         ARTICOLI / SERVIZI                         */
    /* ------------------------------------------------------------------ */

    nomeArticolo: {
      label: "Nome articolo / servizio",
      type: "text",
      max: 200,
    },

    codiceArticolo: {
      label: "Codice articolo",
      type: "text",
      max: 200,
    },
    prezzoUnitario: {
      label: "Prezzo unitario di vendita",
      type: "number",
      hint: "Prezzo unitario standard per questo articolo.",
    },
    costoUnitario: {
      label: "Costo unitario di produzione",
      type: "number",
      hint: "Costo unitario di produzione standard per questo articolo.",
    },
    filamentousatoUnitario: {
      label: "Gr di filamento unitario di produzione",
      type: "number",
      hint: "Gr di filamento di produzione usato per questo articolo.",
    },
    genereArticolo: {
      label: "Genere dell'articolo",
      type: "select",
      options: [
        ["articolo fisico", "Articolo Fisico"],
        ["servizio", "Servizio"],
      ],
    },



    /* ------------------------------------------------------------------ */
    /*                           PREVENTIVI                               */
    /* ------------------------------------------------------------------ */

    numeroPreventivo: {
      label: "Numero preventivo",
      type: "text",
      max: 50,
    },
    dataPreventivo: {
      label: "Data preventivo",
      type: "date",
    },
    clientePreventivo: {
      label: "Cliente",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "clienti",
        resourceBasePath: "anagrafiche",
        previewField: "ragioneSociale",
      },
    },
    statoPreventivo: {
      label: "Stato preventivo",
      type: "select",
      options: [
        ["bozza", "Bozza"],
        ["inviato", "Inviato"],
        ["accettato", "Accettato"],
        ["rifiutato", "Rifiutato"],
        ["fatturato", "Fatturato"],
        ["acconto pagato", "Acconto Pagato"],
        ["saldo pagato", "Saldo Pagato"],
      ],
    },
    notePreventivo: {
      label: "Note interne (non stampate)",
      type: "textarea",
      max: 4000,
    },
    testoIntroduzione: {
      label: "Testo introduzione (PDF)",
      type: "textarea",
      max: 5000,
      hint: "Comparirà all'inizio del documento stampato.",
    },
    testoFinale: {
      label: "Testo finale (PDF)",
      type: "textarea",
      max: 5000,
      hint: "Comparirà prima della firma nel documento stampato.",
    },
    noteCliente: {
      label: "Note per il cliente (PDF)",
      type: "textarea",
      max: 4000,
      hint: "Sezione 'Note' nel PDF, visibile al cliente.",
    },
    firmaNome: {
      label: "Firma - Nome e cognome",
      type: "text",
      max: 200,
    },
    firmaRuolo: {
      label: "Firma - Ruolo",
      type: "text",
      max: 200,
    },
    firmaLuogoData: {
      label: "Luogo e data firma",
      type: "text",
      max: 200,
    },

    /* ------------------------------------------------------------------ */
    /*                         RIGHE PREVENTIVO                           */
    /* ------------------------------------------------------------------ */

    preventivoRiferimento: {
      label: "Preventivo",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "preventivi",
        resourceBasePath: "anagrafiche",
        previewField: "numeroPreventivo",
      },
    },
    articoloRiferimento: {
      label: "Articolo",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "articoli",
        resourceBasePath: "anagrafiche",
        previewField: "nomeArticolo",
      },
    },
    descrizioneRiga: {
      label: "Descrizione riga",
      type: "textarea",
      max: 4000,
    },
    quantitaRiga: {
      label: "Quantità",
      type: "number",
    },
    prezzoUnitarioRiga: {
      label: "Prezzo unitario riga",
      type: "number",
      hint: "Per default viene copiato dal prezzo unitario dell'articolo.",
    },
    scontoPercentualeRiga: {
      label: "Sconto (%)",
      type: "number",
    },
    totaleRiga: {
      label: "Totale riga",
      type: "number",
    },

    /* ------------------------------------------------------------------ */
    /*                         SPESE                                      */
    /* ------------------------------------------------------------------ */

    costoSpesa: {
      label: "Costo",
      type: "number",
    },

    fornitoreSpesa: {
      label: "Fornitore",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "fornitori",
        resourceBasePath: "anagrafiche",
        previewField: "ragioneSociale",
      },
    },

    percentualeIva: {
      label: "% IVA",
      type: "number",
    },

    dataConsegna: {
      label: "Data Consegna",
      type: "date",
    },

    statoConsegna: {
      label: "Stato Consegna",
      type: "select",
      options: [
        ["ordinato", "Ordinato"],
        ["spedito", "Spedito"],
        ["consegnato", "Consegnato"],
        ["in ritardo", "In ritardo"],
      ],
    },

    preventivoCollegato: {
      label: "Preventivo Collegato",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "preventivi",
        resourceBasePath: "anagrafiche",
        previewField: "numeroPreventivo",
      },
    },

    // SPESE
    // --- GENERALI ---
    tipoSpesa: {
      label: "Tipo di Spesa",
      type: "select",
      options: [
        ["magazzino", "Spese di magazzino"],
        ["abbonamenti", "Abbonamenti"],
        ["stipendi", "Stipendi"],
        ["f24", "F24"],
        ["commercialista", "Commercialista"],
        ["utenze", "Utenze"],
      ],
    },

    dataArrivo: {
      label: "Data di Arrivo",
      type: "date",
    },

    dataSpesa: {
      label: "Data Spesa",
      type: "date",
    },

    descrizione: {
      label: "Descrizione / Note",
      type: "textarea",
      max: 600,
    },

    // --- MAGAZZINO ---
    fornitore: {
      label: "Fornitore",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "fornitori",
        resourceBasePath: "anagrafiche",
        previewField: "ragioneSociale",
      },
    },

    piattaformaAcquisto: {
      label: "Piattaforma di acquisto",
      type: "select",
      options: [
        ["amazon", "Amazon"],
        ["aliexpress", "AliExpress"],
        ["ebay", "eBay"],
        ["temu", "Temu"],
        ["altro", "Altro"],
      ],
    },

    materialeConsumo: {
      label: "tipo di materiale di consumo",
      type: "select",
      options: [
        ["NFC", "NFC"],
        ["catenelle", "Catenelle"],
        ["crediti IA", "Crediti IA"],
        ["pezzi di ricambio", "Pezzi di ricambio"],
        ["prodotti di manutenzione", "Prodotti di manutenzione"],
      ],
    },

    quantitaBobina1: {
      label: "quantità bobina 1",
      type: "number",
    },

    coloreBobina1: {
      label: "colore bobina 1",
      type: "select",
      options: [
        ["nero", "Nero"],
        ["bianco", "Bianco"],
        ["grigio", "Grigio"],
        ["grigio_scuro", "Grigio scuro"],
        ["rosso", "Rosso"],
        ["blu", "Blu"],
        ["turchese", "Turchese"],
        ["verde", "Verde"],
        ["giallo", "Giallo"],
        ["arancione", "Arancione"],
        ["viola", "Viola"],
        ["rosa", "Rosa"],
        ["marrone", "Marrone"],
        ["trasparente", "Trasparente"],
        ["naturale", "Naturale"],
        ["oro", "Oro"],
        ["argento", "Argento"],
        ["bronzo", "Bronzo"],
        ["azzurro", "Azzurro"],
        ["verde_fluo", "Verde fluo"],
        ["rosso_fluo", "Rosso fluo"],
      ],
    },

    materialeBobina1: {
      label: "materiale Bobina 1",
      type: "select",
      options: [
        ["PLA", "PLA"],
        ["PETG", "PETG"],
        ["ABS", "ABS"],
      ],
    },

    quantitaBobina2: {
      label: "quantità bobina 2",
      type: "number",
    },

    coloreBobina2: {
      label: "colore bobina 2",
      type: "select",
      options: [
        ["nero", "Nero"],
        ["bianco", "Bianco"],
        ["grigio", "Grigio"],
        ["grigio_scuro", "Grigio scuro"],
        ["rosso", "Rosso"],
        ["blu", "Blu"],
        ["turchese", "Turchese"],
        ["verde", "Verde"],
        ["giallo", "Giallo"],
        ["arancione", "Arancione"],
        ["viola", "Viola"],
        ["rosa", "Rosa"],
        ["marrone", "Marrone"],
        ["trasparente", "Trasparente"],
        ["naturale", "Naturale"],
        ["oro", "Oro"],
        ["argento", "Argento"],
        ["bronzo", "Bronzo"],
        ["azzurro", "Azzurro"],
        ["verde_fluo", "Verde fluo"],
        ["rosso_fluo", "Rosso fluo"],
      ],
    },

    materialeBobina2: {
      label: "materiale Bobina 2",
      type: "select",
      options: [
        ["PLA", "PLA"],
        ["PETG", "PETG"],
        ["ABS", "ABS"],
      ],
    },

    quantitaBobina3: {
      label: "quantità bobina 3",
      type: "number",
    },

    coloreBobina3: {
      label: "colore bobina 3",
      type: "select",
      options: [
        ["nero", "Nero"],
        ["bianco", "Bianco"],
        ["grigio", "Grigio"],
        ["grigio_scuro", "Grigio scuro"],
        ["rosso", "Rosso"],
        ["blu", "Blu"],
        ["turchese", "Turchese"],
        ["verde", "Verde"],
        ["giallo", "Giallo"],
        ["arancione", "Arancione"],
        ["viola", "Viola"],
        ["rosa", "Rosa"],
        ["marrone", "Marrone"],
        ["trasparente", "Trasparente"],
        ["naturale", "Naturale"],
        ["oro", "Oro"],
        ["argento", "Argento"],
        ["bronzo", "Bronzo"],
        ["azzurro", "Azzurro"],
        ["verde_fluo", "Verde fluo"],
        ["rosso_fluo", "Rosso fluo"],
      ],
    },

    materialeBobina3: {
      label: "materiale Bobina 3",
      type: "select",
      options: [
        ["PLA", "PLA"],
        ["PETG", "PETG"],
        ["ABS", "ABS"],
      ],
    },

    linkProdotto: {
      label: "URL prodotto",
      type: "text",
      max: 600,
    },

    costoUnitarioSpesa: {
      label: "costo Unitario",
      type: "number",
    },

    ivaPagata: {
      label: "hai pagato l'iva?",
      type: "select",
      options: [
        ["si", "SI"],
        ["no", "NO"],
      ],
    },

    importoIva: {
      label: "Importo IVA",
      type: "number",
    },

    numeroPezzi: {
      label: "Numero di pezzi",
      type: "number",
    },

    fatturaSdi: {
      label: "Fattura integrata allo SDI",
      type: "select",
      options: [
        ["si", "Sì"],
        ["no", "No"],
      ],
    },

    // --- ABBONAMENTI ---
    servizioAbbonamento: {
      label: "Servizio",
      type: "select",
      options: [
        ["gpt", "GPT"],
        ["cloudflare", "Cloudflare"],
        ["mongodb", "MongoDB"],
        ["twilio", "Twilio"],
        ["iubenda", "Iubenda"],
        ["groq", "Groq"],
        ["resend", "Resend"],
        ["netsons", "Netsons"],
        ["fattureIncloud", "Fatture Incloud"],
        ["pecAziendale", "PEC Aziendale"],
        ["pec1", "PEC 1"],
        ["pec2", "PEC 2"],
        ["pec3", "PEC 3"],
        ["pec4", "PEC 4"],
        ["altro", "Altro"],
      ],
    },

    scadenzaAbbonamento: {
      label: "Scadenza abbonamento",
      type: "date",
    },

    // --- DIPENDENTI ---
    dipendente: {
      label: "Dipendente",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "evolver",
        resourceBasePath: "anagrafiche",
        previewField: "nomeEvolver",
      },
    },

    nettoDipendente: {
      label: "Netto in Busta",
      type: "number",
    },

    contributiDipendente: {
      label: "Contributi",
      type: "number",
    },

    tfrDipendente: {
      label: "TFR",
      type: "number",
    },

    altroDipendente: {
      label: "Altro (rimborsi, benefit)",
      type: "number",
    },

    // --- F24 ---
    ivaF24: {
      label: "IVA F24",
      type: "number",
    },

    contributiF24: {
      label: "Contributi F24",
      type: "number",
    },

    tassa1: {
      label: "Tassa 1",
      type: "number",
    },

    tassa2: {
      label: "Tassa 2",
      type: "number",
    },

    tassa3: {
      label: "Tassa 3",
      type: "number",
    },

    tassa4: {
      label: "Tassa 4",
      type: "number",
    },

    // --- COMMERCIALISTA ---
    contabilitaOrdinaria: {
      label: "Tenuta contabilità ordinaria",
      type: "number",
    },

    cedoliniDipendenti: {
      label: "Cedolini lavoratori dipendenti",
      type: "number",
    },

    domiciliazione: {
      label: "Servizio domiciliazione società",
      type: "number",
    },

    cassaPrevidenzaCommercialista: {
      label: "Cassa previdenza Commercialista",
      type: "number",
    },

    voceCommercialista1: {
      label: "voce Commercialista 1",
      type: "number",
    },

    voceCommercialista2: {
      label: "voce Commercialista 2",
      type: "number",
    },

    totaleNetto: {
      label: "Totale netto",
      type: "number",
    },

    totaleLordo: {
      label: "Totale lordo",
      type: "number",
    },

    /* ------------------------------------------------------------------ */
    /*                         RICAVI                                     */
    /* ------------------------------------------------------------------ */

    ragioneSocialeRicavo: {
      label: "Nome/ragione sociale",
      type: "text",
      max: 200,
    },

    categoriaRicavo: {
      label: "Categoria ricavo",
      type: "select",
      options: [
        ["stampa3d", "Stampa 3D"],
        ["consulenza", "Consulenza"],
        ["sviluppoSoftware", "Sviluppo Software"],
        ["atlas", "Atlas"],
        ["altro", "Altro"],
      ],
    },

    clienteVendita: {
      label: "Cliente",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "clienti",
        resourceBasePath: "anagrafiche",
        previewField: "ragioneSociale",
      },
    },

    dataFatturazione: {
      label: "Data Fatturazione",
      type: "date",
    },

    dataPagamento: {
      label: "Data Pagamento",
      type: "date",
    },

    provenienzaCliente: {
      label: "Provenienza Cliente",
      type: "select",
      options: [
        ["giaCliente", "Già Cliente"],
        ["contattoDiretto", "Contatto Diretto"],
        ["sitoWeb", "Sito Web"],
        ["ads", "Ads"],
        ["passaparola", "Passaparola"],
      ],
    },

    numeroFattura: {
      label: "Nr Fattura",
      type: "text",
      max: 200,
    },

    bandi: {
      label: "Bandi",
      type: "text",
      max: 350,
    },

    statoFatturazione: {
      label: "stato Fatturazione",
      type: "select",
      options: [
        ["ipotizzato", "Ipotizzato"],
        ["programmato", "Programmato"],
        ["fatturato", "Fatturato"],
        ["pagato", "Pagato"],
        ["stornato", "Stornato"],
      ],
    },

    numeroArticoli1: {
      label: "Numero Articoli venduti 1",
      type: "number",
    },

    articolo1: {
      label: "Articolo venduto 1",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "articoli",
        resourceBasePath: "anagrafiche",
        previewField: "nomeArticolo",
      },
    },

    numeroArticoli2: {
      label: "Numero Articoli Venduti 2",
      type: "number",
    },

    articolo2: {
      label: "Articolo Venduto 2",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "articoli",
        resourceBasePath: "anagrafiche",
        previewField: "nomeArticolo",
      },
    },

    numeroArticoli3: {
      label: "Numero Articoli venduti 3",
      type: "number",
    },

    articolo3: {
      label: "Articolo venduto 3",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "articoli",
        resourceBasePath: "anagrafiche",
        previewField: "nomeArticolo",
      },
    },

    numeroArticoli4: {
      label: "Numero Articoli Venduti 4",
      type: "number",
    },

    articolo4: {
      label: "Articolo Venduto 4",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "articoli",
        resourceBasePath: "anagrafiche",
        previewField: "nomeArticolo",
      },
    },

    //// EVOLVERS

    nomeEvolver: {
      label: "Nome Evolver",
      type: "text",
    },

    /* ------------------------------------------------------------------
  *  BANDO – CAMPI ANAGRAFICA
  * ------------------------------------------------------------------ */

    titoloBando: {
      label: "Titolo bando",
      type: "text",
      max: 200,
    },

    entePromotore: {
      label: "Ente Promotore",
      type: "reference",
      reference: {
        kind: "anagrafica",
        targetSlug: "enti",
        resourceBasePath: "anagrafiche",
        previewField: "nomeEnte",
      },
    },

    nomeEnte: {
      label: "Nome Ente",
      type: "text",
      max: 200,
    },

    sitoUfficiale: {
      label: "Sito Ufficiale",
      type: "text",
      max: 300,
    },

    proceduraBando: {
      label: "Procedura bando",
      type: "select",
      options: [
        ["clickDay", "Click Day"],
        ["sportello", "Sportello"],
        ["graduatoria", "Graduatoria"],
        ["elencoFornitori", "Elenco Fornitori"],
      ],
    },

    fondiTotali: {
      label: "Fondi Totali",
      type: "number",
    },

    tipoContributo: {
      label: "Tipo contributo",
      type: "select",
      options: [
        ["fondoPerduto", "Fondo Perduto"],
        ["finanziamentoAgevolato", "Finanziamento Agevolato"],
        ["creditoImposta", "Credito d’Imposta"],
      ],
    },

    dataAperturaBando: {
      label: "Data apertura bando",
      type: "date",
    },

    dataChiusuraBando: {
      label: "Data chiusura bando",
      type: "date",
    },

    beneficiariAmmessi: {
      label: "Beneficiari ammessi",
      type: "select",
      options: [
        ["pmi", "PMI"],
        ["lavoratoriAutonomi", "Lavoratori autonomi"],
        ["iscrittiAlbo", "Iscritti ad albo"],
        ["nuoveImprese", "Nuove imprese"],
      ],
    },

    vincoliBeneficiari: {
      label: "Vincoli beneficiari",
      type: "textarea",
    },

    percentualeContributo: {
      label: "Percentuale contributo",
      type: "number",
    },

    contributoMinimo: {
      label: "Contributo minimo",
      type: "number",
    },

    contributoMassimo: {
      label: "Contributo massimo",
      type: "number",
    },

    categoriaPrincipale: {
      label: "Categoria principale",
      type: "select",
      options: [
        ["digitalizzazione", "Digitalizzazione"],
        ["cybersecurity", "Cybersecurity"],
        ["hardware", "Hardware"],
        ["cloudSaas", "Cloud / SaaS"],
      ],
    },

    modalitaErogazione: {
      label: "Modalità di erogazione",
      type: "textarea",
    },

    //VARIANTI ++++++++ GESTIONE VARIANTI A FE +++++++++++++++

    variantId: {
      label: "Variante",
      type: "text",
      max: 50,
      hint: "Seleziona la variante di visualizzazione/compilazione.",
    },

  /* ------------------------------------------------------------------ */
  /* NOTE: ESEMPI NUOVI TIPI (SOLO COMMENTI, NON CAMPI REALI)           */
  /* ------------------------------------------------------------------ */

  /**
   * boolean:
   * - salva true/false
   *
   * attivo: { label:"Attivo", type:"boolean" }
   */

  /**
   * multiselect:
   * - salva string[] (solo valori presenti in options)
   *
   * tagsControlled: {
   *   label:"Tag (controllati)",
   *   type:"multiselect",
   *   options:[["vip","VIP"],["newsletter","Newsletter"]]
   * }
   */

  /**
   * labelArray:
   * - salva string[] libero (tag non controllati)
   *
   * tagsFree: { label:"Tag", type:"labelArray" }
   */

  /**
   * referenceMulti:
   * - salva ObjectId[]
   *
   * contatti: {
   *   label:"Contatti collegati",
   *   type:"referenceMulti",
   *   reference:{ kind:"anagrafica", targetSlug:"contatti", resourceBasePath:"anagrafiche", previewField:"nome" }
   * }
   */

  /**
   * rangeNumber:
   * - salva {from,to}
   *
   * rangePrezzo: { label:"Range prezzo", type:"rangeNumber" }
   */

  /**
   * rangeDate:
   * - salva {start,end} (Date)
   *
   * validita: { label:"Validità", type:"rangeDate" }
   */

  /**
   * geoPoint:
   * - salva {lat,lng}
   *
   * posizione: { label:"Posizione", type:"geoPoint" }
   */

  /**
   * geoPointArray:
   * - salva GeoPoint[]
   *
   * percorso: { label:"Percorso", type:"geoPointArray" }
   */

  /**
   * pairNumber:
   * - salva {a,b}
   *
   * dimensioni: { label:"Dimensioni (L x H)", type:"pairNumber" }
   */

  /**
   * numberArray:
   * - salva number[]
   *
   * misure: { label:"Misure", type:"numberArray" }
   */

  /**
   * labelValuePairs:
   * - salva {label,value}[] (value string)
   *
   * specifiche: { label:"Specifiche", type:"labelValuePairs" }
   */

  /**
   * keyValueNumber:
   * - salva {key,value}[] (value number)
   *
   * ripartizioneCosti: { label:"Costi per categoria", type:"keyValueNumber" }
   */

  /**
   * address:
   * - salva un oggetto indirizzo strutturato
   *
   * indirizzo: { label:"Indirizzo", type:"address" }
   */

  // NOTA: non aggiungo campi reali qui, sono solo esempi commentati.
} as const;

/* ------------------------------ TYPE GUARDS ------------------------------ */

export function isReferenceField(
  def: FieldDef,
): def is FieldDef & { type: "reference"; reference: ReferenceConfig } {
  return def.type === "reference" && !!def.reference;
}

export function isReferenceMultiField(
  def: FieldDef,
): def is FieldDef & { type: "referenceMulti"; reference: ReferenceConfig } {
  return def.type === "referenceMulti" && !!def.reference;
}

export type FieldKey = keyof typeof FIELD_CATALOG;
