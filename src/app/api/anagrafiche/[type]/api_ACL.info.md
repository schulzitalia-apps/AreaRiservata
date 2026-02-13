# Evolve Atlas — API Access & ACL (guida breve)

> Da mettere vicino alle route API (`src/app/api/**`).
>
> Questa guida NON sostituisce la documentazione “ACL engine” nei service: la completa.

---

## 1) Perché esistono **due** livelli: API Permission vs ACL (row-level)

In Atlas ci sono due domande diverse:

1. **Posso chiamare questo endpoint?** (permesso “di azione”)
2. **Quali record mi può restituire / modificare?** (sicurezza “per record”)

Queste due responsabilità vanno tenute separate per evitare bug e data-leak.

---

## 2) API layer: Permission Gate (coarse-grained)

**Dove vive:** route API (es. `src/app/api/anagrafiche/[type]/route.ts`).

**Cosa fa:** decide se un utente può eseguire un’azione (CRUD) su un **resourceType**.

Esempi:

* `hasPermission(auth, "anagrafica.view", { resourceType: type })`
* `hasPermission(auth, "anagrafica.create", { resourceType: type })`

**Risultato:**

* se NON hai permesso → `403 Forbidden`
* se hai permesso → puoi entrare nel service

> Questo livello è **necessario** perché evita che ruoli non autorizzati possano anche solo interrogare un tipo.

---

## 3) Service layer: ACL Filter (row-level security)

**Dove vive:** service/query (es. `src/server-utils/service/Anagrafiche/list/*`).

**Cosa fa:** applica un filtro DB che limita i documenti **visibili** all’utente.

Tipicamente il filtro ACL è un **OR** tra:

* owner: `{ owner: auth.userId }`
* visibilità documento: `{ visibilityRoles: { $in: ["Public","PublicReadOnly", auth.role] } }`
* key scopes (config-driven): `_id in keys` oppure `data.<ref> in keys`
* membership aule (se previsto): `aule.aulaId in keys` (+ `aule.aulaType`)

**Risultato:**

* anche se l’utente ha `view`, vede **solo** i record autorizzati

> Questo livello è **obbligatorio**: senza row-level ACL, un utente con `view` vedrebbe tutto.

---

## 4) Come si combinano (regola d’oro)

### Lettura (list / get)

* API: **hasPermission(view)** (gate)
* Service: **ACL filter** (row-level)

✅ Regola: *“All reads must pass both: action permission + row-level filter.”*

### Scrittura su record esistente (edit / delete)

* API: **hasPermission(edit/delete)** (gate)
* Service/mutation: **record-level check**

    * oppure applicando ACL + `_id` in query
    * oppure usando un helper tipo `canEditOrDeleteResource(...)`

✅ Regola: *“Writes require action permission + row-level check.”*

### Creazione (create)

* API: **hasPermission(create)** (gate)
* Service: set audit fields (owner/createdBy/updatedBy)
* Extra importante: **field-level sanitize**

    * es: normalizzare `visibilityRoles`
    * evitare escalation (non dare all’utente la possibilità di impostare ruoli/policy non ammessi)

✅ Regola: *“Create requires action permission + sanitize campi sensibili.”*

---

## 5) Importante: `visibilityRole` (query param) NON è ACL

Nelle list API esiste spesso un filtro query param tipo `visibilityRole=Commerciale`.

**Questo è un filtro di dominio** (business), non sostituisce l’ACL.

Implementazione tipica su schema:

* documento: `visibilityRoles: string[]`
* filtro dominio: `{ visibilityRoles: <role> }`

In MongoDB questa forma significa **array contains**.

---

## 6) Configuratore: `ResourcesConfig` (la fonte dichiarativa)

> File: `src/config/access/access-resources.config.ts`

Questa config descrive:

1. **azioni per ruoli** (permission gate)
2. **key filters** (row-level ACL aggiuntivo, oltre a owner/visibilityRoles)

### 6.1 Actions (permission gate)

Per ogni risorsa (domain + slug) dichiara:

* `view/create/edit/delete` → quali ruoli possono farlo
* `ownOnlyRoles` (opzionale) → ruoli che possono editare **solo se owner** (logica applicata nei check di write)

Esempio mentale:

* `edit.roles = ["Super","Amministrazione"]`
* `edit.ownOnlyRoles = ["Commerciale","Agente"]`

Interpretazione:

* Super/Amministrazione possono editare in generale
* Commerciale/Agente possono editare **solo** record di cui sono owner

### 6.2 Key Filters (row-level)

I keyFilters definiscono come usare `auth.keyScopes` per estendere (o restringere) la visibilità.

Concetti:

* **scope.kind**: dove vivere le chiavi (`"anagrafica"` oppure `"aula"`)
* **scope.slug**: sotto-tipo (es. `"clienti"` oppure `"agenti"`)
* **mode**: come si applicano quelle key

Modes supportati:

1. `self`

* chiavi applicate su `_id`
* esempio: “vedo solo questi clienti”

2. `byReference`

* chiavi applicate su `data.<referenceFieldKey>`
* esempio: “vedo conferme-ordine se `data.codiceCliente` punta a un cliente nelle mie key”

3. `byAulaMembership`

* chiavi applicate su `aule.aulaId` (+ `aule.aulaType`)
* esempio: “se ho key su una certa Aula (agenti), vedo tutte le anagrafiche partecipanti”

Ogni keyFilter ha anche:

* `roles`: solo questi ruoli attivano quella regola
* `enabled`: per spegnere rapidamente una regola senza eliminarla

---