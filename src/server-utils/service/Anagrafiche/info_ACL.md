# Evolve Atlas — Query Anagrafiche: filtri ACL (Access Filter) e come funzionano

Questa sezione documenta **la parte di sicurezza/ACL** usata dalla query di listing (`listAnagrafiche`).
L’obiettivo è spiegare, in modo tecnico ma leggibile, **come decidiamo cosa un utente può vedere** e
**come i filtri vengono costruiti e applicati** dentro la servizio di query.

> **Update (v2):** `visibilityRole` è stato sostituito da `visibilityRoles: string[]` per supportare **visibilità complesse**.
> La semantica di base resta **OR**: se un documento contiene uno dei ruoli/policy ammessi, è visibile.

---

## 1) I “pezzi” coinvolti (panoramica)

Quando `listAnagrafiche` deve recuperare una lista di record dal database, applica due famiglie di filtri:

1. **Filtri di dominio** (business filter)

    * Esempi: `docType`, `visibilityRole` richiesto (input), ricerca testuale, ecc.
    * Servono a restringere *cosa* stai cercando.

2. **Filtri ACL / Accesso** (security filter)

    * Sono sempre applicati (a meno che l’utente sia admin).
    * Servono a decidere *cosa sei autorizzato a vedere*.

Il filtro ACL principale viene generato da:

* `buildMongoAccessFilter(auth, slug)`
  (nel file `src/server-utils/access/access-engine.ts`)

ed è governato da:

* `AuthContext` (chi è l’utente e quali “key” possiede)
* `ResourcesConfig` (regole di accesso per risorsa/tipo)

---

## 2) Cos’è `AuthContext` (identità e “chiavi” dell’utente)

`AuthContext` è il “passaporto” dell’utente dentro al backend: contiene i dati minimi necessari per prendere decisioni di accesso.

```ts
export interface AuthContext {
  userId: string;
  role: AppRole;
  isAdmin: boolean;
  keyScopes?: KeyScopes;
}
```

### 2.1 Campi principali

* **userId**: identificativo dell’utente (usato per la regola “owner”)
* **role**: ruolo applicativo (Super, Amministrazione, Commerciale, Agente, ecc.)
* **isAdmin**: scorciatoia per bypassare filtri (in genere per Super/Admin)
* **keyScopes**: “chiavi di visibilità” granulari (visibilità selettiva su subset di record)

### 2.2 Cosa sono `keyScopes`

`keyScopes` è una struttura che rappresenta “a quali subset di dati” l’utente può accedere.

Concetto: invece di dare visibilità “a tutto di un tipo”, posso dire:

* questo utente vede solo **alcuni clienti**
* oppure vede tutte le conferme ordine **collegate** ad alcuni clienti

Esempio:

```js
{
  anagrafica: {
    clienti: ["64f...", "650..."],
    "conferme-ordine": ["651..."]
  },
  aula: {
    cantieri: ["700..."]
  }
}
```

* Il **primo livello** indica un “kind” di risorsa (`anagrafica`, `aula`, ...)
* Il **secondo livello** indica lo slug del tipo (`clienti`, `cantieri`, ...)
* Il valore è l’elenco di `_id` autorizzati per quello scope

> In breve: `keyScopes` sono “liste di ID consentiti” organizzate per dominio/tipo.

---

## 3) Cos’è `ResourcesConfig` (regole dichiarative per tipo)

`ResourcesConfig` è una configurazione statica che descrive:

* quali **ruoli** possono fare cosa (`view/create/edit/delete`) su ogni risorsa
* come applicare i **key filters** per quel tipo

Esempio (semplificato):

```ts
ResourcesConfig.anagrafica["conferme-ordine"].keyFilters = [
  {
    scope: { kind: "anagrafica", slug: "clienti" },
    mode: "byReference",
    referenceFieldKey: "codiceCliente",
    roles: ["Agente", "Commerciale", "Cliente"],
    enabled: true,
  }
]
```

Traduzione in parole:

* un Agente/Commerciale/Cliente vede una conferma-ordine se:

    * il campo `data.codiceCliente` punta a un cliente il cui `_id` è dentro alle sue key su `clienti`.

### 3.1 Perché è importante

* rende la sicurezza **configurabile**
* evita hardcoding di regole in mille query diverse
* permette di aggiungere nuovi tipi mantenendo lo stesso “motore”

---

## 4) Che cos’è `buildMongoAccessFilter` (il cuore ACL per Mongo)

`buildMongoAccessFilter(auth, resourceType)` costruisce un filtro MongoDB (un JSON query object)
che viene poi combinato con gli altri filtri di dominio.

### 4.1 Comportamento base

* Se l’utente è admin, ritorna `{}` (nessun filtro).
* Altrimenti crea un filtro in forma:

    * **OR** di più condizioni ACL

> Questo approccio è molto pratico: basta che **una** condizione ACL sia vera per vedere il documento.

---

## 5) Tipi di ACL applicati (quelli usati dalla list)

Dentro `buildMongoAccessFilter` (per le anagrafiche) ci sono tre “strati” principali.

### 5.1 ACL 1 — Owner

Regola: un utente può vedere i record di cui è proprietario.

Filtro:

```js
{ owner: auth.userId }
```

**Quando è utile**

* garantisce sempre un “percorso” di visibilità per chi ha creato/gestisce un record
* evita casi strani in cui la visibilità per ruolo o key è troppo restrittiva

---

### 5.2 ACL 2 — Visibility Roles (pubblico / ruoli)

Regola: un record è visibile se **contiene** in `visibilityRoles` una policy compatibile.

Filtro:

```js
{ visibilityRoles: { $in: ["Public", "PublicReadOnly", auth.role] } }
```

**Significato**

* `Public`: visibile a tutti
* `PublicReadOnly`: visibile a tutti, ma magari non modificabile
* `auth.role`: visibile ai membri di quel ruolo

> Questo meccanismo è un “ACL semplice e veloce” (indicizzabile). Con l’array otteniamo visibilità **complesse** (più ruoli/policy sullo stesso record).

#### Nota performance / indicizzazione (multikey index)

Indicizzare `visibilityRoles` significa creare un **multikey index**: ogni elemento dell’array contribuisce all’indice.

* Se in media hai **1–3 ruoli per record**, il costo resta basso e molto prevedibile.
* Se inizi ad avere array lunghi (decine/centinaia), l’indice cresce molto e aumentano anche i costi di write.

**Best practice Atlas:** mantenere `visibilityRoles` piccolo (tipicamente 1–3) e usare `keyScopes` per granularità vera.

---

### 5.3 ACL 3 — Key Filters (visibilità selettiva)

Regola: alcune risorse possono essere filtrate tramite `keyScopes`, usando il config `keyFilters`.

I keyFilters principali implementati sono:

#### A) `self` (chiave sul record stesso)

Esempio: per `clienti`, un Agente vede solo alcuni clienti (ID specifici).

* Scope: `anagrafica.clienti`
* Mode: `self`
* Filtro Mongo:

```js
{ _id: { $in: [ObjectId(...), ...] } }
```

#### B) `byReference` (chiave su un record “target”, applicata tramite reference)

Esempio: per `conferme-ordine`, la visibilità dipende dalle key su `clienti`.

* Scope: `anagrafica.clienti`
* Mode: `byReference`
* Campo reference: `codiceCliente`
* Filtro Mongo:

```js
{ "data.codiceCliente": { $in: [ObjectId(cliente1), ObjectId(cliente2), ...] } }
```

**Nota importante**
Questo richiede che `data.codiceCliente` sia davvero un `ObjectId` e non una stringa.
Altrimenti il match non scatta: è il motivo per cui esiste la normalizzazione dei reference.

#### C) `byAulaMembership` (chiave su un’aula, accesso via membership)

Esempio: un utente ha key su una o più aule (es. `cantieri`) ⇒ vede tutte le anagrafiche partecipanti.

* Scope: `aula.cantieri`
* Mode: `byAulaMembership`
* Filtro Mongo:

```js
{
  "aule.aulaType": "cantieri",
  "aule.aulaId": { $in: [ObjectId(aula1), ObjectId(aula2), ...] }
}
```

---

## 6) In che ordine `listAnagrafiche` applica i filtri ACL

La query `listAnagrafiche` usa l’ACL in un punto preciso:

1. Costruisce il **baseFilter** (dominio)

    * query testuale (se presente)
    * docType (attachments.type)
    * filtro “manuale” su visibilità (se passato in params) ⇒ `visibilityRoles: <role>`

2. Costruisce l’**accessFilter** chiamando:

    * `buildMongoAccessFilter<IAnagraficaDoc>(auth, slug)`

3. Combina i filtri:

    * tipicamente: `filter = $and: [baseFilter, accessFilter]`
    * se uno dei due è vuoto, usa quello non vuoto

Quindi:

* ACL non viene “dopo”: viene applicato **insieme** al filtro dominio.
* Il database riceve **una sola query** già sicura.

---

## 7) Perché il modello è robusto (anche lato performance)

### Vantaggi

* **Sicurezza centralizzata**: regole in un motore unico.
* **Configurabile**: nuovi tipi e nuove regole via config.
* **Performance-friendly**: owner/visibility/key sono filtri strutturati e spesso indicizzabili.
* **Scalabile**: adatto a PMI con molte migliaia/decine di migliaia di record per tipo.

### Trade-off (controllati)

* I filtri key (`$in` con molti id) crescono con il numero di key.

    * Per questo è buona pratica mantenere gli scope “ragionevoli”
    * e indicizzare i campi coinvolti (es. `owner`, `visibilityRoles`, `data.<ref>`)

* L’indice su `visibilityRoles` (multikey) cresce con:

    * **numero record** che hanno visibilità valorizzata
    * **numero medio di elementi** nell’array per record

---

## 8) Glossario minimale

* **ACL**: regole che definiscono chi può vedere/modificare cosa.

* **Filter Mongo**: oggetto JSON che descrive una query.

* **$or / $and**:

    * `$or`: basta una condizione vera
    * `$and`: devono essere vere tutte le condizioni

* **keyScopes**: liste di ID autorizzati, usate per visibilità selettiva.

* **ResourcesConfig**: regole dichiarative per ruoli + key filters per tipo.

* **visibilityRoles**: array di ruoli/policy sul documento (visibilità semplice/rapida, indicizzabile).
