# SprintTimeline Event Model And Calendar

Questa nota documenta il modello reale usato dalla SprintTimeline per creare, spostare, aggiornare e cancellare i pallini.

Va letta insieme a:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\README.md`
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\writeThunks.ts`
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\persistence.ts`
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\server-utils\service\sprintTimeline\loadBoard.ts`

## 1. Entita reali

La SprintTimeline lavora su tre entita diverse.

### 1.1 Sprint

- Entita: `aula`
- Tipo: `sprint`
- Uso: contenitore della board
- File chiave:
  - `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\constants.ts`
  - `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\writeThunks.ts`

### 1.2 Task

- Entita: `anagrafica`
- Tipo: `task`
- Uso: owner, reviewer, titolo, descrizione, date attese, stato task
- Il task non e il pallino: e il contenitore logico della lane

### 1.3 Evento timeline

- Entita: `evento`
- Tipo: `avanzamento-task`
- Uso: ogni pallino reale della timeline
- Config standard:
  - `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\config\eventi.types.public.ts`
- Accesso standard:
  - `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\app\api\eventi\[type]\route.ts`
  - `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\app\api\eventi\[type]\[id]\route.ts`

Conclusione pratica:
- la board non usa un modello speciale "checkpoint"
- il checkpoint reale e un normale evento `avanzamento-task`
- la semantica timeline vive nei campi `tipoTimelineTask`, `chainIdTimelineTask`, `sourceEventIdTimelineTask`, `payloadTimelineTask`

## 2. Cosa appare davvero a calendario

Per la board/calendario Atlas principale, gli eventi timeline sono eventi standard e passano nel calendario.

File chiave:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\Calendario\CalendarBox.tsx`
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\config\calendar.config.ts`

Fatti importanti:
- `CalendarBox` carica gli eventi standard via `fetchEventi(...)`
- `avanzamento-task` e incluso in `CALENDAR_CONFIG.colorOrder`
- quindi gli eventi timeline sono visibili anche nel calendario Atlas se:
  - il tipo `avanzamento-task` e selezionato
  - l'evento ha una shape temporale compatibile
  - l'evento cade nel range temporale richiesto
  - ACL e filtri lo rendono visibile

### 2.1 Shape concreta letta da CalendarBox

`CalendarBox` lavora su `EventoPreview`.

Per `avanzamento-task` la UI calendario usa in pratica:
- `displayName`
- `subtitle`
- `timeKind`
- `startAt`
- `endAt`
- `visibilityRole`
- `typeSlug`

Come vengono costruiti:
- `displayName` nasce dalla preview del tipo evento, quindi da `data.titolo`
- `subtitle` nasce da `data.tipoTimelineTask` e `data.priorita`
- `startAt` / `endAt` vengono letti direttamente dal record evento

Regola pratica:
- per gli eventi timeline di tipo `point` conviene salvare sia `startAt` sia `endAt` con lo stesso timestamp

Motivo:
- alcune parti Atlas tollerano `endAt = null`
- ma la shape piu compatibile e stabile per calendario e componenti affini e `startAt === endAt`

## 3. Perche esiste anche `CalendarEvent`

Nel repo esiste anche un secondo canale:
- modello: `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\server-utils\models\CalendarEvent.ts`
- route: `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\app\api\calendar\events\route.ts`

Questo pero non e il canale principale usato da `CalendarBox` per la SprintTimeline.

Quindi:
- SprintTimeline -> usa `evento` standard tipo `avanzamento-task`
- calendario Atlas principale -> legge `evento` standard
- `/api/calendar/events` + `CalendarEvent` -> e un canale parallelo, utile per un calendario semplificato/personale, ma non e il backbone della SprintTimeline

## 4. Quali pallini sono eventi reali

Sono eventi reali `avanzamento-task`:
- `planned-start`
- `start`
- `checkpoint`
- `completion-update`
- `block-update`
- `expected-completion`
- `validation`
- `completion`
- `task-block`
- `reopen`
- `note`

In pratica, ogni pallino salvato dalla board passa da `createTimelineEventRecord(...)` oppure da `updateTimelineEventRecord(...)` o `deleteTimelineEventRecord(...)`.

## 5. Quali elementi NON sono un nuovo evento

Non sono entita evento autonome:
- lo stato derivato della lane (`blue`, `yellow`, `purple`, ecc.)
- le CTA persistenti tipo `Completa questo`
- le linee tratteggiate di collegamento
- la proiezione futura della linea
- il raggruppamento grafico dei pallini nello stesso giorno

Sono invece mutazioni sul task, non nuovi eventi:
- `statoTask`
- `conclusioneAttesa`
- `conclusioneEffettiva`
- owner
- reviewer
- descrizione / metadati task

## 6. Matrice: azione -> cosa tocca davvero

### 6.1 Creazione task strutturato

Thunk:
- `createSprintTimelineTask`

Effetti:
- crea il task `anagrafica/task`
- aggancia il task allo sprint
- crea evento reale `planned-start`
- crea evento reale `expected-completion`
- crea un evento reale `checkpoint` per ogni milestone iniziale

Nota:
- quando poi il task viene editato, i system events principali devono restare allineati al task:
  - `planned-start`
  - `expected-completion`
  - prefisso titolo degli altri eventi della lane

### 6.2 Promozione quick task -> task pieno

Thunk:
- `promoteSprintTimelineTask`

Effetti:
- aggiorna il task
- crea `planned-start`
- crea `expected-completion`
- crea gli eventuali checkpoint iniziali

### 6.3 Aggiunta manuale nota / checkpoint / task-block

Thunk:
- `createSprintTimelineEvent`

Effetti:
- crea un singolo evento `avanzamento-task`
- se `kind === checkpoint`, nasce una nuova `chainId`

### 6.4 Inizio task oggi

Thunk:
- `startSprintTimelineTask`

Effetti:
- crea evento `start`
- aggiorna `statoTask = in_corso`

### 6.5 Checklist checkpoint

Thunk:
- `toggleSprintTimelineChecklistItem`

Effetti:
- aggiorna l'evento checkpoint esistente
- non crea un nuovo pallino

### 6.6 Completamento checkpoint giallo

Thunk:
- `completeSprintTimelineCheckpoint`

Effetti:
- crea evento `completion-update`
- se tutti i checkpoint del ciclo corrente sono completati, puo creare una nuova `validation`

### 6.7 Blocco checkpoint giallo

Thunk:
- `blockSprintTimelineCheckpoint`

Effetti:
- crea evento `block-update`

### 6.8 Sblocco blocco rosso nato da checkpoint

Thunk:
- `resolveSprintTimelineCheckpointBlock`

Effetti:
- cancella l'evento `block-update`
- non crea riaperture

### 6.9 Configurazione validazione

Thunk:
- `configureSprintTimelineValidation`

Effetti:
- aggiorna l'evento `validation`
- modifica validatori e nota

### 6.10 Decisione validazione

Thunk:
- `decideSprintTimelineValidation`

Effetti:
- aggiorna l'evento `validation` come `decided`
- crea evento `completion` oppure `reopen`
- aggiorna il task:
  - approvato -> `conclusioneEffettiva`, `statoTask = completato`
  - respinto -> `conclusioneEffettiva = null`, `statoTask = in_corso`

Regola di lettura UI:
- una validazione decisa non deve lasciare la lane viola
- il viola indica solo `validationState = requested`

### 6.11 Risoluzione blocco task-level

Thunk:
- `resolveSprintTimelineTaskBlock`

Effetti:
- cancella l'evento `task-block`
- aggiorna `statoTask = in_corso`
- non crea una riapertura

## 7. Quando un pallino si sposta anche a calendario

Un pallino si sposta anche nel calendario Atlas quando si aggiorna il suo evento reale, cioe:
- `startAt`
- `endAt`
- `timeKind`

Esempio:
- se aggiorni un evento `avanzamento-task` con una nuova data, lo sposti sia nella sprintboard sia nel calendario Atlas

Non si sposta a calendario quando cambi solo:
- `statoTask`
- owner / reviewer
- metadati del task
- semaforo derivato

## 8. Perche alcuni pallini sembrano "non essere eventi"

I casi tipici sono questi:

### 8.1 Elemento derivato dal task

Se una UI disegna qualcosa usando un campo del task e non un record `evento`, quel marker non ha una vita autonoma a calendario.

### 8.2 Update del task senza update dell'evento corrispondente

Oggi c'e un punto importante da ricordare:
- `updateSprintTimelineTask(...)` aggiorna il task e crea eventuali nuovi checkpoint
- ma non riscrive automaticamente gli eventi gia esistenti `planned-start` e `expected-completion`

Quindi, se sposti solo `conclusioneAttesa` nel task e non l'evento relativo, potresti avere:
- task aggiornato
- pallino atteso non riallineato
- calendario non riallineato

Questa e una nota importante se in futuro vogliamo rendere perfettamente simmetrico task <-> evento di sistema.

### 8.3 Shape temporale incompleta

Se un evento `point` ha:
- `startAt` valorizzato
- `endAt = null`

molte parti continuano a funzionare, ma la compatibilita cross-component e meno robusta.

Per SprintTimeline la shape consigliata e:
- `timeKind = "point"`
- `startAt = timestamp`
- `endAt = stesso timestamp`
- `allDay = false`

## 9. Regola pratica per modificare il sistema

Se vuoi che un pallino:
- esista davvero
- abbia ACL proprie
- sia cliccabile
- compaia anche nel calendario Atlas

allora deve essere un vero record `evento` di tipo `avanzamento-task`.

Se invece vuoi solo:
- cambiare il significato della lane
- derivare uno stato
- cambiare il task owner/reviewer

allora devi agire sul task o sulla logica derivata, non sul calendario.

## 10. Entry point consigliati

Per modifiche SprintTimeline usare, in ordine di preferenza:

1. `writeThunks.ts`
2. `persistence.ts`
3. API standard `/api/eventi/avanzamento-task`

Evitare di scrivere direttamente su modelli diversi senza passare da questa logica, altrimenti si rompe la coerenza tra:
- task
- eventi timeline
- calendario Atlas
- permessi
- lifecycle dei checkpoint
