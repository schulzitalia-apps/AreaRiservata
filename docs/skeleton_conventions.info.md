# Convenzione cartelle Atlas — FE & BE (pipeline funzionale)

Questo documento definisce una **convenzione unica** per organizzare il codice sia **backend (BE)** sia **frontend (FE)** in Evolve Atlas.

L’obiettivo è avere una struttura:

* **leggibile** (chi entra capisce subito dove sta cosa)
* **coerente** (stessa logica mentale in FE e BE)
* **estensibile** (quando aggiungiamo use case non nasce una “giungla” di file)
* **testabile** (blocchi piccoli, funzioni pure dove possibile)

---

## 1) Perché scegliamo una convenzione “pipeline funzionale”

Molte parti di Atlas (soprattutto query e listing) non sono CRUD “semplici”: sono pipeline.

Esempio tipico:

1. leggere config / definizione tipo
2. costruire filtri di dominio
3. applicare ACL
4. costruire projection
5. applicare sort/paginazione
6. eseguire query
7. join / enrichment
8. mapping nel formato finale (DTO per FE / ViewModel per UI)

La convenzione scelta separa questi passaggi in moduli dedicati.

**Perché funziona bene su Atlas (config-driven):**

* riduce il rischio che una singola funzione diventi enorme
* rende facile aggiungere pezzi (nuovi filtri/sort) senza toccare tutto
* permette di riusare la stessa logica in più use case

---

## 2) Scelta organizzativa: “Feature-first + pipeline inside”

### 2.1 Regola base

Organizziamo il codice **per feature/use case**, e dentro la feature applichiamo la pipeline funzionale.

Questo evita due estremi:

* **solo layer globali** (controllers/services/repositories) → spesso troppo generico e dispersivo
* **solo feature senza struttura interna** → rischio duplicazioni e file ingestibili

---

## 3) Struttura standard Backend (BE)

Esempio (Anagrafiche):

```
src/server-utils/service/anagrafica/
  index.ts                      // reindirizzatore export

  list/
    index.ts                    // export listAnagrafiche
    list.ts                     // orchestratore (pipeline)

    builders/
      search.ts                 // costruisce la parte searchbar
      filter.ts                 // baseFilter + combinazione con ACL
      projection.ts             // proiezione preview
      sort.ts                   // sort consentiti + builder
      pagination.ts             // safeLimit + safeOffset

    joins/
      owners.ts                 // join owner map (User)

    mappers/
      preview.ts                // mapping docs → AnagraficaPreview
```

### 3.1 Cosa significa in BE

* `list.ts` è l’orchestratore: “racconta la query” in ordine logico
* `builders/*` costruiscono oggetti Mongo (filter/projection/sort) senza side-effect
* `joins/*` fanno fetch da altre collection/servizi per arricchire i risultati
* `mappers/*` trasformano i documenti grezzi in DTO per l’API

---

## 4) Struttura standard Frontend (FE)

Esempio (pagina/feature Anagrafiche list):

```
src/features/anagrafiche/list/
  index.ts                      // export pubblici della feature

  AnagraficheList.tsx           // orchestratore UI (container)

  builders/
    query.ts                    // buildListParams: UI → API params
    urlState.ts                 // sync filtri con searchParams

  joins/
    fetch.ts                    // chiamata API listAnagrafiche
    prefetch.ts                 // prefetch/caching (se usato)

  mappers/
    toRow.ts                    // DTO → ViewModel (righe tabella)
    toFilters.ts                // config → UI filters (se config-driven)

  hooks/
    useAnagraficheList.ts       // orchestrazione stato + fetch + caching

  components/
    ListToolbar.tsx             // componenti presentational
    ListTable.tsx
    ListEmpty.tsx
```

### 4.1 Cosa significa in FE

* l’orchestrazione spesso vive in `hooks/*` e nel container principale
* `builders/*` costruiscono query params / payload, normalizzano input UI
* `joins/*` sono chiamate API (fetch) e logiche di aggregazione lato FE
* `mappers/*` producono ViewModel ottimizzati per UI
* `components/*` sono presentational (zero logica di fetch)

---

## 5) Nomi cartelle comuni e significato (glossario operativo)

### 5.1 `index.ts`

**Reindirizzatore**: espone un’API pulita del modulo.

* BE: export funzioni di service (list/create/update/...)
* FE: export component/hook pubblici

### 5.2 `list.ts` / `*.ts` (orchestratori)

**Orchestratore**: mette insieme i pezzi in sequenza logica.

* BE: pipeline query, compose filter, call DB, join, map
* FE: container/hook che compone builders + joins + mappers

### 5.3 `builders/`

**Costruzione “input”** (tipicamente funzioni pure):

* BE: filter/projection/sort/pagination (Mongo query objects)
* FE: query params, payload request, normalizzazione filtri UI

### 5.4 `joins/`

**Enrichment / fetch secondari**:

* BE: join su altre collection (owner, documents, ecc.)
* FE: fetch API, prefetch, batching, aggregazioni lato client

### 5.5 `mappers/`

**Trasformazione verso l’output finale**:

* BE: document Mongo → DTO API
* FE: DTO API → ViewModel UI (row, label, badge, ecc.)

### 5.6 `hooks/` (FE)

**Orchestrazione stato UI**:

* gestisce filtri/sort/paging
* gestisce loading/error
* integra caching (SWR/React Query) se usato

### 5.7 `components/` (FE)

**Presentational**:

* nessuna logica DB/API
* riceve props già “pronte” (ViewModel)

### 5.8 `mutations/` (BE, quando arriveremo a CRUD)

**Operazioni di scrittura** (create/update/delete) e normalizzazioni collegate:

* normalize references
* apply patch safe
* audit fields

---

## 6) Regole pratiche per mantenere la convenzione pulita

1. **Evitiamo `utils/` generici**: se un file non sai come chiamarlo, probabilmente manca una categoria.
2. **Un file = una responsabilità chiara**: meglio pochi file “giusti” che tanti file “helper” vaghi.
3. **Builders senza DB**: se un builder fa query, allora non è un builder.
4. **Joins fanno DB/fetch**: se serve enrichment, sta in joins.
5. **Mappers non fanno fetch**: trasformano soltanto.
6. **Orchestratore resta leggibile**: deve leggere come un “copione”.

---

## 7) Perché questa scelta è vantaggiosa nel tempo

* riduce il costo di manutenzione (meno regressioni)
* riduce il tempo di onboarding (chi entra sa dove guardare)
* aumenta la riusabilità (builders/mappers diventano libreria interna)
* facilita test e debug (blocchi piccoli)
* si adatta bene a sistemi config-driven come Atlas

---

## 8) Convenzione di naming (minima) che useremo

* `builders/<cosa>.ts` → `buildXxx(...)`
* `joins/<cosa>.ts` → `fetchXxx(...)` / `buildXxxMap(...)`
* `mappers/<cosa>.ts` → `mapToXxx(...)`
* `hooks/useXxx.ts` (FE)
* `components/Xxx.tsx` (FE)

> Nota: i nomi devono essere “banali ma precisi”. Se un file è ambiguo, la convenzione sta fallendo.
