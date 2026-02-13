# API Anagrafiche (Next.js) — GET / POST / PATCH / DELETE

> **Percorsi**
>
> * Collection (per tipo): `src/app/api/anagrafiche/[type]/route.ts`
> * Item (per id): `src/app/api/anagrafiche/[type]/[id]/route.ts`
>
> **Runtime**: `export const runtime = "nodejs";`

Questa documentazione descrive le **API HTTP** per le anagrafiche, coerenti con la nuova architettura:

* **List (GET collection)** = motore di visibilità (ACL list).
* **Write/Delete (POST/PATCH/DELETE)** = mutation “meccaniche” (casting + ops) **senza** ACL byFilter nel writer.
* **Permission** = check espliciti a livello API (`hasPermission`).

---

## 0) Sicurezza: regola d’oro

Le mutations di write/delete **NON** applicano `byFilter ACL` nel writer.

Quindi:

1. **List ACL** governa cosa l’utente vede.
2. **API** governa cosa l’utente può **creare/modificare/cancellare**.

> ✅ **Mai chiamare update/delete/create senza check permessi a monte in API.**

---

## 1) Risorse e URL

### 1.1 Collection

* **Endpoint**: `GET /api/anagrafiche/:type`
* **Endpoint**: `POST /api/anagrafiche/:type`

Dove `:type` è lo slug config-driven (es. `clienti`, `fornitori`, `conferme-ordine`, …).

### 1.2 Item

* **Endpoint**: `GET /api/anagrafiche/:type/:id`
* **Endpoint**: `PATCH /api/anagrafiche/:type/:id`
* **Endpoint**: `DELETE /api/anagrafiche/:type/:id`

Dove `:id` è l’identificativo del record (ObjectId).

---

## 2) Validazione type

Ogni route valida `type` usando il registry:

* `getAnagraficaDef(type)`

Se lo slug non esiste:

* **404** `{ message: "Unknown type" }`

---

## 3) Permission checks

Ogni API applica un permesso esplicito via `hasPermission(auth, perm, { resourceType: type })`.

Permessi tipici:

* `anagrafica.view` (GET list, GET by id)
* `anagrafica.create` (POST)
* `anagrafica.update` (PATCH)
* `anagrafica.delete` (DELETE)

Se manca permesso:

* **403** `{ message: "Forbidden" }`

---

## 4) GET — List (collection)

### 4.1 Endpoint

`GET /api/anagrafiche/:type`

### 4.2 Query params supportati

* `query`: string (ricerca)
* `docType`: string (filtro documentType)
* `visibilityRole`: string (filtro dominio: `visibilityRoles` contains)
* `page`: number (default `1`)
* `pageSize`: number (default `25`, max `200`)

**Sort (safe)**

* `sortKey`: string
* `sortDir`: `asc` | `desc`

> Mapping verso `ListSortKey` **limitato** a `updatedAt/createdAt` e ai campi preview (title/subtitle/searchIn).

**Projection dinamica (opzionale)**

* `fields`: CSV (`fields=a,b,c`) oppure ripetuto (`fields=a&fields=b`)

### 4.3 Response

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 25,
  "sort": "updatedAt_desc",
  "fields": ["..."]
}
```

### 4.4 Errori

* 401/redirect: gestito da `requireAuth`
* 404: type non valido
* 403: permesso mancante

---

## 5) POST — Create (collection)

### 5.1 Endpoint

`POST /api/anagrafiche/:type`

### 5.2 Body

```json
{
  "data": { "...": "..." },
  "visibilityRoles": ["ROLE_A", "ROLE_B"],
  "visibilityRole": "ROLE_A"
}
```

Note:

* `data` è un blob Mixed (il cast forte avviene server-side via registry).
* `visibilityRoles` è preferito.
* `visibilityRole` è compatibilità (singolo ruolo).

### 5.3 Pipeline

1. Auth (`requireAuth`)
2. Validazione `type` (registry)
3. Permission `anagrafica.create`
4. Parse body + normalize `visibilityRoles`
5. Call mutation `createAnagrafica({ type, userId, data, visibilityRoles })`
6. `runAnagraficaAutoActionsOnSave` (post-save)
7. Response `{ id }`

### 5.4 Response

* **201**

```json
{ "id": "..." }
```

---

## 6) GET — By id (item)

### 6.1 Endpoint

`GET /api/anagrafiche/:type/:id`

### 6.2 Note ACL

Se vuoi garantire anche: **“non puoi leggere ciò che non vedi”**, il `getById` dovrebbe applicare l’ACL list (accessFilter) oppure un check `exists` con accessFilter.

### 6.3 Response

* **200** DTO record
* **404** `{ message: "Not found" }`

---

## 7) PATCH — Update (item)

### 7.1 Endpoint

`PATCH /api/anagrafiche/:type/:id`

### 7.2 Body (patch-like)

```json
{
  "data": {
    "statoAvanzamento": "Taglio"
  },
  "visibilityRoles": ["ROLE_A"],
  "visibilityRole": "ROLE_A"
}
```

Regole:

* `data` contiene **solo i campi toccati**.
* Campi vuoti ("", null, undefined, [], whitespace) possono diventare `$unset` lato mutation (sparse strategy).

### 7.3 Pipeline

1. Auth
2. Validazione `type`
3. Permission `anagrafica.update`
4. Read `before` (per auto-actions ON_CHANGE / ON_FIRST_SET)
5. Parse body (`data` patch + normalize `visibilityRoles`)
6. Call mutation `updateAnagrafica({ type, id, updatedById, data, visibilityRoles })`
7. `runAnagraficaAutoActionsOnSave({ previousData })`
8. Response DTO updated

### 7.4 Response

* **200** DTO record aggiornato
* **404** `{ message: "Not found" }`

---

## 8) DELETE — Delete (item)

### 8.1 Endpoint

`DELETE /api/anagrafiche/:type/:id`

### 8.2 Pipeline

1. Auth
2. Validazione `type`
3. Permission `anagrafica.delete`
4. Call mutation `deleteAnagrafica({ type, id })`
5. Response

### 8.3 Response

* **200**

```json
{ "ok": true, "id": "..." }
```

Se record non trovato:

* **404** `{ message: "Not found" }`

Se id invalido (contract mutation: `throw new Error("INVALID_ID")`):

* **400** `{ message: "Invalid id" }`

---

## 9) Normalizzazione visibilityRoles (helper)

Le API accettano:

* `visibilityRoles`: `string[] | string | null`
* `visibilityRole`: `string | null` (legacy)

Semantica:

* **undefined** → non modificare
* **null** → svuota
* **string/string[]** → setta array normalizzato (trim + remove empty)

---

## 10) Esempi rapidi

### 10.1 List (cerca per numeroOrdine)

```http
GET /api/anagrafiche/conferme-ordine?query=12345&docType=confermaOrdine&pageSize=1
```

### 10.2 Update patch statoAvanzamento

```http
PATCH /api/anagrafiche/conferme-ordine/65f...
Content-Type: application/json

{
  "data": { "statoAvanzamento": "Spedizione" }
}
```

### 10.3 Delete

```http
DELETE /api/anagrafiche/conferme-ordine/65f...
```

---

## 11) Checklist operativa

* [ ] Route valida `type` con `getAnagraficaDef`
* [ ] Route fa `hasPermission` corretto (view/create/update/delete)
* [ ] POST/PATCH normalizzano `visibilityRoles`
* [ ] PATCH legge `before` se servono auto-actions con `previousData`
* [ ] Mutations chiamate **solo dopo** i check permessi
* [ ] Response codes coerenti (201 create, 404 not found, 400 invalid id)
