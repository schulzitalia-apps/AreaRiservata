# Evolve Atlas — List Anagrafiche (Backend)

> Percorso: `src/server-utils/service/Anagrafiche/list/*`

Questo documento descrive il funzionamento della **query di listing** delle Anagrafiche in Atlas, strutturata seguendo la convenzione “pipeline funzionale”.

L’obiettivo è chiarire:

* **cosa fa** la list e in che ordine,
* **quali componenti** la compongono,
* **su quali parti del modello Anagrafica** lavora,
* **quali scelte** sono state fatte e perché,
* **implicazioni performance** e relazione con l’**indicizzazione**.

---

## 0) Contratto API/Service: input, output e casi d’uso

Questa sezione è lo “specchietto” operativo: **cosa passare** e **cosa torna**.

### 0.1 Service: `listAnagrafiche(params)`

**Signature:**

```ts
listAnagrafiche(params: {
  type: string;
  query?: string;
  limit?: number;
  offset?: number;
  docType?: string;
  visibilityRole?: string;
  sort?: ListSortKey;
  fields?: FieldKey[];      
  auth: AuthContext;
}): Promise<{ items: AnagraficaPreview[]; total: number }>
```

**Comportamento per default:**

* se non passi `fields`, la list ritorna la **preview** (campi `title/subtitle/searchIn`) come sottoinsieme di `data.*`.

**Comportamento con projection dinamica (NEW):**

* se passi `fields`, la list ritorna in `data` **solo** i campi `data.<field>` richiesti, **purché** appartengano ai campi definiti per quel tipo (cioè alla definizione del tipo in registry: `def.fields`).

> Nota: `fields` influenza **solo i campi restituiti** (projection). Non cambia ACL, filtri, o logica di listing.

---

### 0.2 Output: cosa torna davvero

La service restituisce:

```ts
{
  items: AnagraficaPreview[];
  total: number;
}
```

Dove `AnagraficaPreview` è il DTO usato dalla UI:

```ts
type AnagraficaPreview = {
  id: string;
  data: Record<string, any>;         // subset di data.* 
  // (preview o fields custom)
  displayName: string;               // derivato da def.preview.title
  subtitle: string | null;           // derivato da def.preview.subtitle
  updatedAt: string;
  visibilityRoles?: string[];
  ownerId?: string | null;
  ownerName?: string | null;
};
```

**Note importanti:**

* `data` **non è l’intero `data`** del documento: è un **sottoinsieme** determinato dalla projection.
* `displayName/subtitle` sono costruiti dal mapper usando `def.preview.title/subtitle`.

    * Se con `fields` non includi i campi necessari al titolo, `displayName` può diventare `"(senza titolo)"`.

---

### 0.3 API: `GET /api/anagrafiche/:type`

**Route:**

* `GET /api/anagrafiche/<type>`

**Query params principali:**

| Parametro        |              Tipo |      Default | Effetto                                                                  |                |
| ---------------- | ----------------: | -----------: | ------------------------------------------------------------------------ | -------------- |
| `query`          |            string |            — | Attiva search (regex) su `def.preview.searchIn`                          |                |
| `docType`        |            string |            — | Filtra per `attachments.type`                                            |                |
| `visibilityRole` |            string |            — | Filtro dominio: array-contains su `visibilityRoles`                      |                |
| `page`           |            number |            1 | Paginazione pagina (offset-based)                                        |                |
| `pageSize`       |            number | 25 (max 200) | Dimensione pagina                                                        |                |
| `sortKey`        |            string |            — | Sort UX: `updatedAt`, `createdAt`, `title0`, `subtitle0`, `search0`, ... |                |
| `sortDir`        |              `asc |        desc` | `desc`                                                                   | Direzione sort |
| `fields`         | string / ripetuto |            — | ✅ NEW: projection dinamica, CSV o ripetuto                               |                |

**Esempi `fields`:**

* CSV: `?fields=ragioneSociale,piva,email`
* Ripetuto: `?fields=ragioneSociale&fields=piva&fields=email`

**Regola di whitelist:**

* i campi passati in `fields` vengono accettati solo se appartengono a `def.fields` del tipo selezionato.

---

## 1) Introduzione

### 1.1 Cos’è `listAnagrafiche`

`listAnagrafiche` è la query di backend che produce una **lista paginata** di Anagrafiche (preview), per un determinato `slug` (il type di Atlas per Anagrafiche, Aule ed Eventi).

### 1.2 Perché è una “pipeline”

La list non è un semplice CRUD: per essere **config-driven** e **sicura**, deve:

1. leggere definizione tipo (config Atlas)
2. costruire filtri di **dominio** (business)
3. applicare il filtro **ACL** centralizzato di Atlas
4. limitare i campi esposti al client con una **projection**
5. applicare un **sort** controllato
6. applicare una **paginazione** safe
7. eseguire query + count
8. fare join/arricchimenti (owners)
9. mappare i documenti in DTO di preview

La nostra scomposizione in pipeline riduce regressioni, aumenta le possiibilità di riuso, e rende più facile ottimizzare singoli step.

---

## 2) Modello dati coinvolto (schema)

La list lavora su **una Anagrafica per slug** (model dinamico). Il documento base è `IAnagraficaDoc`.

### 2.1 Campi del modello usati dalla list

#### A) `data` (campi custom)

`data` è un oggetto flessibile (Mixed). La list lavora su `data.<campo>` in due modalità:

1. **Preview mode (default)**

* usa solo i campi strategici definiti in:

    * `def.preview.title`
    * `def.preview.subtitle`
    * `def.preview.searchIn`

2. **Projection dinamica (NEW)**

* se l’API/service riceve il parametro `fields`, allora la list include solo:

    * `data.<field>` per ciascun `field` richiesto
* con regola di sicurezza:

    * `field` deve appartenere alla definizione del tipo nel registry (`def.fields`).

> In sintesi: `data` è Mixed. **La list non ritorna `data` intero**: ritorna una projection selettiva (preview o subset custom).

#### B) Campi core assolutamente indicizzati

* `visibilityRoles: string[]` (ACL + filtro di dominio opzionale)
* `owner` (ACL owner + join owners)
* `attachments.type` (filtro docType)
* `createdAt`, `updatedAt` (sort e ordinamenti temporali)

---

## 3) Indici e performance (regole operative)

### 3.1 Indici base (core)

La list trae vantaggio da indici su:

* `owner`
* `visibilityRoles` (multikey)
* `updatedAt`, `createdAt`
* `attachments.type`

### 3.2 Indici su campi custom (`data.*`)

Gli indici su `data.<campo>` sono creati dinamicamente dal model in base alla config del tipo:

* `preview.title`

* `preview.subtitle`

* `preview.searchIn`

* i campi “di preview” sono i candidati naturali per sort e filtri

* se un campo non è in preview, **non ci basiamo su di lui per sort/search** (evita full scan)

> Nota: la **projection dinamica** (NEW) non richiede indicizzazione per funzionare.
> L’indice serve per rendere efficiente **filter/sort**, non per “selezionare” campi nel risultato.

### 3.3 Projection dinamica (NEW): impatto prestazionale

La projection agisce sulla **dimensione del payload** restituito:

* Mongo restituisce **solo** i campi inclusi nella projection (non manda tutto e poi “si spulcia” lato Node).

Implicazioni:

* molti set di `fields` diversi **non sono un problema** se il payload resta simile (es. sempre pochi KB).
* il rischio prestazionale nasce quando si chiedono campi “pesanti” (stringhe enormi, array grandi, ecc.).

### 3.4 Search: perché è opzionale

La search usa regex / OR su più campi (`$or`). Anche con indici, una regex non-anchored (`/q/i`) può:

* non sfruttare l’indice in modo efficace
* aumentare il lavoro del query planner

Per questo la pipeline:

* costruisce `searchFilter` **solo se `query` è presente**
* altrimenti la query resta un filtro “pulito” (molto più stabile e veloce)

---

## 4) Pipeline: breakdown componente per componente

Di seguito: **ogni componente** della list, cosa fa, su quali campi del modello lavora, e perché.

### 4.1 Orchestratore — `list/list.ts`

**Ruolo:** espone la query in ordine logico, senza implementare logiche di dettaglio.

**Input:**

* `type` (slug)
* `query?` (search)
* `docType?` (attachments)
* `visibilityRole?` (dominio)
* `sort?` (whitelist)
* `fields?` (✅ NEW: projection dinamica su data.*)
* `limit/offset`
* `auth` (ACL)

**Output:**

* `{ items: AnagraficaPreview[]; total: number }`

---

### 4.2 Builder Search — `builders/search.ts`

**Ruolo:** costruire `searchFilter` (opzionale) su `data.*`.

**Applicabile a:**

* **solo** campi definiti in `def.preview.searchIn`

**Come funziona:**

* se `query` è vuota → `null`
* separa i campi `searchIn` in:

    * **normali** → regex case-insensitive su `data.<campo>`
    * **reference** → match `ObjectId` (solo se la query è un ObjectId valido)
* produce:

    * `{ $or: [ ... ] }`

---

### 4.3 Builder Filter — `builders/filter.ts`

**Ruolo:** costruire filtro di dominio (business) e comporlo con ACL.

#### A) `buildDomainFilter(...)`

**Lavora su:**

* `attachments.type` (se `docType`)
* `visibilityRoles` (se `visibilityRole`)
* `searchFilter` (se presente)

**Semantica visibilità:**

* input API: `visibilityRole?: string`
* filtro: `{ visibilityRoles: <role> }` ⇒ **array contains**

#### B) `combineFilters(base, access)`

**Regola:**

* se entrambi non vuoti → `$and`
* se uno è vuoto → usa l’altro

---

### 4.4 ACL Engine — `buildMongoAccessFilter(auth, slug)`

**Ruolo:** produrre il filtro di sicurezza centralizzato.

**Lavora su:**

* `owner`
* `visibilityRoles`
* (eventuali key scopes: `_id` o `data.<ref>`)
* (eventuale membership aule: `aule.*` se abilitato)

---

### 4.5 Builder Projection — `builders/projection.ts`

**Ruolo:** selezionare solo i campi da restituire nel listing.

#### A) Default: preview projection

**Lavora su:**

* `data.<campo>` per i campi in preview (`title`, `subtitle`, `searchIn`)
* `owner`, `updatedAt`, `visibilityRoles`

#### B) Projection dinamica

**Input:** `fields?: FieldKey[]`

**Comportamento:**

* se `fields` è presente, la projection include `data.<field>` **solo** per i field richiesti.

**Whitelist:**

* i field richiesti vengono accettati solo se appartengono ai campi del tipo (`def.fields`).

**Perché così:**

* riduce payload DB → meno RAM e meno rete
* permette al FE di ottimizzare schermate diverse chiedendo solo i dati necessari
* resta “config-driven”: non si possono chiedere campi fuori dalla definizione del tipo

---

### 4.6 Builder Sort — `builders/sort.ts`

**Ruolo:** produrre un sort controllato (no input libero).

Sort supportati:

**A) Sort temporali (core)**

* `updatedAt` (asc/desc)
* `createdAt` (asc/desc)

**B) Sort su preview fields (`data.<campo>`)**

È supportato il sort su `data.<campo>` **solo** se `<campo>` è presente in almeno una di queste liste nella config del tipo:

* `preview.title`
* `preview.subtitle`
* `preview.searchIn`

---

### 4.7 Builder Pagination — `builders/pagination.ts`

**Ruolo:** normalizzare limit/offset in valori safe.

---

### 4.8 Join Owners — `joins/owners.ts`

**Ruolo:** arricchire i risultati con informazioni owner (nome/email).

---

### 4.9 Mapper Preview — `mappers/preview.ts`

**Ruolo:** trasformare i doc lean in `AnagraficaPreview`.

**Lavora su:**

* `data` per costruire `displayName` e `subtitle`
* `updatedAt`
* `visibilityRoles`
* owner map

---

## 5) Regole di applicabilità sul modello Anagrafica

### 5.1 Campo `data` (Mixed)

* list/search/sort usano `data.*` in modo controllato:

    * search/sort restano limitati ai preview fields
    * projection può essere preview (default) o subset custom (NEW)

### 5.2 Campo `visibilityRoles` (array)

* usato sia in **ACL** (match con `$in` dei ruoli consentiti)
* sia come filtro di dominio (array contains)

### 5.3 Campo `attachments.type`

* usato solo se il filtro `docType` è attivo

---

## 6) Glossario

* **Preview fields**: `title/subtitle/searchIn` → campi “strategici” (search/sort)
* **Dynamic projection**: `fields` → subset di `data.*` restituito (solo output)
* **Builder**: funzione pura che costruisce un oggetto (filter/projection/sort)
* **Join**: fetch secondario di enrichment (owners)
* **Mapper**: trasformazione doc → DTO
* **ACL**: filtro di sicurezza centralizzato
