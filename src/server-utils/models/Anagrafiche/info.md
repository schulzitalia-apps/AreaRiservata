# Evolve Atlas — Anagrafiche (schema base + model dinamici + indicizzazione)

## 0) Contesto: “mattoni” del modello flessibile Atlas

Lo **schema Anagrafica** è il primo mattone del sistema flessibile **Evolve Atlas** (config-driven).

L’idea di fondo è semplice: molte aziende hanno strutture dati simili (clienti, contatti, fornitori, articoli…), ma ogni realtà ha campi ed esigenze diverse, che possono cambiare nel tempo.

> Il sistema a schemi configurabili di Atlas nasce per **evitare progetti “rigidi”** che richiedono continue migrazioni e rilasci per aggiungere o modificare campi.

Atlas gestisce tre principali tipi di dato flessibile:

1. **Anagrafiche**: strutture dati finalizzate all'archiviazione (l'entità ora in esame).
2. **Aule**: strutture dati simili alle anagrafiche, ma orientate al raggruppamento di anagrafiche semplici (es. classi/corsi/gruppi/progetti).
3. **Eventi**: strutture dati simili alle anagrafiche, ma con una data come campo orientante (es. appuntamenti, scadenze, sessioni, attività a calendario).

Nel contesto di questa separazione, la scelta chiave (che rende Atlas “elastico”) è quella di separare in ognuno dei suddetti modelli:

* `data`: un blob di campi **custom** definiti da file di configurazione (variabili per tipo)
* campi **core** fuori da `data` (strutturati e indicizzabili): `visibilityRoles`, `attachments`, `aule`
* audit e timestamps standard (per tracciare proprietà e modifiche nel tempo)

Questa separazione permette al sistema di rimanere **configurabile** e al tempo stesso **performante e consistente**.

---

## 1) Modello dati: Anagrafica

### 1.1 Cos’è un’Anagrafica in Atlas

Un’Anagrafica è un “contenitore” di dati che può rappresentare:

* un cliente
* un fornitore
* un articolo
* un ente
* un bando
* un contatto
* …e qualsiasi altro tipo definito a configurazione

Ogni “tipologia di anagrafica” - che da ora in poi chiameremo `slug` - può avere campi diversi, ma usa lo stesso “motore” di archiviazione di ogni altra anagrafica.

### 1.2 `IAnagraficaDoc` (documento principale)

Rappresenta il documento Mongoose “Anagrafica”. In pratica è la forma “ufficiale” con cui il backend salva e recupera i dati dal database.

Include:

* `data: Record<string, any>` → campi custom, flessibile. Si tratta del blob in grado di contenere lo scheletro di uno `slug` anagrafico custom.
* core: `visibilityRoles`, `attachments`, `aule` - campi necessari alla gestione uniforme di comportamenti previsti per ogni `slug` anagrafico.
* audit: `owner`, `createdBy`, `updatedBy`
* timestamps: gestiti dal database/ORM per sapere quando un record è stato creato e quando è stato aggiornato.

> Key Point: **il cuore di Atlas è `data`** (configurabile), mentre alcune informazioni sono “standard”. Questo permette, come vedremo, di mantenere qualità, flessibilità e performance.

### 1.3 Perché esistono campi “core” fuori da `data`

I campi core sono informazioni che:

* servono a molte parti del sistema (non solo a un tipo)

* devono essere consistenti e ben strutturati

* vengono indicizzati "a priori" e con regole chiare

* **`visibilityRoles`**: gestione visibilità/permessi (es. ruoli o policy) — **supporta visibilità complesse** (più ruoli per record)

* **`attachments`**: allegati (documenti, PDF, immagini) con collegamento ad archiviazione documentale

* **`aule`**: collegamento tra anagrafiche e gruppi (per trovare rapidamente “chi sta in cosa”)

---

## 2) Flessibilità di `data` (Mixed)

### 2.1 Cosa significa “Mixed”

con `data` - l'idea di base è quella di costruire un blob JSON flessibile: può contenere stringhe, numeri, boolean, null, oggetti annidati e array.

**Esempi validi dentro** `data`:

* String: `{ "nome": "Mario" }`
* Number: `{ "punteggio": 87.5 }`
* Boolean: `{ "consensoMarketing": true }`
* Array di primitivi: `{ "tags": ["vip", "newsletter"] }`
* Array di oggetti: `{ "telefoni": [{ "tipo":"mobile", "numero":"+39..." }] }`
* Oggetti annidati: `{ "indirizzo": { "via":"...", "cap":"..." } }`

> **Key Point:**
> lo schema database non impone qui la forma “rigida”. La validazione (cosa è permesso e cosa no) viene gestita dai **file di configurazione Atlas delle anagrafiche, integrati alla logica applicativa**.

**Limiti “sani” alla flessibilità**.

Come vedremo, l'indicizzazione a db ha un costo. Atlas nasce con l'idea di tenere basso il costo dell'indicizzazione permettendo una configurazione studiata **ad hoc** sull'esigenza dell'azienda che lo configura, con la prospettiva che ogni piccola e media impresa abbia un range piuttosto specifico di azioni operative comuni sulle quali basa la propria intera operatività.

Per mantenere il sistema Atlas stabile e veloce:

* array molto grandi o campi testuali enormi vanno gestiti con attenzione (dimensioni/payload).
* la configurazione Atlas deve definire chiaramente i campi “importanti” da usare in liste e ricerca - in modo da **concentrare le risorse su essi**.

---

## 3) Model dinamici: come un “tipo” diventa una collection Mongo

### 3.1 Concetto

> In Atlas, ogni `slug` anagrafico viene salvato in una **collection dedicata**.

### 3.2 Flusso (a colpo d’occhio)

```
Tipo Atlas (es. "clienti")

  -> definizione config (getAnagraficaDef)
     - collection: "anagrafiche__clienti"
     - preview/search: campi strategici
     
  -> getAnagraficaModel(type)
     - MODEL_NAME: "Anagrafica_v2__anagrafiche__clienti"  (nome interno)
     - collection reale: "anagrafiche__clienti"           (Nome in Mongo Atlas)
     - schema comune: buildAnagraficaSchema()
     
  -> ensureIndexes(model,type)
     - crea indici base + indici su data.<campo> + indici su aule
```

---

## 4) Indicizzazione MongoDB: panoramica essenziale

### 4.1 Cos’è un index in MongoDb

Gli index permettono al database di trovare rapidamente i documenti senza scansionare tutto.

Nel contesto di Atlas gli indici sono applicati per:

* filtri (es. “tutti i clienti con CAP 00100”)
* ordinamenti (es. “ordina per cognome”)
* ricerche su campi specifici e searchbar

### 4.2 Trade-off

Gli indici rendono le letture più veloci, ma:

* occupano spazio su disco;
* aumentano il costo delle scritture (inserimenti/modifiche devono aggiornare anche gli indici).

> Da qui nasce l'idea di costruire un sistema che consenta **indici mirati**.

---

## 5) Indicizzazione “parziale” dei campi custom in `data`

### 5.1 Principio

Anche se `data` è Mixed, Mongo può indicizzare **path specifici**:

**es.**

* `data.nome`
* `data.codiceFiscale`
* `data.sku`

Quindi: `data` non è (e non è pensato per essere) indicizzabile “in blocco”, ma lo è su **chiavi selezionate**.

### 5.2 Come Atlas decide cosa indicizzare

Nella funzione **ensureIndexes(model: Model<IAnagraficaDoc>, type: string)** -  Atlas usa la configurazione del tipo per individuare i campi usati in:

* titolo (preview title)
* sottotitolo (preview subtitle)
* ricerca (searchIn)

Su questi campi crea indici su `data.<campo>`. Tali `data.<campo>` sono definibili nel file "anagrafiche.types.public" di configurazione delle anagrafiche.

### 5.3 Vantaggi

* liste rapide anche su dataset grandi (decine di migliaia per tipo);
* filtri e ordinamenti fluidi;
* flessibilità di `data` mantenuta.

### 5.4 Limiti e best practice

* indicizzare troppi campi aumenta costi e complessità;
* su array (multikey index) bisogna fare attenzione a cardinalità e crescita;
* ricerche testuali evolute (fuzzy/full-text su tanti campi) richiederanno strategie dedicate.

---

## 6) Funzioni principali dei due file Model esposti

### 6.1 `buildAnagraficaSchema()` — schema base comune

**Scopo:** creare lo schema Mongoose condiviso da tutti i tipi anagrafici.

Caratteristiche:

* `data` resta flessibile (Mixed);
* campi core sono strutturati e coerenti;
* pronta per essere agganciata a model diversi (uno per collection).

### 6.2 `getAnagraficaModel(type)` — recupero/creazione del model per tipo

**Scopo:** ottenere un Model Mongoose collegato alla collection del tipo.

Cosa fa:

* legge la definizione del tipo (collection e campi preview/search);
* crea o riusa un model;
* usa cache per evitare ricreazioni;
* avvia la creazione degli indici necessari (una volta per processo/collection).

### 6.3 `ensureIndexes(model, type)` — indici guidati dalla configurazione

**Scopo:** creare gli indici necessari a rendere veloci le operazioni tipiche.

Tipicamente crea:

* indici base (visibilità, ordinamenti principali);
* indici su `data.<campo>` per campi preview/search;
* indici su `aule.*` per collegamenti e filtri su gruppi.

---

## 7) Visibilità complesse: `visibilityRoles` (array) e indicizzazione

### 7.1 Perché un array

Una singola stringa funziona finché l’ACL è “lineare” (1 ruolo per record). Quando serve una visibilità più realistica (record visibile a più ruoli/policy), `visibilityRoles: string[]` evita hack e rimane coerente col paradigma “core fuori da data”.

Per Atlas, che è indirizzato a clienti con esigenze di gestione operativa complessa, garantire una visibilità complessa e sfaccettata dei record in base ai ruoli costruiti ad hoc sulle esigenze del cliente diventa fondamentale per garantire **flessibilità dell'applicativo senza compromessi**.

Per questo motivo in questo caso il compromesso di indicizzazione dell'array deve essere accettato a cuor leggero.


### 7.2 Indicizzazione (multikey)

`visibilityRoles` è un **array indicizzato** → MongoDB crea un **multikey index**: ogni elemento dell’array genera un’entry di indice.

**Impatto pratico:**

* 1–3 ruoli per record → costo indice tipicamente molto contenuto
* decine/centinaia di ruoli per record → indice più pesante e scritture più costose

> **Warning:** l'obbiettivo è quello di mantenere `visibilityRoles` corto (1–3, raramente >10). Se servisse granularità molto alta, l'idea è quella di valutare volta per volta strategie dedicate, considerando anche che - come vedremo - i nostri filtri ACL sono indipendentemente dalla visibilità già estremamente dettagliati.


---

## 8) Dimensione di un documento e limiti di Mongo

La dimensione di un documento mongo (un elemento anagrafico) varia soprattutto per:

* complessità di `data` (annidamenti, array, testi lunghi)
* numero di elementi in `attachments` e `aule`

Questi sotto sono esempi calcolati grossolanamente per dare un ordine di grandezza.
Nel database (BSON) e nelle risposte API (con campi extra o serializzazione) può crescere un po’.

### Caso A — `data` con ~5 campi (semplice)

Esempio: nome, cognome, email, età, consensi.

* **~0.37 KB** (≈ 382 byte) di JSON compatto

### Caso B — `data` con ~20 campi (medio)

Esempio: anagrafica completa + tags + indirizzo + documento + preferenze.

* **~0.87 KB** (≈ 894 byte) di JSON compatto

### Caso C — `data` complesso + array + storico + testo lungo + core valorizzati

Esempio: profilo annidato, telefoni/indirizzi, questionari, storico peso, storico pagamenti,
2 attachments, 2 partecipazioni aule, e un campo testuale extra di ~2000 caratteri.

* **~4.0 KB** (≈ 4075 byte) di JSON compatto

---

### Nota 1 — Limite massimo per documento MongoDB

MongoDB impone un limite massimo di **16 MB per documento**.
Questo è un vincolo superiore teorico: in pratica conviene restare molto lontani da quel limite e gestire dati “pesanti” (file, allegati grandi, ecc.) fuori dal documento (es. storage documentale - nel nostro caso, come vedremo: Cloudflare), lasciando nel documento solo metadati e riferimenti.

---

### Nota 2 — Limite “reale” di storage su Atlas: conta anche l’indice

Su Atlas **M0 (Free)** lo storage è un limite *hard* (non superabile) e vale **0.5 GB**. Inoltre, la quota include:

* **BSON non compresso dei documenti**
* **più** i byte dei relativi **indici**

Su Atlas **Flex** il limite di storage è anch’esso *hard* e il piano base include **5 GB** di storage.

Su cluster **Dedicated (M10+)** lo storage può auto-espandersi (di default) e un **M10** tipicamente parte con **10 GB di disco inclusi** .

---

### Ma quindi quanti documenti ci stanno?

Per stimare quanti documenti entrano in un cluster, serve considerare che **gli indici aggiungono peso**.

#### Formula pratica (stima)

* `dimensione_effettiva ≈ dimensione_documento + overhead_indici`

* un’euristica semplice:

  * overhead indici **~30%** (poche chiavi indicizzate)
  * overhead indici **~50–100%** (molte chiavi indicizzate o indici su campi lunghi/variabili)

> Nota: Atlas per M0/Flex calcola la quota usando `dataSize + indexSize` (quindi la stima “documento + indici” è proprio il modello corretto).

---

## Esempi numerici (ordine di grandezza)

Per semplicità, assumiamo **overhead indici = +50%** (tipico quando indicizzi alcuni campi `data.*` + qualche indice core).

### Scenario 1 — Documento “medio” (Caso B ~0.87 KB -> 20 campi medi per elemento anagrafico)

* dimensione doc: **0.87 KB**
* con indici (+50%): **~1.31 KB** per record

> **M0 (0.5 GB ≈ 512 MB):**
>
> * 512 MB = 512 * 1024 KB = **524,288 KB**
> * record ≈ 524,288 / 1.31 ≈ **~400,000 record**

> **Flex (5 GB):**
>
> * 5 GB = 5 * 1024 * 1024 KB = **5,242,880 KB**
> * record ≈ 5,242,880 / 1.31 ≈ **~4,000,000 record**

> **M10 (10 GB disco incluso, tipico):**
>
> * 10 GB = 10 * 1024 * 1024 KB = **10,485,760 KB**
> * record ≈ 10,485,760 / 1.31 ≈ **~8,000,000 record**

---

### Scenario 2 — Documento “complesso” (Caso C ~4.0 KB -> 150 campi medi per elemento anagrafico)

* dimensione doc: **4.0 KB**
* con indici (+50%): **~6.0 KB** per record

**M0 (0.5 GB):**

* record ≈ 524,288 / 6.0 ≈ **~87,000 record**

**Flex (5 GB):**

* record ≈ 5,242,880 / 6.0 ≈ **~873,000 record**

**M10 (10 GB):**

* record ≈ 10,485,760 / 6.0 ≈ **~1,747,000 record**

---

### Come fare le proprie stime “in modo corretto”

* Se prevedi **molti indici** su `data.*` (molti campi in `preview/searchIn`), usa overhead **+100%** e dimezza circa i numeri sopra.
* Se i campi indicizzati sono **pochi e corti**, overhead **+30%** e i numeri aumentano.

---

### Ma niente paura...

* **M0/Flex**: storage *hard limit* → quando arrivi al limite, le scritture possono fallire finché non liberi spazio o fai upgrade.
* **M10+**: tipicamente supportano **auto-expand storage** e scalano meglio al crescere dei dati (oltre a offrire più opzioni di performance).

---

## 9) Perché questa architettura è adatta a PMI

Questa soluzione è pensata per:

* evolvere velocemente con nuove esigenze;
* evitare migrazioni strutturali frequenti;
* mantenere performance su volumi reali da PMI (decine di migliaia per slug);
* integrare comportamenti separati in moduli component-driven in modo naturale.

---

## 10) Varianti (variant) e campi “sparsi” nel blob `data`: perché conviene anche sugli indici

In Atlas, una **variant** (o “variante” - come vedremo in altra sede -) è un modo per rappresentare la stessa slug anagrafica con **insiemi di campi diversi** a seconda del caso d’uso.

Esempio semplice:

* una spesa “utenze” può avere campi come `fornitore`, `statoFatturazione`, `dataFattura`
* una spesa “magazzino” può avere campi come `piattaformaAcquisto`, `materialeConsumato`, `numeroPezzi`

In entrambi i casi parliamo della *stessa anagrafica slug “Spese”*, ma con **varianti** di struttura: alcuni campi sono pertinenti solo a certe situazioni.

### 10.1 Perché in `data` vedi solo i campi “esistenti”

Quando salvi un documento, Atlas memorizza `data` in modo **sparso** (sparse):

* se un campo non è valorizzato o non è previsto per quella variant, **la chiave non viene proprio salvata**
* quindi nel documento MongoDB non compare “vuota”: in effetti non compare affatto.

Questo approccio è intenzionale e ha due vantaggi:

1. **Riduce la dimensione dei documenti** (meno byte salvati)
2. **Abbassa il costo dell'indicizzazione

### 10.2 Costo di index

Gli index (es. su `data.fornitore`) sono definiti a livello di **slug** (quindi “valgono” per tutti i documenti del tipo), ma **non pesano allo stesso modo su ogni documento**.

* Se un documento **non ha proprio** `data.fornitore` (campo assente/missing), quel documento **non contribuisce** in modo significativo all’indice di `data.fornitore`.
* L’indice cresce principalmente in funzione del numero di documenti che **hanno davvero** quel campo.

In altre parole:

* se su 100.000 documenti solo 10.000 hanno `data.fornitore`, l’indice “pesa” grosso modo come indicizzare 10.000 valori, non 100.000.

### 10.3 Cosa evitare: campi “vuoti” che gonfiano l’indice

Se invece si salvano campi “vuoti” in modo esplicito (es. `data.fornitore: ""` o `null`) su molti documenti:

* quei documenti finiscono comunque nell’indice con un valore ripetuto (vuoto/null)
* l’indice cresce molto di più
* spesso senza portare beneficio reale alle query

**Best practice Atlas:** per campi non applicabili a una variant, è meglio **non scrivere la chiave** in `data` invece di salvarla come vuota.
