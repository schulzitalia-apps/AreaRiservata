// src/config/anagrafiche.types.public.ts
import type { FieldKey } from "./anagrafiche.fields.catalog";

export type DetailCardHeaderVariant =
  | "cover-avatar"
  | "avatar-only"
  | "none";

export type DetailCardAvatarSize = "small" | "medium" | "large";

export type DetailCardConfig = {
  coverSrc?: string;
  avatarSrc?: string;
  headerVariant?: DetailCardHeaderVariant;
  avatarSize?: DetailCardAvatarSize;
  hoverEffect?: boolean;
};

type PreviewCfg = {
  title: FieldKey[];
  subtitle?: FieldKey[];
  searchIn?: FieldKey[];
};

export type PublicTypeDef = {
  slug: string;
  label: string;
  fields: FieldKey[];
  documentTypes?: string[];
  preview?: PreviewCfg;
  accettaAule?: boolean;
  detailCard?: DetailCardConfig;
};

export const ANAGRAFICA_TYPES: readonly PublicTypeDef[] = [
  /* ------------------------------------------------------------------ */
  /*                         CLIENTI                                    */
  /* ------------------------------------------------------------------ */

  {
    slug: "clienti",
    label: "Clienti",
    fields: [
      "variantId",
      "ragioneSociale",
      "indirizzo",
      "citta",
      "provincia",
      "cap",
      "indirizzoDestinazioneMerce",
      "indirizzoSpedizioneDocumenti",
      "codiceFiscale",
      "partitaIva",
      "codiceUnivocoSdi",
      "telefono",
      "cellulare",
      "email",
      "referenteCommerciale",
      "referenteCommercialeTel",
      "referenteCommercialeMail",
      "referenteAmministrazione",
      "referenteAmministrazioneTel",
      "referenteAmministrazioneMail",
      "competitorPresenti",
      "superficieEspositiva",
      "bancaAppoggio",
      "abi",
      "cab",
      "iban",
      "noteConsegna",
      "bancaliLegno",
      "dataSchedaAnagrafica",
      "nomeAgente",
      "firmaCliente",
      "condizioniCliente",
      "codiceClienteCondizioni",
      "scontisticaProdotti",
      "modalitaPagamentoRighe",
      "contributoTrasporto",
      "dataCondizioniCommerciali",
      "nomeAgente",
      "verificaCliente",
      "ragioneSociale",
      "sedeLegale",
      "sedeAmministrativa",
      "fax",
      "partitaIva",
      "codiceFiscale",
      "codiceUnivocoSdi",
      "dataVerificaDati",
      "timbroEFirma",
      "privacyCliente",
      "privacyData",
      "privacyFirma",
    ],
    documentTypes: ["documentoIdentità", "consensoPrivacy", "altro"],
    preview: {
      title: ["ragioneSociale"],
      subtitle: ["tipoCliente"],
      searchIn: ["ragioneSociale", "cap", "citta"],
    },
    accettaAule: true,
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-02.png",
      avatarSrc: "/images/illustration/avatar/avatar-02.png",
      headerVariant: "avatar-only",
      avatarSize: "large",
      hoverEffect: true,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                         FORNITORI                                  */
  /* ------------------------------------------------------------------ */

  {
    slug: "fornitori",
    label: "Fornitori",
    fields: [
      "agente",
      "ragioneSociale",
      "indirizzo",
      "citta",
      "provincia",
      "cap",
      "indirizzoDestinazioneMerce",
      "indirizzoSpedizioneDocumenti",
      "codiceFiscale",
      "partitaIva",
      "codiceUnivocoSdi",
      "pec",
      "telefono",
      "cellulare",
      "email"
    ],
    documentTypes: ["documentoIdentità", "consensoPrivacy", "altro"],
    preview: {
      title: ["ragioneSociale"],
      subtitle: ["tipoFornitore"],
      searchIn: ["ragioneSociale", "cap", "citta"],
    },
    accettaAule: true,
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-02.png",
      avatarSrc: "/images/illustration/avatar/avatar-02.png",
      headerVariant: "avatar-only",
      avatarSize: "large",
      hoverEffect: true,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                         CONFERME D'ORDINE                          */
  /* ------------------------------------------------------------------ */

  {
    slug: "conferme-ordine",
    label: "Conferme d'ordine",
    fields: [
      "codiceCliente",
      "numeroOrdine",
      "statoAvanzamento",
      "riferimento",
      "inizioConsegna",
      "fineConsegna",
      "note",
    ],
    documentTypes: ["confermaOrdine"],
    preview: {
      title: ["riferimento"],
      subtitle: ["codiceCliente", "numeroOrdine"],
      searchIn: ["numeroOrdine", "codiceCliente", "riferimento"],
    },
    accettaAule: true,
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-02.png",
      avatarSrc: "/images/illustration/avatar/avatar-02.png",
      headerVariant: "cover-avatar",
      avatarSize: "large",
      hoverEffect: true,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                            ARTICOLI                                */
  /* ------------------------------------------------------------------ */
  {
    slug: "articoli",
    label: "Articoli / Servizi",
    fields: [
      "nomeArticolo",
      "descrizione",
      "codiceArticolo",
      "prezzoUnitario",
      "costoUnitario",
      "genereArticolo",
      "filamentousatoUnitario",
      "note",

      //---variabili per varianti atlas---//

    ],
    documentTypes: ["schedaTecnica", "immagine", "altro"],
    preview: {
      title: ["nomeArticolo"],
      subtitle: ["genereArticolo"],
      searchIn: ["nomeArticolo", "descrizione"],
    },
    accettaAule: false,
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-08.png",
      avatarSrc: "/images/illustration/avatar/avatar-10.png",
      headerVariant: "cover-avatar",
      avatarSize: "large",
      hoverEffect: true,
    },
  },

  /* ------------------------------------------------------------------ */
  /*         PREVENTIVI        - SLUG SU MISURA PER PREVENTIVATORE      */
  /*                            EVITARE DI TOCCARLO                     */
  /* ------------------------------------------------------------------ */
  {
    slug: "preventivi",
    label: "Preventivi",
    fields: [
      "numeroPreventivo",
      "dataPreventivo",
      "clientePreventivo",
      "statoPreventivo",
      "notePreventivo",
      "testoIntroduzione",
      "testoFinale",
      "noteCliente",
      "firmaNome",
      "firmaRuolo",
      "firmaLuogoData",
    ],
    documentTypes: ["altro"],
    preview: {
      title: ["numeroPreventivo"],
      subtitle: ["clientePreventivo", "dataPreventivo"],
      searchIn: ["numeroPreventivo", "notePreventivo", "noteCliente"],
    },
    accettaAule: false,
    detailCard: {
      coverSrc: "/images/illustration/cover/cover-03.png",
      avatarSrc: "/images/illustration/avatar/avatar-03.png",
      headerVariant: "avatar-only",
      avatarSize: "large",
      hoverEffect: true,
    },
  },

  /* ------------------------------------------------------------------ */
  /*         RIGHE PREVENTIVI  - SLUG SU MISURA PER PREVENTIVATORE      */
  /*                            EVITARE DI TOCCARLO                     */
  /* ------------------------------------------------------------------ */
  {
    slug: "righe-preventivo",
    label: "Righe preventivo",
    fields: [
      "preventivoRiferimento",
      "articoloRiferimento",
      "descrizioneRiga",
      "quantitaRiga",
      "prezzoUnitarioRiga",
      "scontoPercentualeRiga",
      "totaleRiga",
    ],
    documentTypes: [],
    preview: {
      title: ["descrizioneRiga"],
      subtitle: ["preventivoRiferimento"],
      searchIn: ["descrizioneRiga"],
    },
    accettaAule: false,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                        SPESE                                       */
  /* ------------------------------------------------------------------ */

  {
    slug: "spese",
    label: "Spese",
    fields: [
      "variantId",
      "descrizione",
      "statoConsegna",
      "preventivoCollegato",

      // --- GENERALE ---
      "tipoSpesa",
      "dataArrivo",
      "dataSpesa",
      "dataFatturazione",
      "statoFatturazione",

      // --- MAGAZZINO ---
      "fornitore",
      "piattaformaAcquisto",
      "materialeConsumo",
      "quantitaBobina1",
      "coloreBobina1",
      "materialeBobina1",
      "quantitaBobina2",
      "coloreBobina2",
      "materialeBobina2",
      "quantitaBobina3",
      "coloreBobina3",
      "materialeBobina3",
      "linkProdotto",
      "costoUnitario",
      "ivaPagata",
      "importoIva",
      "fatturaSdi",
      "numeroPezzi",

      // --- ABBONAMENTI ---
      "servizioAbbonamento",
      "scadenzaAbbonamento",

      // --- DIPENDENTI ---
      "dipendente",
      "nettoDipendente",
      "contributiDipendente",
      "tfrDipendente",
      "altroDipendente",

      // --- F24 ---
      "ivaF24",
      "contributiF24",
      "tassa1",
      "tassa2",
      "tassa3",

      // --- COMMERCIALISTA ---
      "contabilitaOrdinaria",
      "cedoliniDipendenti",
      "domiciliazione",
      "cassaPrevidenzaCommercialista",
      "voceCommercialista1",
      "voceCommercialista2",
      "totaleNetto",
      "totaleLordo",
    ],
    documentTypes: ["fattura","confermaOrdine","ordineAcquisto"],
    preview: {
      title: ["tipoSpesa", "numeroPezzi", "materialeConsumo", "servizioAbbonamento",],
      subtitle: ["dataSpesa", "totaleNetto"],
      searchIn: [
        "tipoSpesa",
        "totaleLordo",
        "servizioAbbonamento",
        "dipendente",
        "fornitore"
      ],
    },
    accettaAule: true,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                        RICAVI                                      */
  /* ------------------------------------------------------------------ */

  {
    slug: "ricavi",
    label: "Ricavi",
    fields: [
      "variantId",
      "statoFatturazione",
      "ragioneSocialeRicavo",
      "categoriaRicavo",
      "clienteVendita",
      "dataFatturazione",
      "dataPagamento",
      "totaleNetto",
      "importoIva",
      "totaleLordo",
      "provenienzaCliente",
      "numeroFattura",
      "bandi",
      "descrizione",

      //---variabili per varianti stampa3D---//
      "numeroArticoli1",
      "articolo1",
      "numeroArticoli2",
      "articolo2",
      "numeroArticoli3",
      "articolo3",
      "numeroArticoli4",
      "articolo4",



      // ---- field di gian --- //

    ],
    documentTypes: ["fattura", "altro"],
    preview: {
      title: ["ragioneSocialeRicavo"],
      subtitle: ["preventivoCollegato"],
      searchIn: [
        "ragioneSocialeRicavo",
        "clienteVendita",
        "dataFatturazione",
      ],
    },
    accettaAule: false,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                        EVOLVER                                     */
  /* ------------------------------------------------------------------ */

  {
    slug: "evolver",
    label: "Evolver",
    fields: [
      "nomeEvolver",
    ],
    documentTypes: ["fattura", "altro"],
    preview: {
      title: ["nomeEvolver"],
      subtitle: [],
      searchIn: [
        "nomeEvolver",
      ],
    },
    accettaAule: true,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

  // anagrafiche.types.public.ts

  /* ------------------------------------------------------------------ */
  /*                        ENTI                                        */
  /* ------------------------------------------------------------------ */

  {
    slug: "enti",
    label: "Enti",
    fields: [
      "variantId",
      "nomeEnte",
      "sitoUfficiale",
      "descrizione",
    ],
    documentTypes: ["bandi", "guida", "articoli"],
    preview: {
      title: ["nomeEnte"],
      subtitle: ["sitoUfficiale"],
      searchIn: ["nomeEnte", "descrizione", "sitoUfficiale"],
    },
    accettaAule: false,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

  /* ------------------------------------------------------------------ */
  /*                        BANDI                                       */
  /* ------------------------------------------------------------------ */

  {
    slug: "bandi",
    label: "Bandi",
    fields: [
      "titoloBando",
      "entePromotore",
      "descrizione",
      "localita",
      "proceduraBando",
      "fondiTotali",
      "tipoContributo",
      "dataAperturaBando",
      "dataChiusuraBando",
      "beneficiariAmmessi",
      "vincoliBeneficiari",
      "percentualeContributo",
      "contributoMinimo",
      "contributoMassimo",
      "categoriaPrincipale",
      "modalitaErogazione",
      "variantId",
    ],
    documentTypes: ["bando", "articolo", "documento", "nota"],
    preview: {
      title: ["titoloBando"],
      subtitle: ["entePromotore", "dataAperturaBando","dataChiusuraBando"],
      searchIn: [
        "titoloBando",
        "descrizione",
        "localita",
        "proceduraBando",
        "tipoContributo",
        "categoriaPrincipale",
        "vincoliBeneficiari",
      ],
    },
    accettaAule: false,
    detailCard: {
      headerVariant: "none",
      hoverEffect: false,
    },
  },

] as const;

export type AnagraficaTypeSlug =
  (typeof ANAGRAFICA_TYPES)[number]["slug"];
