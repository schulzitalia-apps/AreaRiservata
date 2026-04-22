# SprintTimeline Agent Operations Guide

Questa guida descrive come un agente interno dovrebbe attaccarsi alla piattaforma per lavorare bene sulla SprintTimeline senza rompere permessi, lifecycle e calendario.

## 1. Principio base

Un agente non deve inventare flussi paralleli.

Ordine corretto:
1. caricare la board
2. capire lane, evento e ruolo
3. chiamare la mutation giusta
4. ricaricare la board
5. decidere il passo successivo sullo stato reale risultante

## 2. Entita e ID necessari

Per lavorare bene servono sempre questi riferimenti:
- `sprintId`
- `taskId` o `laneId`
- `eventId` quando si agisce su un pallino esistente

Nella pratica:
- `laneId` identifica la lane renderizzata
- `taskId` identifica il task reale
- `eventId` identifica il singolo evento `avanzamento-task`

## 3. Livelli di integrazione consigliati

### 3.1 Livello migliore: thunks SprintTimeline

File:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\writeThunks.ts`

Usare questo livello quando l'agente vive dentro l'app Redux/UI.

Vantaggi:
- tiene insieme task + evento + ricarico board
- applica la semantica timeline corretta
- evita di dover ricostruire a mano `payloadTimelineTask`

### 3.2 Livello medio: persistence helpers

File:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\persistence.ts`

Usare questo livello per integrazioni tecniche interne che devono scrivere dati ma conoscono gia il lifecycle.

### 3.3 Livello basso: API standard

Route:
- `GET /api/sprint-timeline/:sprintId`
- `POST /api/eventi/avanzamento-task`
- `PUT /api/eventi/avanzamento-task/:id`
- `DELETE /api/eventi/avanzamento-task/:id`

Usare questo livello solo se serve integrazione esterna o automazione a basso livello.

## 4. Chiamate canoniche per i casi principali

### 4.1 Caricare una board

Chiamata:
- `fetchSprintTimelineBoard({ sprintId })`

Oppure:
- `loadSingleSprintBoard(sprintId)`

## 4.2 Creare un task pieno

Chiamata:
- `createSprintTimelineTask({ sprintId, payload })`

Il payload deve contenere almeno:
- titolo
- plannedStartIndex
- expectedEndIndex
- owner/reviewer se gia noti

## 4.3 Promuovere un quick task

Chiamata:
- `promoteSprintTimelineTask({ sprintId, laneId, payload })`

## 4.4 Aggiungere un checkpoint, una nota o un task-block

Chiamata:
- `createSprintTimelineEvent({ sprintId, payload })`

Regole:
- `kind = checkpoint` -> owner/reviewer/admin possono crearli
- `kind = task-block` -> owner/reviewer/admin possono crearli
- `kind = note` -> chiunque puo inserire nota sul task

## 4.5 Iniziare il task oggi

Chiamata:
- `startSprintTimelineTask({ sprintId, laneId, sourceEventId, currentUserName })`

Precondizione:
- il `sourceEventId` deve essere il planned-start grigio

Regola:
- la data deve essere calcolata sul giorno locale del browser

## 4.6 Segnare checklist

Chiamata:
- `toggleSprintTimelineChecklistItem({ sprintId, eventId, itemId, checked, currentUserName })`

## 4.7 Completare checkpoint giallo

Chiamata:
- `completeSprintTimelineCheckpoint({ sprintId, laneId, eventId, currentUserName })`

Effetto:
- crea `completion-update`
- puo innescare automaticamente la nuova validazione del ciclo corrente

## 4.8 Bloccare checkpoint giallo

Chiamata:
- `blockSprintTimelineCheckpoint({ sprintId, laneId, eventId, note, participants, checklistItems })`

Effetto:
- crea `block-update`

## 4.9 Sbloccare checkpoint rosso

Chiamata:
- `resolveSprintTimelineCheckpointBlock({ sprintId, laneId, eventId })`

Effetto:
- cancella il `block-update`

## 4.10 Configurare validazione viola

Chiamata:
- `configureSprintTimelineValidation({ sprintId, eventId, validators, note })`

## 4.11 Decidere validazione

Chiamata:
- `decideSprintTimelineValidation({ sprintId, laneId, eventId, outcome, decisionNote, currentUserName })`

Esiti:
- `approved` -> crea `completion`
- `rejected` -> crea `reopen`

## 4.12 Risolvere blocco task-level

Chiamata:
- `resolveSprintTimelineTaskBlock({ sprintId, laneId, eventId })`

Effetto:
- cancella `task-block`
- non crea riapertura

## 4.13 Eliminare un checkpoint o altro evento

Chiamata:
- `deleteSprintTimelineEvent({ sprintId, laneId, eventId })`

Nota:
- se cancelli il checkpoint base giallo, la logica attuale elimina l'intera chain collegata

## 5. Matrice comportamentale che un agente deve rispettare

### 5.1 Owner e reviewer

Possono:
- creare checkpoint gialli
- creare task-block
- cliccare `Inizia task oggi` sul grigio
- cancellare checkpoint

Non possono:
- completare checkpoint
- bloccare checkpoint
- validare
- sbloccare checkpoint bloccati

Salvo una sola eccezione:
- se sono anche partecipanti di quello specifico checkpoint

### 5.2 Partecipanti del checkpoint

Sono gli unici che possono:
- completare checklist
- completare checkpoint giallo
- bloccare checkpoint giallo
- validare o respingere il viola se sono validatori
- sbloccare il rosso se sono i partecipanti del blocco

### 5.3 Scrum Master board

La scrum master board e la vista admin/elevated.

## 6. Regole di lifecycle che un agente non deve violare

### 6.1 Un solo ciclo coerente

- gialli completati -> nuova validazione
- validazione approvata -> chiusura verde
- validazione respinta -> riapertura blu

### 6.2 Dopo una respinta

- la lane deve tornare blu
- il ciclo riparte da li
- se i nuovi checkpoint del nuovo ciclo vengono completati tutti, deve nascere una nuova validazione
- il viola non deve restare appiccicato dopo una decisione gia presa
- gli eventi del nuovo ciclo devono essere temporalmente successivi al `reopen`, anche nello stesso giorno

### 6.3 Blocchi task-level

- non riaprono il task
- si eliminano quando vengono risolti

### 6.4 Date

- la business date della board lato UI deve seguire il browser locale
- non mischiare UTC business logic e date locali per `oggi`

## 7. Strategia raccomandata per un agente

Ogni volta che l'agente vuole agire:

1. carica la board
2. trova la lane corretta
3. trova l'evento corretto
4. verifica il ruolo sul task e sul checkpoint
5. lancia UNA sola mutation canonica
6. ricarica la board
7. controlla il nuovo stato lane/evento prima di continuare

In altre parole:
- mai assumere che una scrittura abbia lasciato il sistema in uno stato previsto
- usare sempre la board ricaricata come fonte di verita successiva

## 8. Quando usare le API raw invece dei thunks

Usa le API raw solo se:
- sei fuori dal runtime Redux
- devi orchestrare da un servizio esterno
- sai gia quali campi evento e task vanno toccati

Se usi le API raw devi ricordarti da solo di:
- mantenere `payloadTimelineTask`
- mantenere `chainId`
- mantenere `sourceEventId`
- mantenere i partecipanti
- riallineare eventuali campi task (`statoTask`, `conclusioneEffettiva`, ecc.)

## 9. Warning pratici

### 9.1 Non usare scorciatoie per la validazione

La validazione non va creata da un flusso ad hoc scollegato.

Deve nascere solo da:
- tutti i checkpoint del ciclo corrente completati

### 9.2 Non aggiornare solo il task se vuoi spostare un pallino reale

Per spostare un pallino che deve vivere anche a calendario serve aggiornare l'evento reale `avanzamento-task`.

Per i campi strutturali del task:
- cambio titolo task -> riallineare i titoli degli eventi di sistema e dei pallini della lane
- cambio data start pianificata -> riallineare `planned-start`
- cambio data chiusura attesa -> riallineare `expected-completion`

### 9.3 Shape minima consigliata per un evento SprintTimeline compatibile con CalendarBox

- `type = avanzamento-task`
- `data.titolo`
- `data.descrizione`
- `data.tipoTimelineTask`
- `data.priorita`
- `timeKind = point`
- `startAt`
- `endAt` uguale a `startAt`
- `allDay = false`
- `gruppo` sprint
- `partecipanti` con task e attori umani pertinenti

### 9.3 Non basarsi solo sul ruolo task-level

Il vero permesso operativo sui checkpoint e event-level:
- partecipanti
- validators

## 10. File da leggere per un agente

Ordine consigliato:

1. `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\README.md`
2. `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\event-model-and-calendar.md`
3. `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\mutations\writeThunks.ts`
4. `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\permissions.ts`
5. `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\server-utils\service\sprintTimeline\loadBoard.ts`

Se l'agente segue questi file e usa le chiamate canoniche, la dinamica resta pulita e consistente.
