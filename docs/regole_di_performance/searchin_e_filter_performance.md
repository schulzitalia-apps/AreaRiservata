## Indici e performance (regole operative)

### 1 Indici base (core)

La list trae vantaggio da indici su:

* `owner`
* `visibilityRoles` (multikey)
* `updatedAt`, `createdAt`
* `attachments.type`

### 2 Indici su campi custom (`data.*`)

Gli indici su `data.<campo>` sono creati dinamicamente dal model in base alla config del tipo:

* `preview.title`
* `preview.subtitle`
* `preview.searchIn`


* i campi “di preview” sono i candidati naturali per sort e filtri
* se un campo non è in preview, **non ci basiamo su di lui per sort/search** (evita full scan)

### 3 Search: perché è opzionale

La search usa regex / OR su più campi (`$or`). Anche con indici, una regex non-anchored (`/q/i`) può:

* non sfruttare l’indice in modo efficace
* aumentare il lavoro del query planner

Per questo la pipeline:

* costruisce `searchFilter` **solo se `query` è presente**
* altrimenti la query resta un filtro “pulito” (molto più stabile e veloce)

### 4 Separazione in base alla richiesta e ottimizzazione della resa

* **Senza search**: filtri su campi indicizzati + projection ridotta → ottimo per PMI (migliaia/decine di migliaia)
* **Con search**: dipende dai campi e dal pattern; su dataset medi è ok, su dataset grandi può richiedere strategie dedicate (es. Atlas Search o tokenizzazione)


### 5 Stime e Proiezioni Numeriche

Qui ragioniamo **per ordini di grandezza**. L’obiettivo è capire **come scala** la list/search al crescere di:

* **D** = numero documenti nella collection del tipo (es. `anagrafiche__clienti`)
* **F** = numero campi in `preview.searchIn` (rami dell’`$or`)
* **L** = lunghezza media dei testi (stringhe lunghe ⇒ più lavoro)
* **S** = selettività della query (quanti doc matchano)

> Nota: la search attuale usa regex **contains case-insensitive** (`/q/i`). Questo è più costoso di prefisso (`/^q/i`) e non garantisce pieno utilizzo dell’indice.

---

### A) Senza search (solo filtri indicizzati + projection)

Quando `query` è assente, la list tipicamente usa:

* ACL su `owner` + `visibilityRoles`
* filtri dominio su `attachments.type` e/o `visibilityRoles`
* sort su `updatedAt`/`createdAt`
* projection ridotta (solo preview)

**Scala molto bene**: costo vicino a `O(log D) + O(limit)` perché il DB usa indici e legge pochi documenti.

---

### B) Con search (regex + OR su F campi)

Quando `query` c’è, aggiungi:

```js
{ $or: [
  { "data.k1": /q/i },
  { "data.k2": /q/i },
  ...
  { "data.kF": /q/i }
]}
```

Qui il costo cresce soprattutto con:

* **F** (numero rami OR)
* **S** (query comune ⇒ molti match)
* **L** (testi lunghi ⇒ regex più lenta)

Modello mentale utile:

* lavoro totale ≈ **F × lavoro_per_ramo(D, S, L)**

---

### C) Stime pratiche (range in ms) — incrocio D × F

Assunzioni:

* cluster “medio” (Flex/M10)
* `limit=25`, projection preview
* query selettiva “media” (match ~1–5%)

| D (docs) \ F (campi in OR) |        F=2 |            F=5 |            F=10 |
| -------------------------: | ---------: | -------------: | --------------: |
|                  **1.000** |   10–40 ms |       20–80 ms |       40–150 ms |
|                 **10.000** |  30–150 ms |     120–500 ms |      250–900 ms |
|                 **20.000** |  50–250 ms |     250–900 ms |    600–2.000 ms |
|                **100.000** | 150–800 ms | 1.000–5.000 ms | 3.000–20.000 ms |

Interpretazione rapida:

* sotto i **10k** sei spesso ok anche con 5–8 campi (ma attenzione alle query corte)
* verso **20k** conviene stare su **3–6 campi**
* oltre **100k** regex “contains” diventa instabile ⇒ per miticare servirebbe richiedere agli sviluppatori una SEARCH DEDICATA che ottimizzi il meccanismo REGEX qui esposto

---

### D) Lunghezza delle query e performance

Query molto comuni (es. `a`, `e`, `it`, `@`, `0`, oppure 1–2 caratteri) aumentano drasticamente i match.

Esempio: D=20k, F=5

* query selettiva (“rossi”, “AB-1294”) ⇒ **250–900 ms**
* query corta/comune (“a”, “srl”, “via”) ⇒ **800–3.500+ ms**

**Regola UI consigliata:** non attivare la search per `q.length < 2` (o `< 3` se dataset grandi).

---

### E) Come scegliere quanti campi mettere in `searchIn`

`searchIn` non è “tutti i campi”: è l’insieme dei campi **operativi** usati davvero.

#### Range consigliati (PMI)

* **D ≤ 10k**: `searchIn` **4–8** (con min-length)
* **D ~ 20k**: `searchIn` **3–6**
* **D ≥ 100k**: `searchIn` **2–4** + mitigazioni (min-length/prefix) o **Atlas Search**

#### Criteri per scegliere i campi

Preferisci campi:

* **corti e discriminanti**: codice, SKU, CF/P.IVA, email, telefono normalizzato
* con valori poco ripetuti (aumentano selettività)

Evita (o limita) campi:

* lunghi: note, descrizioni estese, memo
* generici: “Italia”, “Srl”, “Via”, testi ripetitivi
* non usati davvero dalla UI

> Nota Atlas: i campi in `title/subtitle/searchIn` sono anche candidati per **indicizzazione automatica** (`ensureIndexes`). Scegliere bene `searchIn` significa controllare sia **performance** sia **costo indici**.

---

### F) Mitigazioni future possibili
1. **Min length**: non fare search se `q.length < 2` (o `< 3` su dataset grandi)
2. **Debounce UI**: 250–400 ms sul typing
3. **Prefix mode opzionale**: per autocomplete usare `^q` su 1–2 campi chiave
4. **Ricerca avanzata separata**: se vuoi cercare in 15 campi, fallo in una UI/endpoint dedicata
5. Se la search diventa critica su dataset grandi: valutare **Atlas Search** / tokenizzazione

---