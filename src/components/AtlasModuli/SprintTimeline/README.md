# SprintTimeline

Canonical document: this README is the single source of truth for SprintTimeline behavior, permissions, lifecycle, and implementation direction.

Specialized companion docs:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\event-model-and-calendar.md`
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\agent-operations.md`

## 1. Scope

SprintTimeline is the operational board used to:
- plan task starts
- manage operational checkpoints
- manage isolated blockers
- request and decide validation
- show the lifecycle of a task in a clear timeline language

Reference code blocks:
- `src/components/AtlasModuli/SprintTimeline`
- `src/server-utils/service/sprintTimeline`

## 2. One direction only

The board follows one strict direction.

- Local browser day is the source of truth for `today` in the UI and client-side mutations.
- Owner and reviewer manage the task structure, not the execution of single checkpoints.
- Single checkpoints are executed only by their participants.
- Validation is the only normal way to reopen or close a task after all yellow checkpoints are done.
- Task blockers do not reopen the task: when resolved, they disappear.
- Scrum Master mode is the admin exception.

## 3. Day source

SprintTimeline uses the local browser day for all user-facing timeline actions.

This means:
- `Inizia task oggi` must always place the blue node on the browser local day.
- checkpoint completion and block actions must land on the browser local day.
- validation decisions must land on the browser local day.

Rule:
- do not mix browser-local day and UTC day for timeline business logic.

## 4. Roles

### Task roles

Each task has:
- owner
- reviewer

These roles are task-level roles.

### Checkpoint roles

Each checkpoint can have:
- participants
- validators, only for validation checkpoints

These roles are event-level roles.

### Admin exception

Scrum Master board acts as elevated/admin mode.

## 5. Permission matrix

| Action | Any user | Owner | Reviewer | Participant | Validator | Scrum Master |
| --- | --- | --- | --- | --- | --- | --- |
| Add simple note on task | yes | yes | yes | yes | yes | yes |
| Add yellow checkpoint | no | yes | yes | no | no | yes |
| Add isolated red blocker | no | yes | yes | no | no | yes |
| Click `Inizia task oggi` on gray start | no | yes | yes | no | no | yes |
| Complete yellow checkpoint | no | no | no | yes | no | yes |
| Block yellow checkpoint | no | no | no | yes | no | yes |
| Check checklist on yellow checkpoint | no | no | no | yes | no | yes |
| Validate purple checkpoint | no | no | no | no | yes | yes |
| Reject purple validation | no | no | no | no | yes | yes |
| Unlock red blocker | no | no | no | yes | no | yes |
| Delete single checkpoint | no | yes | yes | no | no | yes |

Important:
- owner and reviewer cannot execute a checkpoint unless they are also participants of that checkpoint
- owner and reviewer can still delete a checkpoint
- a note is intentionally more open than a checkpoint

## 6. Lifecycle

### 6.1 Planned task start

- Gray planned-start exists as the structural start point.
- Owner or reviewer can click `Inizia task oggi`.
- The task creates a blue start node on the local browser day.

### 6.2 Yellow checkpoints

- Yellow checkpoints represent operational work.
- Owner or reviewer can create them.
- Only participants can act on them.
- When completed, a green node appears on the current day and remains linked to the yellow checkpoint.
- When blocked, a red node appears on the current day and remains linked to the yellow checkpoint.

### 6.3 Red blockers

There are two red concepts and they must stay distinct.

#### A. Checkpoint block (`block-update`)
- Born from a yellow checkpoint.
- Only checkpoint participants can unlock it.
- It is part of the yellow checkpoint chain.

#### B. Task blocker (`task-block`)
- Isolated blocking event at task level.
- Owner or reviewer can create it.
- Only its participants can resolve it.
- When resolved, it is removed. It does not generate a reopen node.

### 6.4 Validation

Validation is born only when all yellow checkpoints in the current task cycle are completed.

Rule:
- the purple validation request appears on the day after the last yellow completion
- the setup modal assigns validators and optional note
- validators are the only users that can decide the validation

Validation outcomes:
- `approved`: the task closes successfully the same day with a green completion node
- `rejected`: the task reopens the same day with a blue reopen node

Visual rule:
- a requested validation is purple and dashed
- a decided validation stays purple but gets surrounded by:
  - green ring if approved
  - blue ring if rejected
- the dashed relation must clearly connect validation to the final outcome node
- after a rejected validation, the lane returns to blue state and a new cycle can start
- if a new cycle completes all yellow checkpoints again, a new validation must be created again

### 6.5 Reopen and close

Reopen and close should come from validation outcome, not from multiple competing flows.

- Approved validation -> green task closure node on the decision day
- Rejected validation -> blue reopen node on the decision day
- After a rejected validation, the lane must leave purple state and return to blue operational state
- Manual reopen should not be the normal operational path in timeline mode

## 7. Calendar relation

SprintTimeline writes real Atlas `eventi` of type `avanzamento-task`.

Important clarification:
- the main Atlas calendar component (`CalendarBox`) reads generic Atlas `eventi`
- `avanzamento-task` is included in calendar type config
- so real timeline events can appear in the Atlas calendar too

What is not automatically a calendar event:
- lane state
- projected future segments
- derived visual rings / dashed relations
- task-only metadata changes

There is also a separate `/api/calendar/events` + `CalendarEvent` channel in the repo, but that is not the canonical SprintTimeline path.

Calendar compatibility rules for `avanzamento-task`:
- `CalendarBox` reads generic `EventoPreview`, not SprintTimeline-specific DTOs
- calendar title comes from event preview `title`, which for `avanzamento-task` is built from `data.titolo`
- calendar subtitle comes from event preview `subtitle`, which for `avanzamento-task` is built from `data.tipoTimelineTask` + `data.priorita`
- calendar placement comes from `timeKind`, `startAt`, `endAt`
- for point events, storing both `startAt` and `endAt` is the safest compatible shape for Atlas components

For the full architecture, read:
- `C:\EvolveDevs\it.evolve.atlas.nfcPlatform\src\components\AtlasModuli\SprintTimeline\event-model-and-calendar.md`

## 8. Visual language

The board should remain readable at a glance.

- Gray: planned
- Blue: started or reopened
- Yellow: open operational checkpoint
- Red: blocked
- Purple: validation
- Green: successfully completed
- Teal: note
- Orange: expected completion / deadline marker

Extra rules:
- yellow completed chain gets green ring
- yellow blocked chain gets red ring
- purple approved gets green ring
- purple rejected gets blue ring
- hover on a checkpoint should pulse and show the participants label above the node
- in timeline mode, checkpoints that need my action should show a persistent pulsing CTA:
  - `Completa questo`
  - `Valida questo`
  - `Sblocca questo`

The persistent CTA appears only if I am an actual participant or validator of that specific event.

## 9. Title convention

All timeline event titles should follow one readable convention:

- `TITOLO TASK | TIPO EVENTO | NOME / ESITO`

Examples:
- `Setup mail dominio | Checkpoint | Verifica DNS`
- `Setup mail dominio | Validazione | Richiesta`
- `Setup mail dominio | Riapertura | Riaperto`
- `Setup mail dominio | Blocco task | Attesa conferma cliente`

## 10. Current implementation map

Main files:
- `src/components/AtlasModuli/SprintTimeline/permissions.ts`
- `src/components/AtlasModuli/SprintTimeline/SprintTimeline.helpers.ts`
- `src/components/AtlasModuli/SprintTimeline/SprintTimelineBoard.tsx`
- `src/components/AtlasModuli/SprintTimeline/SprintTimelineDrawer.tsx`
- `src/components/AtlasModuli/SprintTimeline/SprintTimelineScreen.tsx`
- `src/components/AtlasModuli/SprintTimeline/mutations/domain.ts`
- `src/components/AtlasModuli/SprintTimeline/mutations/writeThunks.ts`
- `src/server-utils/service/sprintTimeline/loadBoard.ts`
- `src/server-utils/service/sprintTimeline/resolvers.ts`

Responsibility split:
- `loadBoard.ts`: builds the board DTO and viewer flags
- `permissions.ts`: canonical UI permission checks
- `SprintTimeline.helpers.ts`: lifecycle helpers and derived state
- `writeThunks.ts`: persistence-side timeline mutations
- `SprintTimelineBoard.tsx`: timeline rendering and node affordances
- `SprintTimelineDrawer.tsx`: action panel for selected task/event
- `SprintTimelineScreen.tsx`: orchestration of modals and user actions

## 11. Cleanup rules

When changing SprintTimeline, keep these rules strict:

- Do not add parallel flows for the same lifecycle.
- Do not let owner/reviewer bypass participant-only execution.
- Do not reopen the task from blocker resolution.
- Do not spawn validation from arbitrary UI shortcuts: validation must follow checkpoint completion rules.
- Do not create time calculations with mixed UTC and local business dates.
- Keep permission semantics explicit: task-level roles and event-level roles are different.
- When task title or expected dates change, keep system events aligned with the task fields.

## 12. Hardening still worth doing

The code is now cleaner, but two hardening steps remain valuable:
- move final permission enforcement into server-side SprintTimeline domain writes, not only UI/thunks
- add regression tests for date placement, checkpoint permissions, validation outcome, and task-block removal

## 13. Working note

A previous set of analysis notes existed as separate files in this folder. They are now superseded by this README and kept only as short pointers for historical continuity.
