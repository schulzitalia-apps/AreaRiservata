# Evolve Atlas — Mutations Anagrafiche (casting stringente + sparse data + performance)

---

## 0) Perché esiste questo documento

In Atlas il campo `data` delle anagrafiche è **Mixed** (blob JSON flessibile).  
Questo dà elasticità, ma introduce un rischio concreto:

- il **frontend tende a mandare stringhe** (anche per numeri, date, boolean)
- Mongoose **non casta** automaticamente i sotto-campi dentro `Mixed`
- si rischia di salvare dati incoerenti (`"10"` invece di `10`, `"true"` invece di `true`, ObjectId come string, ecc.)
- peggio: si rischia di salvare **chiavi vuote** che gonfiano documenti e indici

Per questo nelle mutations (create/update/patch) introduciamo un **casting serio server-side**, guidato dalla configurazione del tipo (`getAnagraficaDef(slug)`).

Obiettivo:

1. **conformità** del dato salvato
2. **sparse data** (chiavi non applicabili/non valorizzate => non salvate)
3. **mutazioni “delta”**: cambiare solo i campi toccati, senza sovrascrivere il resto
4. contenere i costi di **indicizzazione** e dimensione documento

---

## 1) Modello dati: recap essenziale

Ogni anagrafica è un documento:

- `data: Record<string, any>` → campi custom, flessibili e variabili per `slug`
- campi **core** fuori da `data` (strutturati e indicizzati): es. `visibilityRoles`, `attachments`, `aule`
- audit: `owner`, `createdBy`, `updatedBy`
- timestamps: `createdAt`, `updatedAt`

> Regola guida: il backend deve garantire la forma dei dati in `data` perché `data` è Mixed.

---

## 2) Perché “sparse data” è una best practice (e cosa significa qui)

**Sparse data** = se un campo non è applicabile o non valorizzato, **non salvare la chiave** in `data`.

Quindi:

- `""` / `null` / `[]` (vuoti) ⇒ **$unset** (rimuovere `data.<campo>`)
- valore valido ⇒ **$set** con valore castato

Vantaggi:

- documenti più piccoli
- payload API più leggero
- indici su `data.<campo>` crescono **solo** con i documenti che hanno davvero quel campo
- meno “rumore” nel dato (eviti `""` ripetuti su 100k record)

---

## 3) I tipi (FieldInputType) e la loro natura

La configurazione dei campi vive in:

- `def.fields` ottenuta da `getAnagraficaDef(slug)`
- tipo TS `FieldDef` e union `FieldInputType` in `src/config/anagrafiche.fields.catalog.ts`

Di seguito una sintesi dei tipi supportati e della **natura del valore salvato**:

### 3.1 Tipi testo

- `text`, `textarea`, `email`, `tel`, `select`
    - **DB:** `string`
    - **Note:** trim lato BE; stringa vuota ⇒ unset

### 3.2 Tipi boolean

- `boolean`
    - **DB:** `boolean`
    - **Input FE ammessi:** `true/false`, `"true"/"false"`, `1/0`, `"1"/"0"`, `"yes"/"no"`
    - **Non castabile:** unset (se vuoto) oppure rifiuto/ignore (in base alla strategia della mutation)

### 3.3 Tipi numerici

- `number`
    - **DB:** `number`
    - **Input FE tipico:** `"10"` o `"10,50"` (cast `,` → `.`)
- `numberArray`
    - **DB:** `number[]`
    - **Regola:** cast per entry, rimuovi non numerici, se vuoto ⇒ unset
- `rangeNumber`
    - **DB:** `{ from:number; to:number }`
    - **Regola:** entrambi necessari; se parziale/non valido ⇒ unset (o rifiuto)

### 3.4 Tipi date

- `date`
    - **DB:** `Date`
    - **Input FE tipico:** ISO string
- `rangeDate`
    - **DB:** `{ start:Date; end:Date }`
    - **Regola:** start+end necessari, se incompleto ⇒ unset (o rifiuto)

### 3.5 Tipi select multipli / label

- `multiselect`
    - **DB:** `string[]`
    - **Uso:** array di scelte controllate (whitelist su `options`, soprattutto FE)
- `labelArray`
    - **DB:** `string[]`
    - **Uso:** tag liberi non whitelistati (meno controllo, più libertà)

### 3.6 Reference

- `reference`
    - **DB:** `ObjectId`
    - **Input FE tipico:** string ObjectId
- `referenceMulti`
    - **DB:** `ObjectId[]` (multikey index potenziale)
    - **Regola:** cast per entry, rimuovi invalidi, se vuoto ⇒ unset

### 3.7 Geo / coppie

- `geoPoint`
    - **DB:** `{ lat:number; lng:number }`
- `geoPointArray`
    - **DB:** `GeoPoint[]`
    - **Attenzione:** array lunghi = payload + indice (se indicizzato) + costo query
- `pairNumber`
    - **DB:** `{ a:number; b:number }`

### 3.8 Coppie label→value

- `labelValuePairs`
    - **DB:** `{ label:string; value:string }[]`
    - **Uso:** specifiche variabili “presentabili”
- `keyValueNumber` (enumMap)
    - **DB:** `{ key:string; value:number }[]`
    - **Uso:** breakdown numerici (costi per categoria, KPI per voce)

### 3.9 Address

- `address`
    - **DB:** oggetto strutturato (es. `{street, city, zip, province, country, extra}`)
    - **Uso:** normalizzare indirizzi e permettere evoluzioni future (anche address multipli in futuro)

---

## 4) Pericoli e regole operative (importantissimo)

### 4.1 (delta update)

> **Regola mutation:** nelle update aggiorniamo SOLO i campi presenti nell’input.

- se l’input contiene `{ email: "x" }` → tocchiamo solo `data.email`
- non ricostruiamo `data` completo a meno che sia un “replace” volontario

Per evitare sovrascritture accidentali:

- preferire `$set/$unset` su `data.<k>` invece di `update.data = mergedObject`
- se fai merge “object-level”, rischi:
    - race condition (due update paralleli)
    - sovrascrittura di campi non presenti nel payload corrente

> **Best practice:** per update “serio” usa sempre builder che produce `$set/$unset` per singole chiavi.

### 5.2 Attenzione a `null` vs “chiave assente”

- `null` salvato in DB:
    - la chiave ESISTE e può contribuire a indici / query in modi indesiderati
- chiave assente:
    - data sparse, costo minore

Quindi: `""` / `null` / `[]` ⇒ `$unset`.

### 5.3 Casting su campi non definiti in `def.fields`

- **se key non esiste in config**:
    - per sicurezza:  il dato viene ignorato

> Il nostro approccio è quindi: **whitelist** = solo campi definiti.

### 5.4 Array: crescita e impatto performance

Array lunghi (anche se non indicizzati) hanno costi:

- dimensione documento
- payload API
- RAM e tempo di serializzazione
- multikey index se indicizzati

**Regola pratica:**
- `visibilityRoles`: tenerlo corto (1–3, raramente >10)
- `referenceMulti`: evitare liste enormi (centinaia/migliaia)
- `geoPointArray`:  evitare “tracce infinite”
- `labelValuePairs` / `keyValueNumber`: evitare liste molto lunghe

---

## 6) Casi di utilizzo estremi (edge cases) e come gestirli

### Caso estremo A — FE manda tutto string (anche array/oggetti)
Esempio: `"true"`, `"10,50"`, `"2026-02-12"`.

✅ Soluzione:
- casting centralizzato per tipo
- trim string
- number parser (virgola → punto)
- date parser robusto

### Caso estremo B — patch con “svuotamenti”
Esempio: l’utente cancella un campo in UI.

✅ Regola:
- se arriva `""` o `null` ⇒ `$unset data.<campo>`
- così il campo sparisce davvero (sparse) e non gonfia indici

### Caso estremo C — array multipli grandi
Esempio: `referenceMulti` con 2.000 elementi o `labelArray` gigante.

⚠️ Rischi:
- documento cresce
- query e update diventano più costosi
- se indicizzato = multikey pesante

✅ Contromisure:
- definire limiti a livello UI o BE (max items)
- se serve “lista enorme”, meglio modellare come entità dedicate (Aule/Eventi o altra collection)

---

## 7) Indicizzazione: regole per non appesantire il sistema

Atlas indicizza `data.<campo>` solo per campi strategici (preview/searchIn).

**Regola d’oro:**
- indicizza pochi campi, solo quelli usati davvero in:
    - liste
    - filtri
    - sort
    - searchbar

### 7.1 Cosa evitare

- indicizzare molti campi “variabili” o inutilizzati
- indicizzare campi lunghi (`textarea`)
- indicizzare array grandi (multikey) a meno che non sia essenziale
- salvare campi vuoti (`""`/`null`) che entrano in indice “in massa”

### 7.2 Cosa fare

- usare sparse data (unset dei vuoti)
- limitare preview/searchIn a campi davvero operativi
- se serve full-text/fuzzy su molti campi:
    - considerare strategie dedicate (Atlas Search / Elastic / pipeline custom)

---

## 9) File coinvolti (indicazione)

- Tipi e catalogo:
    - `src/config/anagrafiche.fields.catalog.ts`
- Definizioni per slug:
    - `src/config/anagrafiche.registry.ts` (getAnagraficaDef)
- Mutations (update/patch/create):
    - `src/server-utils/service/Anagrafiche/mutations/*`
- Casting serio (builder consigliato):
    - `mutations/<op>/builders/data.ts` (build $set/$unset)
