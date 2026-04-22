# Atlas Moduli - Anagrafiche List (Frontend)

> Percorso: `src/components/AtlasModuli/Anagrafica/AnagraficheList/*`

Questo documento descrive il comportamento attuale della **list frontend** delle Anagrafiche
e il suo contratto con:

- config Anagrafica
- API `GET /api/anagrafiche/:type`
- store Redux
- configurazione UI per slug

L'obiettivo e' rendere espliciti:

1. cosa guida la UI della list
2. quali campi vengono richiesti davvero al backend
3. quali tipi di valore sono oggi ben supportati e quali no
4. dove si trovano i punti aperti da riallineare

---

## 0) Flusso sintetico

La list segue questo percorso:

1. `AnagraficaBox.tsx`
   risolve la config UI dello slug e monta la list
2. `anagrafiche.list.ui.ts`
   definisce override di UI specifici per slug
3. `AnagraficheList.tsx`
   unisce:
   - preview config del registry
   - override UI di slug
   - projection fields
   - filtri/paginazione/sort
4. `useAnagraficheList.ts`
   traduce lo stato UI in una request Redux/API
5. `anagraficheService.list(...)`
   chiama `GET /api/anagrafiche/:type`
6. store Redux
   salva `items`, `total`, `page`, `pageSize`
7. `AnagraficheListTable.tsx`
   renderizza righe e colonne

---

## 1) Fonti di configurazione

La list frontend nasce dall'unione di due livelli:

### 1.1 Config dati del tipo

Fonte:

- `src/config/anagrafiche.registry.ts`

Da qui arrivano:

- `def.preview.title`
- `def.preview.subtitle`
- `def.preview.searchIn`
- `def.fields`
- `def.documentTypes`

Questa e' la base minima che garantisce una list funzionante anche senza override UI.

### 1.2 Config UI per slug

Fonte:

- `src/components/AtlasModuli/Anagrafica/AnagraficheList/anagrafiche.list.ui.ts`

Questa config puo' ridefinire:

- `main.title`
- `main.subtitle`
- `main.showOwner`
- `main.showDate`
- `main.referencePills`
- `columns.mode`
- `columns.keys`
- `columns.showVisibility`
- `controls.docType`
- `controls.visibility`
- `controls.sort`
- `hoverPreview`

Questa e' la direzione giusta per il sistema:

- **config dati** separata da **config di presentazione**

---

## 2) Projection dinamica verso API

Uno degli aspetti piu' importanti della list e' che non chiede il `data` completo,
ma costruisce un subset di campi da richiedere alla API.

### 2.1 Come nasce il subset

`AnagraficheList.tsx` costruisce `fields` a partire da:

- `titleKeys`
- `subtitleKeys`
- `columnKeys`
- `hoverKeys`
- `referencePillKeys`

Questo subset passa poi a:

- `useAnagraficheList.ts`
- `anagraficheService.list(...)`
- query param `fields`

### 2.2 Effetto

La list FE e' gia' allineata a un paradigma utile:

- richiede al backend solo i campi necessari alla schermata
- riusa bene la projection dinamica della API

### 2.3 Vantaggi

- payload piu' leggero
- meno dati inutili nel listing
- base corretta per list differenziate per slug

---

## 3) Filtri e stato UI

Lo stato minimo della list comprende:

- `query`
- `docType`
- `ownerOnly`
- `page`
- `sortKey`
- `sortDir`

Questi vengono tradotti nel filtro API:

- `query`
- `docType`
- `visibilityRole`
- `sortKey`
- `sortDir`
- `fields`

La search testuale non parte piu' ad ogni tasto:

- il campo input mantiene uno stato locale
- la request parte solo su azione esplicita (`Cerca` o `Enter`)

Questo riduce chiamate e caricamenti inutili durante la digitazione.

### 3.1 Punto aperto importante

Il flag `ownerOnly` oggi viene tradotto nel valore:

- `visibilityRole: "OWNER"`

Questo e' gia' segnalato nel codice come punto fragile.

Problema:

- `"OWNER"` non e' un ruolo di dominio standard
- mescola semantica di proprieta' con semantica di visibilita'

Direzione corretta futura:

- separare il filtro "solo miei" da `visibilityRole`
- modellarlo come filtro dedicato o come modalita' API esplicita

---

## 4) Sort

La list FE usa una mappa di sort sicura:

- `updatedAt`
- `createdAt`
- `title0`, `title1`, ...
- `subtitle0`, `subtitle1`, ...
- `search0`, `search1`, ...

Il vantaggio e' che:

- il frontend non inventa path Mongo arbitrari
- il backend puo' continuare a whitelistare il sort

Questa parte e' gia' coerente con l'architettura nuova.

---

## 5) Reference preview

La list gestisce gia' bene la preview di molte reference singole.

Flusso:

1. individua i field configurati come `reference`
2. raccoglie gli id presenti nelle righe correnti
3. esegue fetch batch dei label via `useReferenceBatchPreviewMulti`
4. sostituisce l'id con una label leggibile

Questo e' un punto forte da conservare quando verranno introdotti:

- `referenceMulti`
- pill multiple
- viewer/list con relazioni piu' ricche

---

## 6) Stato di supporto valori in list

La formattazione valori in list oggi e' limitata ma prevedibile.

Supporto esplicito:

- `number`
- `date`
- `select`
- `boolean`
- `multiselect`
- `labelArray`
- `numberArray`
- `rangeNumber`
- `rangeDate`
- `geoPoint`
- `geoPointArray`
- `pairNumber`
- `labelValuePairs`
- `keyValueNumber`
- `address`
- `reference` singola
- `referenceMulti`

Fallback:

- quasi tutto il resto diventa `String(raw)`

Conseguenza:

- la list e' gia' forte come architettura
- non e' ancora forte come copertura semantica dei tipi avanzati

---

## 7) Contratto attuale della list frontend

### 7.1 Input

Richiede:

- `type`
- `config`

Dipende inoltre da:

- registry Anagrafica
- store Redux
- service API Anagrafiche

### 7.2 Output atteso lato UI

La list si aspetta dal backend:

```ts
{
  items: AnagraficaPreview[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  fields?: string[];
}
```

### 7.3 Output effettivo lato schermata

La schermata rende:

- header / toolbar
- tabella
- pagination
- eventuali label reference

---

## 8) Punti deboli attuali

### 8.1 Config UI ancora parziale

La config UI per slug esiste, ma oggi copre ancora una parte limitata del sistema.

### 8.2 Formattazione tipi avanzati assente

La list non ha ancora una policy chiara per:

- array
- range
- coordinate
- address
- strutture key/value

### 8.3 Filtro ownerOnly da riallineare

Il placeholder `"OWNER"` va sostituito con una semantica piu' pulita.

### 8.4 Visibilita' mostrata, ma ancora poco coerente col modello multi-role

La colonna visibilita' legge gia' `visibilityRoles[]`, ma il filtro "solo miei"
usa ancora il placeholder storico `visibilityRole: "OWNER"` e va separato.

---

## 9) Direzione per i prossimi step

La list non va rifatta: va completata.

Le prossime mosse corrette sono:

1. estendere la documentazione FE
2. riallineare il filtro "solo miei"
3. introdurre formatter per gruppi di tipi
4. estendere la config UI per slug
5. fare in modo che list e viewer condividano una stessa grammatica di presentazione
