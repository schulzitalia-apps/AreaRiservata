export const homepageConfig = {
  seo: {
    title: "Area Riservata Schulz • Strumenti digitali per i rivenditori",
    description:
      "Scopri l’Area Riservata Schulz: listini aggiornati, documentazione tecnica, materiali marketing, gestione ordini, ticket di assistenza e calendario consegne.",
  },

  breadcrumb: {
    pageName: "Area Riservata Schulz",
  },

  hero: {
    badgeLabel: "Per i rivenditori Schulz",

    heading: "L’Area Riservata che ti semplifica il lavoro",

    highlightIntro:
      "L’Area Riservata Schulz è lo spazio online dedicato ai rivenditori",
    highlightRest:
      "dove trovi listini, schede tecniche, materiali marketing, gestione ordini e un sistema di ticket. Inoltre puoi monitorare il calendario con le date previste di consegna delle tue commesse.",

    bulletPoints: [
      {
        title: "Tutto organizzato",
        text: "listini, documenti, materiali e news Schulz raccolti in un’unica piattaforma pensata per il tuo lavoro quotidiano.",
      },
      {
        title: "Ticket di assistenza - ",
        text: "invia richieste tecniche o commerciali direttamente a Schulz e segui lo stato di avanzamento.",
      },
      {
        title: "Calendario consegne -",
        text: "visualizza con chiarezza le date previste di consegna delle tue commesse, aggiornate dal nostro ufficio logistica.",
      },
      {
        title: "Sempre aggiornato - ",
        text: "tutti i contenuti sono gestiti direttamente da Schulz, così lavori sempre con materiali ufficiali.",
      },
    ] as const,

    primaryCta: {
      label: "Richiedi l’accesso all’Area Riservata",
      href: "/richiedi-accesso-area-riservata",
    },
    secondaryCta: {
      label: "Sei già registrato? Accedi",
      href: "/area-rivenditori",
    },
  },

  /**
   * BOX VALORE: cosa trovi dentro l’Area Riservata
   */
  valuePillars: [
    {
      id: "listini",
      title: "Listini sempre disponibili",
      description:
        "Listini infissi in PVC e alluminio aggiornati, divisi per linee prodotto e facilmente consultabili per costruire preventivi precisi.",
    },
    {
      id: "documentazione",
      title: "Documentazione tecnica",
      description:
        "Schede tecniche, certificazioni e manuali sempre aggiornati, utili per tecnici, progettisti e clienti finali.",
    },
    {
      id: "marketing",
      title: "Materiali marketing",
      description:
        "Brochure, immagini, contenuti digitali e strumenti per valorizzare gli infissi Schulz nello showroom e online.",
    },
    {
      id: "assistenza",
      title: "Ticket e calendario consegne",
      description:
        "Invia ticket per richieste commerciali o tecniche e consulta il calendario con le date di consegna aggiornate per ogni ordine.",
    },
  ] as const,

  chartsSection: {
    title: "Come cambia il lavoro con l’Area Riservata Schulz",
    subtitle:
      "Esempi dimostrativi per mostrare la riduzione del tempo perso in ricerca informazioni e la gestione più chiara delle consegne.",
    timeframeLabelPrefix: "Periodo:",
    defaultTimeframeLabel: "standard",
    demoFootnote:
      "Utile per spiegare l’impatto reale dell’Area Riservata nella gestione quotidiana di documenti, assistenza e consegne.",
  },

  economicsSection: {
    title: "Più efficienza, meno imprevisti",
    body: [
      "Avere listini, documentazione, assistenza e calendario consegne in un’unica piattaforma riduce errori, attese e incomprensioni.",
      "Con informazioni aggiornate puoi rispondere ai clienti in modo chiaro e gestire al meglio ordini e tempi di consegna.",
    ],
  },

  techSection: {
    title: "Funzionalità pensate per il tuo lavoro",
    bulletItems: [
      {
        highlight: "Invio ticket",
        text: "invia richieste tecniche e commerciali direttamente a Schulz e segui lo stato di avanzamento in tempo reale.",
      },
      {
        highlight: "Calendario consegne",
        text: "visualizza le date previste per ogni ordine, aggiornate dal team di logistica Schulz.",
      },
      {
        highlight: "Area documenti e listini",
        text: "tutto sempre aggiornato, ordinato e scaricabile in pochi click.",
      },
      {
        highlight: "Aggiornamenti automatici",
        text: "le novità di prodotto, i listini e i materiali marketing vengono caricati da Schulz e sono subito disponibili.",
      },
    ] as const,
  },

  dataSecuritySection: {
    title: "Accesso sicuro e contenuti aggiornati",
    body: [
      "Ogni rivenditore accede con credenziali personali e trova solo documenti ufficiali e aggiornati.",
      "L’accesso protetto evita versioni sbagliate di listini o documenti.",
      "Le informazioni sulle consegne sono disponibili in tempo reale grazie al collegamento con la logistica Schulz.",
      "Strumenti chiari, ufficiali e controllati ti aiutano a lavorare con maggiore tranquillità e professionalità.",
    ],
  },

  finalCta: {
    title: "Vuoi usare anche tu l’Area Riservata Schulz?",
    body:
      "Richiedi l’accesso o scopri come la piattaforma può aiutarti a gestire meglio il tuo lavoro: documenti, assistenza e consegne in un unico posto.",
    primaryCta: {
      label: "Richiedi l’accesso",
      href: "/richiedi-accesso-area-riservata",
    },
    secondaryCta: {
      label: "Contatta Schulz",
      href: "/contatti",
    },
  },
} as const;

export type HomepageConfig = typeof homepageConfig;