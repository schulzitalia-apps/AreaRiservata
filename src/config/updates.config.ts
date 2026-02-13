// src/config/updates.config.ts

export type ReleaseNote = {
  version: string;
  date?: string;
  title?: string;
  items: string[];
};

export const releaseNotes: ReleaseNote[] = [
  /* ---------------------------------------------------------------------- */
  /*                                0.4.1                                  */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.4.1",
    date: "2025-",
    title: "...",
    items: [
      "Corretto un problema di visualizzazione colori nelle etichette del calendario",

    ],
  },
  /* ---------------------------------------------------------------------- */
  /*                                0.4.0                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.4.0",
    date: "2025-11-24",
    title: "Eventi, Azioni e Uniformazione Interfacce",
    items: [
      "Aggiornata la Home con un layout più uniforme e integrata una standardizzazione dei box finestra, ora riutilizzata anche nelle viste di dettaglio di anagrafiche, corsi e, in generale, di tutte le entità.",
      "Rivisti i Settings del profilo introducendo un sistema di selezione immagine più flessibile, con ricerca dinamica delle immagini disponibili nelle cartelle pubbliche.",
      "Creata la nuova entità **Evento**, capace di contenere un’aula e più anagrafiche. Totalmente configurabile tramite file config in modo analogo ad anagrafiche e aule, con schema dinamico per struttura e formati. L’intera gestione passa attraverso store Redux disaccoppiato, query e API modulabili e componenti FE costruite in modo speculare alle altre entità.",
      "Uniformato il Calendario per supportare la nuova tipologia Evento, aggiungendo filtro per categoria e introducendo uno schema colori dedicato alla visualizzazione degli eventi.",
      "Creata l’entità **Azione**. Un’Azione rappresenta un trigger che genera automaticamente un Evento alla creazione o modifica di una determinata anagrafica o aula. Le Azioni permettono, tra le altre cose, di creare eventi a scadenza e sono governate da un motore di visualizzazione e filtri completamente configurabile tramite file dedicato.",
      "Integrato il sistema Azioni con il profilo utente, introducendo un sistema dinamico di avvisi che compaiono solo quando le condizioni della relativa Azione risultano soddisfatte (es. avvisi di scadenza disponibili solo a partire da X giorni prima dell’evento generato).",
      "Bugfix minori e implementazioni incrementali varie.",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.3.1                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.3.1",
    date: "2025-11-20",
    title: "Refactoring Completo del codice",
    items: [
      "Refactoring di alcune parti del codice",
      "Disaccoppiamento di molte parti del codice (store, api, query a db, modelli, e operazioni di disaccoppiamento nello stesso store), con particolare attenzione all'utilizzo di schemi che consentano lo switch con api esterne dei singoli processi",
      "Utilizzo dell' **indexing** mongo db per costruire query solide",
      "Disaccoppiamento delle component front end dai propri elements con l'inizio di una strutturazione di una struttura frontend a moduli con nodi riutilizzabili e preparazione per la messa a disposizione di alcune delle dinamiche grafiche in file config.",
      "Le componenti comprendono cose come: set di pulsanti standardizzati, box di visualizzazione, box di interazione, box elenchi personalizzabili.",
      "Utilizzo del nuovo motore grafico nelle Aule e nelle Anagrafiche",
      "Creata una bozza di un pannello aula grafico per gestione di info, scadenze e dettaglio studente"
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.3.0                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.3.0",
    date: "2025-11-19",
    title: "Modulo Aula – Creazione, gestione corsi e partecipanti dinamici",
    items: [
      "Introduzione completa del nuovo **Modulo Aula**, progettato per gestire corsi, classi, gruppi di formazione e qualsiasi struttura basata su partecipanti.",
      "Aggiunta la pagina **Aule per tipo** con griglia dinamica, ricerca in tempo reale, ordinamento per label e gestione owner.",
      "Nuovo componente **AulaBox** con preview per ogni aula: label dinamica, owner, tipo anagrafica collegata e numero partecipanti.",
      "Implementata la pagina **AulaEdit** per creare e modificare un’aula tramite campi dinamici definiti nel registry.",
      "Supporto completo a **campi personalizzati dell’aula** tramite `aula.fields.catalog.ts` e configurazione per ogni tipo di aula.",
      "Introduzione della logica **multi-anagrafica**: ogni tipo aula collega un tipo anagrafica tramite `anagraficaSlug`, caricando automaticamente le anagrafiche collegate.",
      "Nuova gestione partecipanti: trascinamento, aggiunta rapida, rimozione e modifica con cache locale per preview anagrafica.",
      "Struttura partecipante standardizzata: `anagraficaId` (statico), `joinedAt` (statico) e `dati` (dinamico configurato).",
      "Creazione del nuovo file `AULA_PARTECIPANTE_FIELD_CATALOG` con definizioni espandibili dei campi utente (ruolo, note, voto, data ingresso…).",
      "AulaEdit ora genera automaticamente i form dinamici dei partecipanti in base al catalogo e al tipo di aula.",
      "Aggiunto salvataggio intelligente dei partecipanti con patch locale: nessuna perdita di dati in caso di edit o refresh.",
      "Nuovo componente **AulaViewer** con struttura modulare: anteprima anagrafica, campi dinamici, joinedAt e collegamento diretto all’anagrafica.",
      "Dettaglio partecipante espandibile a tendina con sezioni chiare (anagrafica, dati dinamici, joinedAt).",
      "API completamente nuove per Aula (GET list, GET detail, POST, PUT, DELETE) con interpretazione dinamica dei campi e sincronizzazione col FE.",
      "Integrazione totale con Redux Toolkit: slices aggiornati per supportare la nuova struttura e aggiornare preview + dettaglio.",
      "Aggiornamento del registry `aule.registry.ts` per definire slug, label, campi aula, campi partecipanti e preview personalizzate.",
      "Sistema pronto per future estensioni: docenti, moduli secondari, valutazioni, livelli, calendari di classe e gestione avanzata degli accessi.",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.2.4                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.2.4",
    date: "2025-11-18",
    title: "MULTI-ANAGRAFICA: Dropdown Fix e sistema multi-anagrafica",
    items: [
      "Correzione e refactor della componente Select in modalità dropdown: gestione controllata dello stato, chiusura affidabile al click esterno e rimozione di glitch visivi.",
      "Separazione logica della Select (presentazione) dalla gestione dello stato nei form.",
      "Introduzione del catalogo campi globale per le anagrafiche.",
      "Nuovo file di configurazione per tipi anagrafica rivolto anche a non programmatori.",
      "Sistema multi-anagrafica completo: più categorie tutte basate su un modello unico.",
      "Creazione di ANAGRAFICHE_REGISTRY con definizioni centralizzate.",
      "Aggiornamento AnagraficaBox per lavorare per tipo.",
      "API anagrafiche unificate con supporto param type.",
      "Menù laterale con voci dinamiche per anagrafica.",
      "visibilityRole rimane campo fisso, tutto il resto diventa dinamico.",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.2.3                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.2.3",
    date: "2025-11-17",
    title: "Refactor Calendario, context menu e miglioramenti Anagrafiche",
    items: [
      "Refactor completo del calendario corsi/eventi in viste Mese e Giorno.",
      "Selezione intervallo con drag multi-giorno.",
      "EventFormModal migliorata con gestione orari e validazioni.",
      "Aggiunto context menu per giorni e fasce orarie.",
      "Gestione centralizzata della selezione da CalendarBox.",
      "Cornice animata e reactive mode.",
      "Miglioramenti nelle viste DayView e MonthView.",
      "Fix dropdown visibilità in AnagraficaForm.",
      "Migliorata gestione allegati in AnagraficaEdit.",
      "Viewer anagrafica migliorato con sezioni a tendina.",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.2.2                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.2.2",
    date: "2025-11-15",
    title: "Creazione Home Page pubblicitaria",
    items: [
      "Gestione dei grafici ad hoc",
      "Creazioni dei testi pubblicitari iniziali",
      "Messa in produzione della nuova homepage",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.2.1                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.2.1",
    date: "2025-11-15",
    title: "Prime Aggiunte – Filtri anagrafiche e dashboard Admin",
    items: [
      "Filtro documenti e classe visibilità nelle anagrafiche.",
      "Campo visibilità inserito nei form e nelle liste.",
      "Cancellazione anagrafica con API dedicate.",
      "Pannello Admin utenti con gestione ruoli.",
      "UI migliorata in dark/light mode.",
      "Pannello Aggiornamenti & Dev board.",
      "Rifiniture UI varie.",
      "Aggiunta categorie documenti serie.",
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*                                0.1.0                                   */
  /* ---------------------------------------------------------------------- */
  {
    version: "0.1.0",
    date: "2025-11-14",
    title: "Setup iniziale",
    items: [
      "Setup iniziale della piattaforma.",
      "Anagrafiche base con gestione allegati.",
      "Dashboard principale.",
    ],
  },
];
