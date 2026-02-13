```md
## Connessione MongoDB con URI dinamico (dbKey → env → fallback)

Atlas è progettato per poter **separare fisicamente i dati** (se necessario) senza cambiare il codice applicativo.
Per questo usiamo un “motore DB” che seleziona l’URI di MongoDB in modo dinamico a partire da una chiave logica (**dbKey**).

### 1) Concetto: dbKey
Ogni macro-dominio dati può avere una chiave dedicata, ad esempio:
- `anagrafiche`
- `aule`
- `eventi`

La **dbKey** non è un nome di database Mongo “hard-coded”, ma un identificatore logico interno che ci permette di scegliere *quale URI usare*.

---

### 2) Regola di risoluzione URI (env → fallback)
Quando il sistema deve aprire una connessione per una dbKey, cerca prima una variabile d’ambiente specifica:

- `MONGODB_URI_<DBKEY_IN_MAIUSCOLO>`

Esempio:
- dbKey = `anagrafiche` → `MONGODB_URI_ANAGRAFICHE`

Se la variabile non esiste o è vuota, fa **fallback** su:
- `MONGODB_URI`

Quindi:
- se vuoi un DB/cluster separato per le anagrafiche → valorizzi `MONGODB_URI_ANAGRAFICHE`
- se non vuoi separazione → lasci vuoto e tutto finisce su `MONGODB_URI`

---

### 3) Cache e riuso (perché non perdi performance)
La connessione non viene aperta “a ogni request”.

Il motore DB:
- apre la connessione **solo la prima volta** per una certa dbKey (per processo)
- la salva in cache (pool incluso)
- da quel momento viene **riusata** in tutte le query successive

Questo evita overhead e rende possibile scalare anche in ambienti con hot-reload / serverless.

---

### 4) Come la usa il Model delle Anagrafiche
La factory dei model (`getAnagraficaModel`) non usa più la connessione globale di Mongoose, ma:

1) chiede al motore DB la connessione corretta:
   - `conn = getDbConnection("anagrafiche")`
2) registra/riusa il model su quella connessione:
   - `conn.model(MODEL_NAME, schema, collection)`
3) ritorna un `Model` già “agganciato” alla connessione giusta

**Conseguenza importante:**
quando il service fa `Model.find(...)`, Mongoose sa già quale connessione usare,
perché la connessione è “incapsulata” dentro il Model.

In questo modo:
- la logica di connessione resta centralizzata
- i service rimangono puliti (solo logica dominio/query)
- cambiare URI o separare cluster non richiede refactor dei service
```
