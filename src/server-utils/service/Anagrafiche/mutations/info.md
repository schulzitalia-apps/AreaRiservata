# Atlas — Mutations Anagrafiche (Create / Update / Delete)

> Percorso: `src/server-utils/service/Anagrafiche/mutations/*`

Questa documentazione descrive **la struttura delle mutations** e la **scelta di sicurezza** adottata:

* **La visibilità dei record** (cosa l’utente “vede”) è governata dall’ACL della **list** (key filters + visibilityRoles + owner + ecc.).
* **Le operazioni di scrittura** (update/delete) **NON** usano il “byFilter ACL” nel writer.
* La **sicurezza write/delete** viene applicata **a livello API** (route/controller), con regole esplicite di permesso.

Obiettivo: avere un sistema **operativo, leggibile e testabile**, dove:

* la list è il “motore” di visibilità;
* la write è “meccanica” (casting + update ops);
* la permission è “chiara” (check in API, non implicita nel DB filter).

---

## 1) Scelta di sicurezza: niente byFilter nel writer

### 1.1 Perché questa scelta

Usare `findOneAndUpdate({ _id, ...accessFilter })` e `findOneAndDelete({ _id, ...accessFilter })` crea un comportamento implicito:

* **se lo vedi, lo modifichi/cancelli** (salvo altre logiche).

Questo può andare bene in alcuni sistemi, ma qui scegliamo una regola più esplicita:

* **VIEW** (cosa vedi) ≠ **EDIT/DELETE** (cosa puoi cambiare)

Quindi:

* **ACL list**: definisce *cosa l’utente può vedere* (incluse keyFilters).
* **API**: definisce *se l’utente può modificare/cancellare* (ruolo, policy, stato, ownership, ecc.).

### 1.2 Conseguenze operative

* Il writer riceve **solo**: `Model`, `id`, e `ops` (o payload) → fa l’operazione.
* Se l’API non fa i check, la mutation potrebbe operare su record non “visibili”.

> Regola d’oro: **mai chiamare le mutations di write/delete senza un check di permesso a monte.**

### 1.3 Come applicare i check in API (pattern)

Pattern consigliato (operativo):

1. **Validazione input** (id/slug/user)
2. **Check permesso** (role/policy + eventuale ownership)
3. **Chiamata mutation**

Esempio concettuale:

* `canEditAnagrafica(auth, slug)`
* `canDeleteAnagrafica(auth, slug)`

Se vuoi anche evitare modifiche su record “non visibili”, puoi fare un check esplicito:

* `GET by id` con accessFilter (o una query “exists” con accessFilter) **prima** di update/delete.

---

## 2) Struttura cartelle

```
mutations/
  builders/
    input.ts     // normalizzazione/validazione cheap input
    data.ts      // casting + sparse strategy + build ops data.*
    audit.ts     // campi audit (createdBy/updatedBy/owner)
    ops.ts       // merge/compose delle ops Mongo ($set/$unset)

  create/
    create.ts    // orchestratore create
    index.ts     // export createAnagrafica (+ types)

  update/
    update.ts    // orchestratore update (patch-like)
    index.ts     // export updateAnagrafica (+ types)

  delete/
    delete.ts    // orchestratore delete
    index.ts     // export deleteAnagrafica (+ types)

  writers/
    create.ts    // Model.create(payload)
    update.ts    // Model.findByIdAndUpdate(id, ops)
    delete.ts    // Model.findByIdAndDelete(id) (o payload)

  mappers/
    full.ts      // map doc -> AnagraficaFull (output mutation)

  field_types_mutations.info.md  // doc tipi + casting + limiti
  index.ts                        // export barrel (create/update/delete)
```

### 2.1 Principio di divisione responsabilità

* **builders/**: funzioni pure, deterministic, testabili.

    * nessun DB.
    * fanno casting, sanitizzazione, e costruzione delle ops.

* **writers/**: side-effects (DB), minimi e isolati.

    * niente casting.
    * niente logica business.

* **create/update/delete/**: orchestratori.

    * collegano i builder → writer → mapper.

* **mappers/**: trasformazione documento DB → DTO pubblico.

---

## 3) Contratti (tipi) usati dalle mutations

> I DTO e gli input types sono definiti in `mutations/types.ts` (o `../types`).

### 3.1 Regola chiave: `data` è Mixed

* `data: Record<string, any>`
* il “tipo forte” sta nel **registry** (def.fields)

Quindi:

* **casting** obbligatorio server-side
* **sparse strategy** consigliata (non salvare chiavi vuote)

### 3.2 Semantica update (patch-like)

Update è volutamente **patch-like**:

* `params.data` contiene **solo** i campi toccati
* per ogni chiave:

    * `"" | null | undefined | [] | whitespace` ⇒ `$unset data.<key>`
    * altrimenti ⇒ `$set data.<key> = casted`

> Questo evita read+merge, e riduce bloat nel blob `data`.

---

## 4) Flusso Create

File: `mutations/create/create.ts`

Pipeline:

1. `normalizeCreateInput(params)`
2. `connectToDatabase()`
3. `Model = getAnagraficaModel(slug)`
4. `castedData = buildCreateDataObject(slug, data)`

    * casting config-driven
    * sparse: non salva chiavi vuote
5. `audit = buildAuditCreateFields(userId)`
6. `writeCreateAnagrafica(Model, payload)`
7. ritorna `{ id }`

### Note pratiche

* Se vuoi un output “full” post-create: aggiungi mapper `mapToAnagraficaFull(created)`
* Valuta payload size (attachments, ecc.)

---

## 5) Flusso Update

File: `mutations/update/update.ts`

Pipeline:

1. `normalizeUpdateInput(params)`
2. `connectToDatabase()`
3. `Model = getAnagraficaModel(slug)`
4. `dataOps = buildDataPatchOps(slug, params.data)`
5. `auditOps = buildAuditPatchOps(updatedById)`
6. `visibilityOps` (solo se `visibilityRoles` presente)
7. `updateOps = buildMongoUpdateOps([dataOps, auditOps, visibilityOps])`
8. `updated = writeUpdateAnagrafica(Model, id, updateOps)`
9. `return mapToAnagraficaFull(updated)`

### Note pratiche

* Update è **atomico** (1 query) e non fa read+merge.
* Se `dataOps` è null e cambia solo audit/visibility, funziona comunque.

---

## 6) Flusso Delete

File: `mutations/delete/delete.ts`

Pipeline:

1. `normalizeDeleteInput(params)`
2. `connectToDatabase()`
3. `Model = getAnagraficaModel(slug)`
4. `deleted = writeDeleteAnagrafica(Model, id)` 
5. ritorna `{ ok: false }` se non trovato, altrimenti `{ ok: true, id }`

### Note pratiche

* Delete non applica ACL byFilter.
* La permission è responsabilità API.

---

## 7) Builders: cosa fanno e cosa NON fanno

### 7.1 `builders/input.ts`

* Validazioni “cheap”

    * type: string non vuota
    * id: ObjectId valido
    * updatedById/userId: ObjectId valido

Non fa:

* DB
* letture config “pesanti” (se vuoi whitelist slug lo fai altrove o via registry)

### 7.2 `builders/data.ts`

* Casting config-driven via `getAnagraficaDef(slug)`
* Normalizzazione coerente per tipo
* Implementa sparse strategy:

    * vuoti ⇒ `null` ⇒ orchestratore mette `$unset`

> Qui vive la logica più importante: garantire che i reference siano ObjectId e che i campi vuoti non finiscano nel DB.

### 7.3 `builders/audit.ts`

* Create:

    * owner, createdBy, updatedBy
* Update:

    * updatedBy

### 7.4 `builders/ops.ts`

* Merge di più blocchi `{ $set, $unset }` in uno solo
* De-dup e merge safe

---

## 8) Writers: come devono essere scritti

Principio: **semplici, no logica, no casting**.

### 8.1 Create writer

* `Model.create(payload)`

### 8.2 Update writer

* `Model.findByIdAndUpdate(id, ops, { new:true }).lean()`

### 8.3 Delete writer

* `Model.findByIdAndDelete(id).lean()`

> Se la tua API vuole una signature uniforme “payload-based”, usa `{ id }` come payload anche per delete.

---

## 9) Collegare le API a queste mutations

### 9.1 Route → Service (pattern)

In una route tipo:

* `POST /api/anagrafiche/:type` → `createAnagrafica`
* `PATCH /api/anagrafiche/:type/:id` → `updateAnagrafica`
* `DELETE /api/anagrafiche/:type/:id` → `deleteAnagrafica`


### 9.2 Check permessi (operativo)

Esempi di check tipici:

* ruolo può editare/cancellare quel tipo?
* solo owner può cancellare?
* record in stato “chiuso” non modificabile?

Se vuoi garantire anche “non puoi modificare ciò che non vedi”, aggiungi:

* un check `exists` con accessFilter prima della mutation

---

## 10) Note performance e limiti

### 10.1 Sparse fields = meno bloat

* Non salvare chiavi vuote riduce:

    * dimensione del documento
    * costo di update
    * index size (soprattutto se indicizzi data.*)

### 10.2 Attenzione ai campi pesanti

Evita di usare `data` per:

* array enormi
* testi lunghissimi non necessari
* strutture profondamente nidificate

### 10.3 Indicizzazione

* Indicizzare molti `data.<field>` può costare tanto
* Indicizza solo i campi necessari a:

    * sort
    * filter
    * lookup frequenti

