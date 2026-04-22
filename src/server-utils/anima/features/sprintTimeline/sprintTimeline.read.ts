import type {
  SprintTaskPriority,
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineEventKind,
  SprintTimelineLane,
  TimelineSemaforo,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { PendingSprintTimelineReadState } from "@/server-utils/anima/memory/sessionState";
import type { SprintTimelineReadOperationContextFillResult } from "@/server-utils/anima/nodes/operationContextFiller";
import { loadAggregateSprintTimelineBoard } from "@/server-utils/service/sprintTimeline";
import type {
  SprintTimelineListingPresentation,
  SprintTimelineReadIntent,
  SprintTimelineReadQuery,
  SprintTimelineReadResult,
  SprintTimelineReadScope,
  SprintTimelineSignalFilter,
  SprintTimelineTaskSnapshot,
} from "./sprintTimeline.types";
import { scheduleSprintTasks } from "./sprintTimeline.scheduler";

const ACTIVE_SIGNALS = new Set<TimelineSemaforo>(["red", "yellow", "purple", "blue"]);
const ALL_SIGNALS: SprintTimelineSignalFilter[] = ["red", "yellow", "purple", "blue", "orange"];

export type SprintTimelineReadClarification = {
  needsClarification: boolean;
  missing: string[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function hasExplicitAnagraficheContext(normalizedMessage: string) {
  return (
    normalizedMessage.includes("anagrafic") ||
    normalizedMessage.includes("scheda task") ||
    normalizedMessage.includes("record task") ||
    normalizedMessage.includes("campi task")
  );
}

function parsePriority(message: string): SprintTaskPriority | null {
  const normalized = normalizeText(message);
  if (normalized.includes("urgente") || normalized.includes("urgent")) return "urgent";
  if (
    normalized.includes("alta priorita") ||
    normalized.includes("priorita alta") ||
    normalized.includes("priorita elevata")
  ) {
    return "high";
  }
  if (
    normalized.includes("media priorita") ||
    normalized.includes("priorita media")
  ) {
    return "medium";
  }
  if (
    normalized.includes("bassa priorita") ||
    normalized.includes("priorita bassa")
  ) {
    return "low";
  }
  return null;
}

function parseSignals(message: string): SprintTimelineSignalFilter[] {
  const normalized = normalizeText(message);
  const signals = new Set<SprintTimelineSignalFilter>();

  if (normalized.includes("tutto") || normalized.includes("tutti i semafori")) {
    return [...ALL_SIGNALS];
  }
  if (normalized.includes("blocc") || normalized.includes("ross")) signals.add("red");
  if (normalized.includes("validaz") || normalized.includes("viol")) signals.add("purple");
  if (normalized.includes("operativ") || normalized.includes("checkpoint aperti") || normalized.includes("giall")) signals.add("yellow");
  if (normalized.includes("avviat") || normalized.includes("riapert") || normalized.includes("blu")) signals.add("blue");
  if (normalized.includes("scadenz") || normalized.includes("arancion")) signals.add("orange");

  return [...signals];
}

function parseDueWithinDays(message: string): number | null {
  const normalized = normalizeText(message);
  const dayMatch = normalized.match(/(?:entro|nei prossimi|tra|fra)\s+(\d{1,2})\s+giorn/);
  if (dayMatch?.[1]) return Math.min(Math.max(Number(dayMatch[1]), 1), 30);

  const weekMatch = normalized.match(/(?:entro|nei prossimi|tra|fra)\s+(\d{1,2})\s+settiman/);
  if (weekMatch?.[1]) return Math.min(Math.max(Number(weekMatch[1]) * 7, 7), 60);

  if (normalized.includes("pochi giorni")) return 3;
  return null;
}

function parseScope(
  message: string,
  userName?: string | null,
): { scope?: SprintTimelineReadScope; personNames?: string[]; aggregateByOwner?: boolean } {
  const normalized = normalizeText(message);

  if (
    containsAny(normalized, [
      "chi sta facendo cosa",
      "chi fa cosa",
      "chi segue cosa",
      "chi sta seguendo",
      "chi sta lavorando",
      "siamo in ritardo",
      "cosa e in ritardo",
      "cosa è in ritardo",
      "cosa sta slittando",
      "cosa e a rischio",
      "cosa è a rischio",
    ])
  ) {
    return { scope: "company" };
  }

  if (normalized.includes("quante persone") && (normalized.includes("hanno da fare") || normalized.includes("hanno attivita"))) {
    return { scope: "company", aggregateByOwner: true };
  }
  if (normalized.includes("azienda") || normalized.includes("team") || normalized.includes("tutta l azienda")) {
    return { scope: "company" };
  }
  if (normalized.includes("come revisore") || normalized.includes("da revisore") || normalized.includes("sono revisore")) {
    return { scope: "me_reviewer" };
  }
  if (
    normalized.includes("io") ||
    normalized.includes("ho da fare") ||
    normalized.includes("cosa ho da fare") ||
    normalized.includes("cose da fare") ||
    normalized.includes("mie attivita") ||
    normalized.includes("miei task") ||
    normalized.includes("mie task") ||
    normalized.includes("i miei task") ||
    normalized.includes("le mie attivita") ||
    normalized.includes("miei compiti") ||
    normalized.includes("i miei compiti") ||
    normalized.includes("i miei todo")
  ) {
    return { scope: "me_owner" };
  }

  const personMatch =
    message.match(/(?:dimmi|mostrami|che ha da fare|cosa ha da fare)\s+(.+)$/i) ??
    message.match(/(?:per)\s+(.+)$/i);
  if (personMatch?.[1]) {
    const names = personMatch[1]
      .replace(/\?/g, "")
      .replace(/\boggi\b/gi, "")
      .replace(/\bin questi giorni\b/gi, "")
      .split(/\s+o\s+|,|\/| e /i)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (names.length) {
      return { scope: "person", personNames: names };
    }
  }

  if (userName) return { scope: "me_owner" };
  return {};
}

function parseMode(
  message: string,
):
  | "active_tasks"
  | "due_tasks"
  | "priority_advice"
  | "owner_overview"
  | "delay_overview"
  | "task_breakdown"
  | null {
  const normalized = normalizeText(message);
  if (
    containsAny(normalized, [
      "chi sta facendo cosa",
      "chi fa cosa",
      "chi segue cosa",
      "chi sta seguendo",
      "chi sta lavorando",
      "chi ha cosa da fare",
      "chi ha da fare cosa",
    ])
  ) {
    return "owner_overview";
  }
  if (
    containsAny(normalized, [
      "siamo in ritardo",
      "cosa e in ritardo",
      "cosa è in ritardo",
      "cosa sta slittando",
      "cosa sta andando lunga",
      "cosa e a rischio",
      "cosa è a rischio",
      "quali task sono in ritardo",
      "quali attivita sono in ritardo",
    ])
  ) {
    return "delay_overview";
  }
  if (
    containsAny(normalized, [
      "da quanti passaggi",
      "da quanti checkpoint",
      "quanti passaggi",
      "quanti checkpoint",
      "quanti step",
      "com e composto",
      "come e composto",
      "come è composto",
      "di quanti passaggi",
    ])
  ) {
    return "task_breakdown";
  }
  if (normalized.includes("scadenz") || normalized.includes("scade") || normalized.includes("in scadenza")) {
    return "due_tasks";
  }
  if (
    normalized.includes("per primo") ||
    normalized.includes("prima di tutto") ||
    normalized.includes("da dove parto") ||
    normalized.includes("cosa faccio prima") ||
    normalized.includes("come consigli") ||
    normalized.includes("come mi organizzo") ||
    normalized.includes("come organizz") ||
    normalized.includes("come mi conviene") ||
    normalized.includes("ordine di priorita") ||
    normalized.includes("ordine priorita")
  ) {
    return "priority_advice";
  }
  if (
    normalized.includes("priorita") ||
    normalized.includes("ha da fare") ||
    normalized.includes("ho da fare") ||
    normalized.includes("deve fare") ||
    normalized.includes("attivita") ||
    normalized.includes("task") ||
    normalized.includes("compiti") ||
    normalized.includes("compito") ||
    normalized.includes("todo") ||
    normalized.includes("to do") ||
    normalized.includes("to-do") ||
    normalized.includes("da fare") ||
    normalized.includes("cose da fare")
  ) {
    return "active_tasks";
  }
  return null;
}

function parseTaskQuery(message: string, mode: string | null): string | null {
  const normalized = normalizeText(message);
  if (!mode) return null;

  let candidate = normalized;
  const removals = [
    "chi sta facendo cosa",
    "chi fa cosa",
    "chi segue cosa",
    "chi sta seguendo",
    "chi sta lavorando",
    "siamo in ritardo su",
    "siamo in ritardo",
    "cosa e in ritardo",
    "cosa è in ritardo",
    "cosa sta slittando",
    "cosa e a rischio",
    "cosa è a rischio",
    "da quanti passaggi e composto",
    "da quanti passaggi è composto",
    "da quanti checkpoint e composto",
    "da quanti checkpoint è composto",
    "quanti passaggi ha",
    "quanti checkpoint ha",
    "quanti step ha",
    "quanti passaggi",
    "quanti checkpoint",
    "quanti step",
    "come e composto",
    "come è composto",
    "composto",
    "il task",
    "il compito",
    "task",
    "compito",
    "attivita",
    "attività",
    "dei prossimi giorni",
    "nei prossimi giorni",
    "di oggi",
    "di domani",
  ];

  for (const token of removals) {
    candidate = candidate.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
  }

  candidate = candidate
    .replace(/\b(quello|quella|questo|questa|del|della|di|su|nel|nella|per)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || candidate.length < 3) return null;
  return candidate;
}

function sortEvents(events: SprintTimelineEvent[]) {
  return [...events].sort((a, b) => {
    if (a.dateIndex !== b.dateIndex) return a.dateIndex - b.dateIndex;
    const aTime = a.date || "";
    const bTime = b.date || "";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.title.localeCompare(b.title);
  });
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const raw = value.slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function getTodayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getTodayIndex(board: SprintTimelineBoardData) {
  const start = parseDateOnly(board.sprint.startDate);
  if (!start) return 0;
  return Math.max(0, diffDays(start, getTodayDateOnly()));
}

function isOperationalCheckpoint(event?: SprintTimelineEvent | null) {
  return !!(event && event.kind === "checkpoint" && !event.systemCheckpointType);
}

function getEventChainId(event?: SprintTimelineEvent | null) {
  if (!event) return "";
  return event.chainId || event.sourceEventId || event.id;
}

function getLaneChainEvents(lane: SprintTimelineLane, chainId: string) {
  return sortEvents(
    lane.events.filter((event) => getEventChainId(event) === chainId),
  );
}

function getLatestTaskEventByKinds(
  lane: SprintTimelineLane,
  kinds: SprintTimelineEventKind[],
) {
  return sortEvents(lane.events).filter((event) => kinds.includes(event.kind)).slice(-1)[0];
}

function getCurrentCycleEvents(lane: SprintTimelineLane) {
  const events = sortEvents(lane.events);
  const lastReopenPosition = [...events].map((event) => event.kind).lastIndexOf("reopen");
  if (lastReopenPosition < 0) return events;
  return events.slice(lastReopenPosition + 1);
}

function getCurrentCycleCheckpointBases(lane: SprintTimelineLane) {
  return getCurrentCycleEvents(lane).filter((event) => isOperationalCheckpoint(event));
}

function getLatestValidationEvent(lane: SprintTimelineLane) {
  return getCurrentCycleEvents(lane).filter((event) => event.kind === "validation").slice(-1)[0];
}

function getCheckpointChainStatus(
  lane: SprintTimelineLane,
  chainId: string,
): "open" | "blocked" | "completed" {
  const latestState = getLaneChainEvents(lane, chainId)
    .filter((event) => event.kind === "block-update" || event.kind === "completion-update")
    .slice(-1)[0];

  if (!latestState) return "open";
  if (latestState.kind === "block-update") return "blocked";
  return "completed";
}

function getSignalLabel(signal: TimelineSemaforo) {
  switch (signal) {
    case "red":
      return "bloccato";
    case "orange":
      return "in scadenza";
    case "yellow":
      return "operativo";
    case "purple":
      return "in validazione";
    case "blue":
      return "avviato";
    case "teal":
      return "annotato";
    case "green":
      return "completato";
    case "gray":
    default:
      return "pianificato";
  }
}

function computeViewerNeedsToAct(
  lane: SprintTimelineLane,
  checkpointChainIds: string[],
) {
  return lane.events.some((event) => {
    if (event.kind === "validation") {
      return (
        event.validationState === "requested" &&
        !event.decisionLocked &&
        (event.viewerCanValidate || event.viewerIsValidator)
      );
    }

    if (event.kind === "block-update" || event.kind === "task-block") {
      return !!(event.viewerCanAct || event.viewerIsParticipant);
    }

    if (!isOperationalCheckpoint(event)) return false;
    const chainId = getEventChainId(event);
    if (!checkpointChainIds.includes(chainId)) return false;
    if (getCheckpointChainStatus(lane, chainId) !== "open") return false;
    return !!(event.viewerCanAct || event.viewerIsParticipant);
  });
}

function deriveLaneSnapshot(
  lane: SprintTimelineLane,
  todayIndex: number,
): SprintTimelineTaskSnapshot {
  const checkpointBases = getCurrentCycleCheckpointBases(lane);
  const checkpointChainIds = Array.from(
    new Set(checkpointBases.map((event) => getEventChainId(event)).filter(Boolean)),
  );
  const statuses = checkpointChainIds.map((chainId) => getCheckpointChainStatus(lane, chainId));
  const checkpointTitleByChainId = new Map(
    checkpointBases.map((event) => [getEventChainId(event), event.title]),
  );
  const openCheckpointCount = statuses.filter((status) => status === "open").length;
  const blockedCheckpointCount = statuses.filter((status) => status === "blocked").length;
  const completedCheckpointCount = statuses.filter((status) => status === "completed").length;
  const totalCheckpointCount = checkpointChainIds.length;
  const openCheckpointTitles = checkpointChainIds
    .filter((chainId) => getCheckpointChainStatus(lane, chainId) === "open")
    .map((chainId) => checkpointTitleByChainId.get(chainId) ?? "")
    .filter(Boolean);
  const blockedCheckpointTitles = checkpointChainIds
    .filter((chainId) => getCheckpointChainStatus(lane, chainId) === "blocked")
    .map((chainId) => checkpointTitleByChainId.get(chainId) ?? "")
    .filter(Boolean);
  const latestCompletion = getLatestTaskEventByKinds(lane, ["completion"]);
  const latestReopen = getLatestTaskEventByKinds(lane, ["reopen"]);
  const latestTaskBlock = getLatestTaskEventByKinds(lane, ["task-block"]);
  const latestValidation = getLatestValidationEvent(lane);
  const latestStartLike = getLatestTaskEventByKinds(lane, ["start", "reopen"]);
  const latestExpectedCompletion = sortEvents(lane.events)
    .filter((event) => event.kind === "expected-completion" || event.systemCheckpointType === "expected-completion")
    .slice(-1)[0];
  const latestCompletionIndex = latestCompletion?.dateIndex ?? -1;
  const latestReopenIndex = latestReopen?.dateIndex ?? -1;
  const latestTaskBlockIndex = latestTaskBlock?.dateIndex ?? -1;
  const expectedIndex = latestExpectedCompletion?.dateIndex ?? -1;
  const allCurrentCycleCheckpointsCompleted =
    checkpointChainIds.length > 0 &&
    checkpointChainIds.every((chainId) => getCheckpointChainStatus(lane, chainId) === "completed");
  const hasPendingValidationWindow =
    allCurrentCycleCheckpointsCompleted &&
    (!latestValidation || latestValidation.validationState !== "decided");
  let signal: TimelineSemaforo = "gray";

  if (latestCompletionIndex > latestReopenIndex) signal = "green";
  else if (blockedCheckpointCount > 0 || latestTaskBlockIndex > latestReopenIndex) signal = "red";
  else if (latestValidation?.validationState === "requested" || hasPendingValidationWindow) signal = "purple";
  else if (expectedIndex >= 0 && todayIndex > expectedIndex) signal = "orange";
  else if (openCheckpointCount > 0) signal = "yellow";
  else if (latestStartLike) signal = "blue";
  else if (lane.events.some((event) => event.kind === "note")) signal = "teal";

  const daysRemaining =
    typeof expectedIndex === "number" && expectedIndex >= 0 && signal !== "green"
      ? expectedIndex - todayIndex
      : null;
  const viewerNeedsToAct = computeViewerNeedsToAct(lane, checkpointChainIds);
  const nextPassageLabel =
    blockedCheckpointTitles[0] ??
    openCheckpointTitles[0] ??
    null;
  let summaryReason = "task attivo";
  if (signal === "red") summaryReason = blockedCheckpointCount > 0 ? `${blockedCheckpointCount} checkpoint bloccati` : "blocco task aperto";
  else if (signal === "purple") summaryReason = "validazione in attesa";
  else if (signal === "yellow") summaryReason = `${openCheckpointCount} checkpoint aperti`;
  else if (signal === "blue") summaryReason = "task avviato";
  else if (signal === "orange") summaryReason = "task oltre la scadenza attesa";
  if (viewerNeedsToAct) summaryReason += ", richiede una tua azione";

  return {
    laneId: lane.id,
    sprintId: lane.sourceSprintId ?? null,
    sprintLabel: lane.sourceSprintId ?? null,
    title: lane.title,
    subtitle: lane.subtitle,
    description: lane.description,
    objectives: lane.objectives,
    ownerName: lane.ownerName,
    referenteName: lane.referenteName,
    priority: lane.priority,
    signal,
    stateLabel: getSignalLabel(signal),
    expectedEnd: lane.expectedEnd,
    daysRemaining,
    openCheckpointCount,
    blockedCheckpointCount,
    completedCheckpointCount,
    totalCheckpointCount,
    openCheckpointTitles,
    blockedCheckpointTitles,
    nextPassageLabel,
    viewerNeedsToAct,
    viewerVisibility: lane.viewerVisibility,
    summaryReason,
  };
}

function formatDateOnly(value?: string) {
  if (!value) return "senza data";
  const date = parseDateOnly(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function describeRemainingDays(daysRemaining: number | null) {
  if (daysRemaining === null) return "senza scadenza";
  if (daysRemaining < 0) return `scaduto da ${Math.abs(daysRemaining)}g`;
  if (daysRemaining === 0) return "scade oggi";
  if (daysRemaining === 1) return "scade domani";
  return `scade tra ${daysRemaining}g`;
}

function buildListLine(task: SprintTimelineTaskSnapshot) {
  const due = describeRemainingDays(task.daysRemaining);
  const sprint = task.sprintLabel ? ` [${task.sprintLabel}]` : "";
  const expected = task.expectedEnd ? `, target ${formatDateOnly(task.expectedEnd)}` : "";
  const owner = task.ownerName ? ` | owner ${task.ownerName}` : "";
  const reviewer = task.referenteName ? ` | revisore ${task.referenteName}` : "";
  const passages = task.totalCheckpointCount
    ? ` | passaggi ${task.completedCheckpointCount}/${task.totalCheckpointCount}`
    : "";
  const passage = task.nextPassageLabel ? ` | passaggio: ${task.nextPassageLabel}` : "";
  const scheduling = task.schedulerReason ? ` | ordine: ${task.schedulerReason}` : "";
  return `- ${task.title}${sprint}${owner}${reviewer} | ${task.stateLabel} | priorita ${task.priority} | ${due}${expected}${passages}${passage} | ${task.summaryReason}${scheduling}`;
}

function buildPresentation(
  header: string,
  tasks: SprintTimelineTaskSnapshot[],
  footer?: string | null,
): SprintTimelineListingPresentation {
  if (!tasks.length) {
    return {
      mode: "summarized",
      header,
      listBlock: null,
      summaryText: header,
      footer: footer ?? null,
    };
  }

  return {
    mode: "verbatim_list",
    header,
    listBlock: tasks.map(buildListLine).join("\n"),
    summaryText: null,
    footer: footer ?? null,
  };
}

function buildTaskSnapshots(board: SprintTimelineBoardData) {
  const todayIndex = getTodayIndex(board);
  return board.lanes.map((lane) => deriveLaneSnapshot(lane, todayIndex));
}

function matchesPerson(task: SprintTimelineTaskSnapshot, personNames: string[]) {
  const owner = normalizeText(task.ownerName ?? "");
  const reviewer = normalizeText(task.referenteName ?? "");
  return personNames.some((name) => {
    const pattern = normalizeText(name);
    return !!pattern && (owner.includes(pattern) || reviewer.includes(pattern));
  });
}

function looselyMatchesName(candidate: string, expected: string) {
  if (!candidate || !expected) return false;
  return candidate === expected || candidate.includes(expected) || expected.includes(candidate);
}

function matchesTaskQuery(task: SprintTimelineTaskSnapshot, taskQuery?: string | null) {
  const normalizedQuery = normalizeText(taskQuery ?? "");
  if (!normalizedQuery) return true;

  const haystack = normalizeText(
    [
      task.title,
      task.subtitle,
      task.description,
      task.objectives,
      task.ownerName,
      task.referenteName,
      task.nextPassageLabel,
      ...task.openCheckpointTitles,
      ...task.blockedCheckpointTitles,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const tokens = normalizedQuery.split(" ").filter((token) => token.length >= 3);
  if (!tokens.length) return haystack.includes(normalizedQuery);
  return tokens.every((token) => haystack.includes(token));
}

function applyQueryFilters(
  tasks: SprintTimelineTaskSnapshot[],
  query: SprintTimelineReadQuery,
  userDisplayName?: string | null,
) {
  const normalizedUser = normalizeText(userDisplayName ?? "");

  return tasks.filter((task) => {
    if (
      query.mode !== "due_tasks" &&
      query.mode !== "delay_overview" &&
      !ACTIVE_SIGNALS.has(task.signal)
    ) {
      return false;
    }
    if (query.scope === "me_owner" && (!normalizedUser || !looselyMatchesName(normalizeText(task.ownerName ?? ""), normalizedUser))) return false;
    if (query.scope === "me_reviewer" && (!normalizedUser || !looselyMatchesName(normalizeText(task.referenteName ?? ""), normalizedUser))) return false;
    if (query.scope === "person" && query.personNames?.length && !matchesPerson(task, query.personNames)) return false;
    if (query.signals?.length && !query.signals.includes(task.signal as SprintTimelineSignalFilter)) return false;
    if (query.priority && task.priority !== query.priority) return false;
    if (!matchesTaskQuery(task, query.taskQuery)) return false;
    if (query.mode === "due_tasks") {
      if (task.signal === "green" || task.daysRemaining === null) return false;
      if (typeof query.dueWithinDays === "number" && task.daysRemaining > query.dueWithinDays) return false;
    }
    if (query.mode === "delay_overview") {
      if (task.signal === "green" || task.daysRemaining === null) return false;
      if (task.daysRemaining > 3 && task.signal !== "red" && task.signal !== "orange") return false;
    }
    return true;
  });
}

function buildCountOwnersResult(tasks: SprintTimelineTaskSnapshot[]): SprintTimelineReadResult {
  const ownerNames = Array.from(new Set(tasks.map((task) => task.ownerName?.trim()).filter(Boolean))) as string[];
  const header = ownerNames.length
    ? `Ci sono ${ownerNames.length} persone con attivita nel filtro corrente.`
    : "Nel filtro corrente non vedo persone con attivita assegnate.";

  return {
    header,
    text: ownerNames.length ? `${header}\n\n${ownerNames.map((name) => `- ${name}`).join("\n")}` : header,
    total: tasks.length,
    items: tasks,
    distinctOwnerCount: ownerNames.length,
    ownerNames,
    presentation: {
      mode: "summarized",
      header,
      listBlock: ownerNames.length ? ownerNames.map((name) => `- ${name}`).join("\n") : null,
      summaryText: null,
      footer: null,
    },
  };
}

function buildOwnerOverviewResult(tasks: SprintTimelineTaskSnapshot[]): SprintTimelineReadResult {
  const grouped = new Map<string, SprintTimelineTaskSnapshot[]>();
  for (const task of tasks) {
    const owner = task.ownerName?.trim() || "Senza owner";
    const bucket = grouped.get(owner) ?? [];
    bucket.push(task);
    grouped.set(owner, bucket);
  }

  const ownerEntries = [...grouped.entries()]
    .map(([owner, ownerTasks]) => {
      const ordered = scheduleSprintTasks(ownerTasks).slice(0, 3);
      const blocked = ownerTasks.filter((task) => task.signal === "red").length;
      const overdue = ownerTasks.filter(
        (task) => task.daysRemaining !== null && task.daysRemaining < 0,
      ).length;
      return { owner, ownerTasks, ordered, blocked, overdue };
    })
    .sort((a, b) => b.ownerTasks.length - a.ownerTasks.length || a.owner.localeCompare(b.owner));

  const header = ownerEntries.length
    ? "Questa e la fotografia di chi sta facendo cosa nello sprint corrente."
    : "Nel perimetro attuale non vedo task attivi da distribuire per owner.";
  const listBlock = ownerEntries.length
    ? ownerEntries
        .map(
          ({ owner, ownerTasks, ordered, blocked, overdue }) =>
            `- ${owner}: ${ownerTasks.length} task attivi, ${blocked} bloccati, ${overdue} in ritardo. Focus: ${ordered
              .map((task) => task.title)
              .join(", ")}`,
        )
        .join("\n")
    : null;

  return {
    header,
    text: [header, listBlock].filter(Boolean).join("\n\n"),
    total: tasks.length,
    items: tasks,
    distinctOwnerCount: ownerEntries.length,
    ownerNames: ownerEntries.map((entry) => entry.owner),
    presentation: {
      mode: "verbatim_list",
      header,
      listBlock,
      summaryText: null,
      footer: ownerEntries.length
        ? "Ogni riga riassume carico, ritardi e focus principali per persona."
        : null,
    },
  };
}

function buildDelayOverviewResult(tasks: SprintTimelineTaskSnapshot[]): SprintTimelineReadResult {
  const ordered = scheduleSprintTasks(tasks);
  const overdue = ordered.filter(
    (task) => task.daysRemaining !== null && task.daysRemaining < 0,
  );
  const nearDue = ordered.filter(
    (task) => task.daysRemaining !== null && task.daysRemaining >= 0 && task.daysRemaining <= 3,
  );
  const selected = [...overdue, ...nearDue.filter((task) => !overdue.includes(task))].slice(0, 12);

  const header = selected.length
    ? `Vedo ${overdue.length} task in ritardo e ${nearDue.length} task molto vicini alla scadenza.`
    : "Nel perimetro attuale non vedo task in ritardo o immediatamente a rischio.";

  return {
    header,
    text: [header, selected.length ? selected.map(buildListLine).join("\n") : null].filter(Boolean).join("\n\n"),
    total: selected.length,
    items: selected,
    presentation: buildPresentation(
      header,
      selected,
      selected.length ? "L'ordine mette davanti i task gia in ritardo o piu vicini alla scadenza." : null,
    ),
  };
}

function buildTaskBreakdownResult(tasks: SprintTimelineTaskSnapshot[], taskQuery?: string | null): SprintTimelineReadResult {
  const ordered = scheduleSprintTasks(tasks);
  const task = ordered[0];
  const header = task
    ? `Ecco come e composto il task "${task.title}".`
    : taskQuery
      ? `Non riesco ancora a collegare "${taskQuery}" a un task dello sprint corrente.`
      : "Per il breakdown mi serve capire quale task vuoi analizzare.";

  const text = task
    ? [
        header,
        `Ha ${task.totalCheckpointCount} passaggi totali: ${task.completedCheckpointCount} completati, ${task.openCheckpointCount} aperti e ${task.blockedCheckpointCount} bloccati.`,
        task.nextPassageLabel ? `Il prossimo passaggio rilevante e "${task.nextPassageLabel}".` : null,
        task.blockedCheckpointTitles.length
          ? `Passaggi bloccati: ${task.blockedCheckpointTitles.join(", ")}.`
          : null,
        task.openCheckpointTitles.length
          ? `Passaggi ancora aperti: ${task.openCheckpointTitles.slice(0, 4).join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : header;

  return {
    header,
    text,
    total: task ? 1 : 0,
    items: task ? [task] : [],
    presentation: {
      mode: "summarized",
      header,
      listBlock: null,
      summaryText: task ? text : header,
      footer: null,
    },
  };
}

function buildReadResult(
  query: SprintTimelineReadQuery,
  tasks: SprintTimelineTaskSnapshot[],
): SprintTimelineReadResult {
  const scheduled = scheduleSprintTasks(tasks);
  const sorted = scheduled.slice(0, 12);
  if (query.aggregateByOwner) return buildCountOwnersResult(sorted);
  if (query.mode === "owner_overview") return buildOwnerOverviewResult(sorted);
  if (query.mode === "delay_overview") return buildDelayOverviewResult(sorted);
  if (query.mode === "task_breakdown") return buildTaskBreakdownResult(sorted, query.taskQuery ?? null);

  const header =
    query.mode === "due_tasks"
      ? "Queste sono le attivita che rientrano nella finestra di scadenza richiesta."
      : query.mode === "priority_advice"
        ? "Questi sono i task ordinati per priorita operativa e urgenza."
        : "Questi sono i task attivi ordinati per priorita operativa e scadenza.";
  const presentation = buildPresentation(
    header,
    sorted,
    sorted.length
      ? "Ogni riga descrive il task come unita principale, con il prossimo passaggio rilevante e il motivo dell'ordine."
      : null,
  );

  return {
    header,
    text: [header, presentation.listBlock, presentation.footer].filter(Boolean).join("\n\n"),
    total: sorted.length,
    items: sorted,
    presentation,
  };
}

export function parseSprintTimelineReadIntent(args: {
  message: string;
  userDisplayName?: string | null;
}): SprintTimelineReadIntent | null {
  const normalized = normalizeText(args.message);
  if (hasExplicitAnagraficheContext(normalized)) return null;

  const mode = parseMode(args.message);
  if (!mode) return null;

  const scopeInfo = parseScope(args.message, args.userDisplayName);
  return {
    type: "sprint_timeline_read",
    query: {
      mode,
      scope: scopeInfo.scope ?? null,
      personNames: scopeInfo.personNames ?? [],
      signals: parseSignals(args.message),
      priority: parsePriority(args.message),
      dueWithinDays: parseDueWithinDays(args.message),
      taskQuery: parseTaskQuery(args.message, mode),
      aggregateByOwner: scopeInfo.aggregateByOwner ?? false,
    },
    explanation: "Matched sprint timeline read router",
    debug: {
      matchedBy: `sprint_timeline.${mode}`,
    },
  };
}

export function mergePendingSprintTimelineReadIntent(args: {
  pending: PendingSprintTimelineReadState;
  message: string;
  userDisplayName?: string | null;
}): SprintTimelineReadIntent {
  const parsed = parseSprintTimelineReadIntent({
    message: args.message,
    userDisplayName: args.userDisplayName,
  });

  return {
    type: "sprint_timeline_read",
    query: {
      mode: parsed?.query.mode ?? args.pending.data.mode ?? "active_tasks",
      scope: parsed?.query.scope ?? args.pending.data.scope ?? null,
      personNames:
        parsed?.query.personNames?.length
          ? parsed.query.personNames
          : args.pending.data.personNames ?? [],
      signals:
        parsed?.query.signals?.length
          ? parsed.query.signals
          : args.pending.data.signals ?? [],
      priority: parsed?.query.priority ?? args.pending.data.priority ?? null,
      dueWithinDays: parsed?.query.dueWithinDays ?? args.pending.data.dueWithinDays ?? null,
      taskQuery: parsed?.query.taskQuery ?? args.pending.data.taskQuery ?? null,
      aggregateByOwner: parsed?.query.aggregateByOwner ?? args.pending.data.aggregateByOwner ?? false,
    },
    explanation: "Merged sprint timeline read intent with pending state",
    debug: {
      matchedBy: parsed?.debug.matchedBy ?? "sprint_timeline.pending_merge",
    },
  };
}

export function mergeSprintTimelineReadIntentWithFill(args: {
  intent: SprintTimelineReadIntent | null;
  pending: PendingSprintTimelineReadState | null;
  fill: SprintTimelineReadOperationContextFillResult | null;
  message: string;
  userDisplayName?: string | null;
}): SprintTimelineReadIntent | null {
  const baseIntent =
    args.pending && !args.intent
      ? mergePendingSprintTimelineReadIntent({
          pending: args.pending,
          message: args.message,
          userDisplayName: args.userDisplayName,
        })
      : args.intent;

  if (!baseIntent && !args.fill) {
    return null;
  }

  const resolvedMode =
    args.fill?.queryPatch.mode ??
    baseIntent?.query.mode ??
    args.pending?.data.mode ??
    "active_tasks";
  const fallbackScope =
    resolvedMode === "owner_overview" ||
    resolvedMode === "delay_overview" ||
    resolvedMode === "task_breakdown"
      ? "company"
      : args.userDisplayName
        ? "me_owner"
        : null;
  const query: SprintTimelineReadQuery = {
    mode: resolvedMode,
    scope:
      args.fill?.queryPatch.scope ??
      baseIntent?.query.scope ??
      args.pending?.data.scope ??
      fallbackScope,
    personNames:
      args.fill?.queryPatch.personNames ??
      baseIntent?.query.personNames ??
      args.pending?.data.personNames ??
      [],
    signals:
      args.fill?.queryPatch.signals ??
      baseIntent?.query.signals ??
      args.pending?.data.signals ??
      [],
    priority:
      typeof args.fill?.queryPatch.priority !== "undefined"
        ? args.fill.queryPatch.priority
        : baseIntent?.query.priority ??
          args.pending?.data.priority ??
          null,
    dueWithinDays:
      typeof args.fill?.queryPatch.dueWithinDays !== "undefined"
        ? args.fill.queryPatch.dueWithinDays
        : baseIntent?.query.dueWithinDays ??
          args.pending?.data.dueWithinDays ??
          null,
    taskQuery:
      typeof args.fill?.queryPatch.taskQuery !== "undefined"
        ? args.fill.queryPatch.taskQuery
        : baseIntent?.query.taskQuery ??
          args.pending?.data.taskQuery ??
          null,
    aggregateByOwner:
      typeof args.fill?.queryPatch.aggregateByOwner === "boolean"
        ? args.fill.queryPatch.aggregateByOwner
        : baseIntent?.query.aggregateByOwner ??
          args.pending?.data.aggregateByOwner ??
          false,
  };

  return {
    type: "sprint_timeline_read",
    query,
    explanation:
      baseIntent?.explanation ??
      "Intent SprintTimeline ricostruito dal contesto conversazionale.",
    debug: {
      matchedBy: args.fill
        ? "sprint_timeline.fill"
        : (baseIntent?.debug.matchedBy ?? "sprint_timeline.pending"),
    },
  };
}

export function analyzeSprintTimelineReadIntent(intent: SprintTimelineReadIntent): SprintTimelineReadClarification {
  if (intent.query.mode === "task_breakdown" && !intent.query.taskQuery?.trim()) {
    return {
      needsClarification: true,
      missing: ["task_query"],
    };
  }

  return {
    needsClarification: false,
    missing: [],
  };
}

export function buildSprintTimelineReadQuestion(args: {
  missing: string[];
  currentQuery: SprintTimelineReadQuery;
}) {
  if (args.missing.includes("scope")) {
    return "Prima mi aiuta capire il perimetro: vuoi vedere attivita dell'azienda, tue come owner, tue come revisore, oppure di qualcuno in particolare?";
  }
  if (args.missing.includes("signal")) {
    return "Perfetto. Vuoi filtrare per semaforo? Posso cercare bloccate, operative, in validazione, avviate oppure tutto.";
  }
  if (args.missing.includes("priority")) {
    return "Chiaro. Vuoi restringere anche per urgenza? Posso filtrare urgente, alta, media, bassa oppure tutto.";
  }
  if (args.missing.includes("due_window")) {
    return "Entro quanti giorni vuoi controllare le scadenze? Ad esempio 3, 7 o 14 giorni.";
  }
  if (args.missing.includes("task_query")) {
    return "Dimmi quale task vuoi analizzare e ti dico da quanti passaggi e composto, cosa e aperto e cosa e bloccato.";
  }
  return "Dimmi pure come vuoi restringere la ricerca e la compilo.";
}

export async function executeSprintTimelineReadIntent(args: {
  auth: AuthContext;
  query: SprintTimelineReadQuery;
  userDisplayName?: string | null;
}): Promise<SprintTimelineReadResult> {
  const { aggregateBoard, failures, items } = await loadAggregateSprintTimelineBoard({
    auth: args.auth,
  });

  if (!aggregateBoard) {
    const header = failures.length
      ? "Non riesco ancora a leggere la SprintTimeline aggregata."
      : "Non trovo sprint timeline leggibili nel perimetro attuale.";

    return {
      header,
      text: header,
      total: 0,
      items: [],
      presentation: {
        mode: "summarized",
        header,
        listBlock: null,
        summaryText: header,
        footer: null,
      },
    };
  }

  const sprintLabelById = new Map(items.map((item) => [item.sprintId, item.board.sprint.label]));
  const tasks = buildTaskSnapshots(aggregateBoard).map((task) => ({
    ...task,
    sprintLabel: task.sprintId ? sprintLabelById.get(task.sprintId) ?? task.sprintId : null,
  }));

  const filtered = applyQueryFilters(tasks, args.query, args.userDisplayName);
  return buildReadResult(args.query, filtered);
}

export function buildDeterministicFirstTaskAdvice(result: SprintTimelineReadResult) {
  const first = result.items[0];
  if (!first) {
    return "Per ora non vedo un task chiaro da attaccare per primo nel filtro che hai impostato.";
  }

  return [
    `Partirei da "${first.title}".`,
    `Adesso e ${first.stateLabel}, ha priorita ${first.priority} e ${describeRemainingDays(first.daysRemaining)}.`,
    `Il motivo principale e: ${first.schedulerReason ?? first.summaryReason}.`,
    first.nextPassageLabel ? `Il passaggio che terrei subito sotto controllo e "${first.nextPassageLabel}".` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
