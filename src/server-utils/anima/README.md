# Anima Runtime

## Documentazione Di Riferimento
La documentazione sorgente del flow agentico reale e qui:
- [AGENTIC_FLOW.md](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/AGENTIC_FLOW.md)

Questo README resta una vista sintetica.

## Obiettivo
Anima e un runtime conversazionale LLM-led che usa uno stato operativo specialistico per trasformare richieste naturali in JSON rigorosi da eseguire lato server.

Il principio chiave e questo:
- la conversazione deve restare naturale
- la compilazione dei dati operativi deve restare precisa
- il deterministic deve fare soprattutto validazione, permessi, persistenza ed esecuzione
- quando l'utente parla di task, compiti, todo o cose da fare, Anima deve aprire il taskboard mode interno (`sprint_timeline_read`)
- nello stesso dominio ricadono anche richieste manageriali come `chi sta facendo cosa`, `siamo in ritardo`, `cosa dovrei fare per primo`, `da quanti passaggi e composto un task`

## Registry Awareness
Anima ragiona sempre avendo in contesto i tre registry di dominio:
- `Anagrafiche` tramite `getAnagraficheList()` in [anagrafiche.registry.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/config/anagrafiche.registry.ts)
- `Aule` tramite `listAuleDef()` / `getAuleList()` in [aule.registry.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/config/aule.registry.ts)
- `Eventi` tramite `getEventiList()` in [eventi.registry.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/config/eventi.registry.ts)

Questo contesto entra nei nodi LLM centrali:
- `senseInterpreter`
- `emotionalGuardrail`
- `responseComposer` (`welcome`, `operationClarification`, `finalResponse`)

Scopo:
- se il testo utente richiama uno slug o una label di registry, Anima deve trattarlo come segnale di dominio forte
- se il turno sembra appartenere a un dominio noto, Anima deve aprire subito uno stato specialistico invece di cadere in fallback o help generico
- i responder devono conoscere i nomi di dominio reali, per evitare suggerimenti fuori area

Il builder compatto del contesto registry e in [registryAwareness.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/core/registryAwareness.ts).

## Architettura
Il flow reale del turno e:

1. bootstrap stato da `runAnima`
2. eventuale welcome iniziale
3. `operationSwitcher` se esiste gia un pending state
4. `senseInterpreter` solo come classificatore di soglia quando non siamo gia dentro un task attivo
5. `operationContextFiller` specialistico di branch
6. parser deterministic e `operationRouter`
7. eventuale `emotionalGuardrail`
8. executor specialistico
9. `shortTermMemory`
10. `responseComposer.finalResponse`

## Strategia Modelli
Su Groq, Anima usa per default un profilo conservativo orientato a velocita e continuita del servizio.

Scelta corrente:
- modello safe di default: `meta-llama/llama-4-scout-17b-16e-instruct`
- ruoli `fast`, `strong` e `premium` allineati allo stesso modello, salvo override env
- fallback cross-provider ancora disponibile tramite runtime `groq/glm`

Motivo:
- `llama-3.1-8b-instant` sul free tier ha margine TPM troppo stretto per un runtime multi-step
- `llama-3.3-70b-versatile` ha un tetto TPD troppo basso per uso intenso in chat operativa
- `Scout` offre piu respiro sui limiti e riduce sia 429 sia latenze da failover ripetuto

File di riferimento:
- runtime live: [agentLoop.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/core/agentLoop.ts)
- process map: [anima.processes.config.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/core/anima.processes.config.ts)
- prompt di sense/filler: [anima.prompts.config.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/config/anima.prompts.config.ts)
- prompt runtime dei responder: [anima.prompts.runtime.config.ts](/C:/EvolveDevs/it.evolve.atlas.nfcPlatform/src/server-utils/anima/config/anima.prompts.runtime.config.ts)

## Stato Specialistico
Quando il turno viene indirizzato verso un dominio, Anima entra in uno stato specialistico pending. Da quel momento:
- il contesto deve restringersi al dominio scelto
- il filler/sense di branch deve completare solo il JSON operativo rilevante
- il responder deve parlare come specialista di quel task
- il bot secondario deve decidere solo se conviene fare `switch` verso un altro task

Regola operativa:
- dettagli non necessari possono essere omessi se il dominio e l'esecuzione non li richiedono
- il filler deve valorizzare solo i campi davvero supportati o suggeriti dalla conversazione
- il JSON deve essere rigoroso, ma non iper-compilato per forza

## Switch di Dominio
Uno stato pending non deve irrigidire il bot.

Anima deve continuare il task aperto quando il turno:
- completa un campo
- conferma un'azione
- aggiunge dettagli coerenti con lo stesso task

Anima deve invece considerare `open_new` o `drop_active` quando il turno:
- formula chiaramente una nuova richiesta
- cambia dominio
- riavvia una richiesta nuova anche nello stesso dominio read

L'obiettivo e risparmiare contesto:
- un bot specializzato pensa solo al JSON del task corrente
- il livello di arbitraggio pensa solo se vale la pena restare o fare switch

## Classificatore Di Soglia
Il `senseInterpreter` e un classificatore pre-operazionale di soglia.

Deve fare solo questo:
- decidere quale processo specialistico aprire
- dare una `normalizedMessage` utile al branch successivo
- produrre una motivazione breve e concreta della scelta

Non deve:
- compilare slot di dettaglio
- scegliere campi del JSON operativo
- forzare slug specifici se la richiesta e ancora generica

Quando c'e gia un pending state, il primo nodo decisionale non e il `senseInterpreter`, ma `operationSwitcher`.

Esempio corretto:
- "vorrei sapere gli eventi dell'ultima settimana" -> `event_list`

Esempio scorretto:
- "vorrei sapere gli eventi dell'ultima settimana" -> scegliere subito uno slug evento specifico

## Switcher Operativo
Quando esiste un'operazione gia aperta, entra prima `operationSwitcher`.

Fa questo:
- decide se il turno continua davvero l'operazione aperta
- decide se l'utente sta annullando
- decide se l'utente sta uscendo verso una nuova richiesta
- produce una patch strutturata compatibile con il filler del dominio

Questo riduce:
- chiamate LLM ridondanti
- passaggi sul classificatore generale
- latenza nei flussi multi-turno

## Motivazioni di Debug
Ogni livello decisionale deve lasciare una motivazione breve visibile nel debug:
- `operationSwitcher`: perche ha tenuto o rilasciato il task attivo
- `senseInterpreter`: perche ha scelto quel processo
- `operationArbitration`: perche ha tenuto o droppato il task attivo
- `operationRouter`: perche ha aperto quel branch
- `catalogResolver`: perche ha scelto quello slug o perche non lo ha scelto

La regola e:
- motivazioni corte
- niente frasi duplicate
- spiegazione leggibile anche in colonna debug

## Guardrail
Il sistema di guardrail di Anima va letto in tre strati.

### 1. Guardrail di continuita operativa
Serve a non perdere il task attivo quando l'utente sta ancora completando o confermando un'operazione aperta.

Componenti:
- `operationGuardrails.ts`
- stato pending in `sessionState.ts`
- arbitration in `agentLoop.ts`

### 2. Guardrail di switch
Serve a capire se l'utente vuole davvero abbandonare il task corrente e aprire una nuova operazione.

Componenti:
- `operationSwitcher`
- `senseInterpreter` di soglia
- `resolveOperationArbitration(...)` in `agentLoop.ts`
- `operationRouter`

Regola:
- lo switch deve essere possibile
- ma solo se il nuovo intento e abbastanza chiaro

### 3. Guardrail di attinenza
Serve a separare:
- richieste utili ma ancora vaghe
- richieste fuori contesto
- input poveri o provocatori

Componenti:
- `senseInterpreter` con `guardrailColor`
- `emotionalGuardrail`
- `low_value` e fallback conversazionale

Regola:
- se c'e contesto utile ma ancora ambiguo, preferire `orange`
- il deterministic duro dovrebbe uscire soprattutto quando l'attinenza e davvero debole

## Matrice Operativa
Ogni operazione specialistica deve dichiarare:
- tipo: `read` o `write`
- stato pending
- filler LLM dedicato
- executor specialistico
- service lato server
- campi minimi
- note permessi o guardrail

### `event_create`
- tipo: `write`
- pending: `event_create`
- filler: `operationContextFiller.create`
- executor: `features/eventi/eventi.executor.ts`
- service: `operationExecutor.executeEventCreateOperation`
- campi minimi: tipo evento, data/orario, titolo
- note: puo aprire `mail_followup`

### `event_list`
- tipo: `read`
- pending: `event_list`
- filler: `operationContextFiller.eventList`
- executor: `features/eventi/eventi.executor.ts`
- service: `features/eventi/eventi.list.ts`
- campi minimi: nessuno obbligatorio; tipo e periodo sono opzionali
- note: il tipo evento resta facoltativo se la richiesta e generica

### `generic_mail`
- tipo: `write`
- pending: `generic_mail`
- filler: `operationContextFiller.genericMail`
- executor: `features/mail/mail.executor.ts`
- service: `operationExecutor.executeGenericMailOperation`
- campi minimi: destinatario, contenuto
- note: puo essere aperta ex-novo o come switch da un altro task; puo riusare contatti emersi da `anagrafiche_read` come rubrica implicita se il messaggio li richiama davvero

### `mail_followup`
- tipo: `write`
- pending: `mail_followup`
- filler: `operationContextFiller.mailFollowup`
- executor: `features/mail/mail.executor.ts`
- service: `operationExecutor.executeCreatedEventReminderMailOperation`
- campi minimi: conferma e destinatario effettivo
- note: e un follow-up guidato, non un dominio autonomo di discovery

### `anagrafiche_read`
- tipo: `read`
- pending: `anagrafiche_read`
- filler: `operationContextFiller.anagraficheRead`
- executor: `features/anagrafiche/anagrafiche.executor.ts`
- service: `service/Anagrafiche/list`
- campi minimi: tipo; query solo se non e una lista
- note: pulisce il linguaggio naturale prima di compilare la query; puo chiedere tipo, record e campi; se trova campi email/telefono li salva anche in memoria contatti di sessione per mail successive

### `anagrafiche_create`
- tipo: `write`
- pending: `anagrafiche_create`
- filler: `operationContextFiller.anagraficheCreate`
- executor: `features/anagrafiche/anagrafiche.executor.ts`
- service: `service/Anagrafiche/mutations/create`
- campi minimi: tipo anagrafica, almeno un dato utile
- note: la write viene confermata prima di partire; permesso prudente lato Anima, write meccanica lato service

### `sprint_timeline_read`
- tipo: `read`
- pending: `sprint_timeline_read`
- filler: `operationContextFiller.sprintTimelineRead`
- scheduler: `features/sprintTimeline/sprintTimeline.scheduler.ts`
- executor: `features/sprintTimeline/sprintTimeline.executor.ts`
- service: `service/sprintTimeline/*`
- campi minimi: dipendono dalla query; scope e finestra possono essere compilati a step
- note: l'owner e separato dal reviewer; il task resta l'unita principale e i checkpoint vengono esposti come passaggi del task, non come task autonomi

## Stato Attuale
Domini operativi specialistici gia supportati:
- `event_create`
- `event_list`
- `generic_mail`
- `mail_followup`
- `anagrafiche_read`
- `anagrafiche_create`
- `sprint_timeline_read`

Nodi LLM principali oggi:
- `operationSwitcher`
- `senseInterpreter`
- `operationContextFiller`
- `catalogResolver`
- `emotionalGuardrail`
- `shortTermMemorySummarizer`
- `responseComposer`

Ottimizzazioni runtime gia attive:
- contesto scoped per dominio
- payload compatti verso il composer finale
- cooldown dei modelli in rate limit
- debug rapido con modello, step e token per nodo

`Aule` e gia parte del contesto di registry del cervello centrale. Questo permette ad Anima di riconoscere il dominio come area strutturata anche quando non c'e ancora un branch operativo dedicato nello stesso formato degli altri specialisti.

## Regola di Progetto
Quando si aggiunge un nuovo dominio:
- esporre lo schema via registry/config
- renderlo visibile al `registryAwareness`
- istruire `senseInterpreter` a usarlo come segnale di dominio
- aggiungere uno stato pending specialistico
- fare compilare il JSON dal filler LLM
- lasciare a deterministic solo controllo strutturale ed esecuzione
