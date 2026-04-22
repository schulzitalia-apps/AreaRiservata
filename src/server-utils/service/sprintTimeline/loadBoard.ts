import mongoose from "mongoose";

import { getAulaById, type AulaDetail } from "@/server-utils/service/auleQuery";
import { listAnagrafiche } from "@/server-utils/service/Anagrafiche/list";
import { listEventi, type EventoPreview } from "@/server-utils/service/eventiQuery";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type {
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineEventKind,
  SprintTimelineLane,
  SprintTimelineSegment,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { listAuleByType, getAnagraficaDef_untyped } from "@/server-utils/service/auleQuery";
import { ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";
import {
  buildSprintTimelineVisibilityContext,
  resolveUserIdsByActorNames,
  resolveUserIdsByAnagraficaId,
  viewerMatchesResolvedUserIds,
  viewerOwnsReference,
  type SprintTimelineVisibilityContext,
} from "./visibility";
import { resolveAtlasReferenceLabels } from "./resolvers";

const SPRINT_AULA_TYPE = "sprint";
const TASK_ANAGRAFICA_TYPE = "task";
const TIMELINE_EVENT_TYPE = "avanzamento-task";

const TIMELINE_KIND_FIELD = "tipoTimelineTask";
const TIMELINE_CHAIN_ID_FIELD = "chainIdTimelineTask";
const TIMELINE_SOURCE_EVENT_ID_FIELD = "sourceEventIdTimelineTask";
const TIMELINE_PAYLOAD_FIELD = "payloadTimelineTask";
const TIMELINE_LEGACY_PAYLOAD_FIELD = "timelinePayload";

const TIMELINE_TASK_FIELDS = [
  "titoloTask",
  "descrizioneTask",
  "capitoloTask",
  "antologiaTask",
  "ambitoTask",
  "prioritaTask",
  "priority",
  "statoTask",
  "titolareTask",
  "titolareTaskNome",
  "referenteTask",
  "conclusioneAttesa",
  "conclusioneEffettiva",
];

type SprintTimelineTaskRecord = {
  id: string;
  data: Record<string, any>;
  visibilityRoles?: string[];
  updatedAt?: string;
};

type TimelineChecklistItemCodec = {
  id: string;
  label: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
};

type TimelinePayloadCodec = {
  kind?: SprintTimelineEventKind;
  chainId?: string;
  sourceEventId?: string;
  createdByValidationId?: string;
  participants?: string[];
  validators?: string[];
  checklist?: TimelineChecklistItemCodec[];
  validationState?: "requested" | "decided";
  validationResult?: "approved" | "rejected" | "pending";
  decisionLocked?: boolean;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  completionDays?: number;
  delayDays?: number;
  color?: string;
  systemCheckpointType?: "planned-start" | "expected-completion" | "taken-over";
};

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

function extractAnagraficaId(value: any): string | undefined {
  if (!value) return undefined;

  // Caso 1: ObjectId nativo di MongoDB
  if (mongoose.isValidObjectId(value)) {
    return String(value);
  }

  // Caso 2: Stringa (ID pulito o formato legacy 'slug::id')
  if (typeof value === "string") {
    if (value.includes("::")) return value.split("::")[1];
    return value.trim() || undefined;
  }

  // Caso 3: Oggetto reference di Atlas { anagraficaType, anagraficaId }
  if (typeof value === "object" && value.anagraficaId) {
    return String(value.anagraficaId).trim();
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
}

function dateOnly(value?: string | null): string | undefined {
  return normalizeIsoDate(value)?.slice(0, 10);
}

function computeTotalUnits(startDate?: string, endDate?: string): number {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  if (!start || !end) return 30;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000) + 1);
}

function getDateIndex(
  sprintStartDate?: string,
  isoDateTime?: string | null,
): number {
  const start = dateOnly(sprintStartDate);
  const current = dateOnly(isoDateTime);
  if (!start || !current) return 0;

  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${current}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function mapNamesToParticipants(
  names: string[] | undefined,
  visibilityContext: SprintTimelineVisibilityContext,
) {
  return uniqueStrings(names ?? []).map((nameOrId) => {
    // Se è un ObjectId, è un'anagrafica, altrimenti è un nome libero
    const strId = String(nameOrId);
    const isId = mongoose.isValidObjectId(strId);
    return {
      id: strId,
      name: strId, // Verrà risolto dopo se è un ID
      userIds: isId 
        ? resolveUserIdsByAnagraficaId(visibilityContext, strId)
        : resolveUserIdsByActorNames(visibilityContext, [strId]),
    };
  });
}

function buildNativeParticipants(
  evento: EventoPreview,
  visibilityContext: SprintTimelineVisibilityContext,
  referenceLabelMap?: Map<string, string | null>,
) {
  return (evento.partecipanti ?? [])
    .filter(
      (partecipante) =>
        partecipante.anagraficaType !== TASK_ANAGRAFICA_TYPE &&
        !!partecipante.anagraficaId,
    )
    .map((partecipante) => {
      const anagId = String(partecipante.anagraficaId);
      const nameFromDict = referenceLabelMap?.get(anagId);

      return {
        id: anagId,
        name:
          nameFromDict ||
          partecipante.role ||
          partecipante.status ||
          anagId,
        referenceType: partecipante.anagraficaType,
        referenceId: anagId,
        userIds: resolveUserIdsByAnagraficaId(
          visibilityContext,
          anagId,
        ),
      };
    });
}

function dedupeParticipants(
  participants: Array<{
    id: string;
    name: string;
    userIds?: string[];
    referenceType?: string;
    referenceId?: string;
  }>,
) {
  const map = new Map<string, (typeof participants)[number]>();
  for (const participant of participants) {
    const key =
      participant.referenceId ||
      participant.name ||
      participant.id;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...participant,
        userIds: uniqueStrings(participant.userIds ?? []),
      });
      continue;
    }

    map.set(key, {
      ...existing,
      userIds: uniqueStrings([
        ...(existing.userIds ?? []),
        ...(participant.userIds ?? []),
      ]),
    });
  }

  return Array.from(map.values());
}

function normalizeEventKind(raw?: string): SprintTimelineEventKind {
  const allowed: SprintTimelineEventKind[] = [
    "planned-start",
    "start",
    "checkpoint",
    "completion-update",
    "block-update",
    "expected-completion",
    "validation",
    "completion",
    "task-block",
    "reopen",
    "note",
  ];

  if (raw && allowed.includes(raw as SprintTimelineEventKind)) {
    return raw as SprintTimelineEventKind;
  }

  return "note";
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

function parseTimelinePayload(raw: unknown): TimelinePayloadCodec {
  if (!raw || typeof raw !== "string") return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TimelinePayloadCodec;
  } catch {
    return {};
  }
}

function getTimelinePayloadRaw(data?: Record<string, any>): string | undefined {
  return (
    asString(data?.[TIMELINE_PAYLOAD_FIELD]) ||
    asString(data?.[TIMELINE_LEGACY_PAYLOAD_FIELD])
  );
}

function getTimelinePayloadFromData(data?: Record<string, any>): TimelinePayloadCodec {
  return parseTimelinePayload(getTimelinePayloadRaw(data));
}

function mapEventoToTimelineEvent(
  evento: EventoPreview,
  sprintStartDate?: string,
  visibilityContext?: SprintTimelineVisibilityContext,
  referenceLabelMap: Map<string, string | null> = new Map(),
): SprintTimelineEvent {
  const payload = getTimelinePayloadFromData(evento.data);

  const date =
    normalizeIsoDate(evento.startAt) ||
    normalizeIsoDate(evento.endAt) ||
    "";

  const title = asString(evento.data?.titolo) || "Evento";
  const kindFromField = asString(evento.data?.[TIMELINE_KIND_FIELD]);
  const chainIdFromField = asString(evento.data?.[TIMELINE_CHAIN_ID_FIELD]);
  const sourceEventIdFromField = asString(
    evento.data?.[TIMELINE_SOURCE_EVENT_ID_FIELD],
  );

  const participants = visibilityContext
    ? dedupeParticipants([
        ...mapNamesToParticipants(payload.participants, visibilityContext),
        ...buildNativeParticipants(evento, visibilityContext, referenceLabelMap),
      ])
    : [];

  // Risoluzione esplicita dei nomi per i partecipanti che hanno solo ID
  const resolvedParticipants = participants.map(p => {
    const pName = String(p.name);
    // Se il nome è un ObjectId, proviamo a risolverlo dalla mappa
    if (mongoose.isValidObjectId(pName) && referenceLabelMap?.has(pName)) {
      return { ...p, name: referenceLabelMap.get(pName) || pName };
    }
    // Se abbiamo un referenceId e il nome non è risolto (uguale all'ID), proviamo con quello
    if (p.referenceId && p.name === p.referenceId && referenceLabelMap?.has(p.referenceId)) {
      return { ...p, name: referenceLabelMap.get(p.referenceId) || p.name };
    }
    return p;
  });

  const validators = visibilityContext
    ? dedupeParticipants([
        ...mapNamesToParticipants(payload.validators, visibilityContext),
        ...buildNativeParticipants(evento, visibilityContext, referenceLabelMap).filter(p => p.name === "validator" || p.referenceType === "evolver"),
      ])
    : [];

  const resolvedValidators = validators.map(v => {
    if (mongoose.isValidObjectId(v.name) && referenceLabelMap?.has(v.name)) {
      return { ...v, name: referenceLabelMap.get(v.name) || v.name };
    }
    if (v.referenceId && v.name === v.referenceId && referenceLabelMap?.has(v.referenceId)) {
      return { ...v, name: referenceLabelMap.get(v.referenceId) || v.name };
    }
    return v;
  });

  return {
    id: evento.id,
    kind: normalizeEventKind(kindFromField || payload.kind),
    title,
    date,
    dateIndex: getDateIndex(sprintStartDate, date),
    note: asString(evento.data?.descrizione),
    chainId: chainIdFromField || payload.chainId,
    sourceEventId: sourceEventIdFromField || payload.sourceEventId,
    createdByValidationId: payload.createdByValidationId,
    participants: resolvedParticipants,
    validators: resolvedValidators,
    checklist: payload.checklist?.map((item, index) => ({
      id: item.id || `chk-${index}`,
      label: item.label,
      done: !!item.done,
      doneBy: item.doneBy,
      doneAt: item.doneAt,
    })),
    validationState: payload.validationState,
    validationResult: payload.validationResult,
    decisionLocked: payload.decisionLocked,
    decidedBy: payload.decidedBy,
    decidedAt: payload.decidedAt,
    decisionNote: payload.decisionNote,
    completionDays: payload.completionDays,
    delayDays: payload.delayDays,
    color: payload.color as any,
    systemCheckpointType: payload.systemCheckpointType || (title.includes("| Conclusione attesa |") ? "expected-completion" : undefined),
    viewerIsParticipant: visibilityContext
      ? participants.some((participant) =>
          viewerMatchesResolvedUserIds(visibilityContext, participant.userIds),
        ) ||
        participants.some((participant) =>
          viewerOwnsReference(visibilityContext, participant.referenceId),
        )
      : false,
    viewerIsValidator: visibilityContext
      ? validators.some((validator) =>
          viewerMatchesResolvedUserIds(visibilityContext, validator.userIds),
        )
      : false,
    viewerCanAct: visibilityContext
      ? participants.some((participant) =>
          viewerMatchesResolvedUserIds(visibilityContext, participant.userIds),
        ) ||
        participants.some((participant) =>
          viewerOwnsReference(visibilityContext, participant.referenceId),
        )
      : false,
    viewerCanValidate: visibilityContext
      ? validators.some((validator) =>
          viewerMatchesResolvedUserIds(visibilityContext, validator.userIds),
        )
      : false,
  };
}

function buildSyntheticEvent(
  id: string,
  kind: SprintTimelineEventKind,
  title: string,
  date: string | undefined,
  sprintStartDate?: string,
  note?: string,
): SprintTimelineEvent | null {
  const iso = normalizeIsoDate(date);
  if (!iso) return null;

  return {
    id,
    kind,
    title,
    date: iso,
    dateIndex: getDateIndex(sprintStartDate, iso),
    note,
  };
}

function mapTaskToLane(args: {
  task: SprintTimelineTaskRecord;
  sprintStartDate?: string;
  events: EventoPreview[];
  referenceLabelMap?: Record<string, string | null>;
  visibilityContext?: SprintTimelineVisibilityContext;
}): SprintTimelineLane {
  const { task, sprintStartDate, events, referenceLabelMap, visibilityContext } = args;

  const title = asString(task.data?.titoloTask) || "Task";
  const taskEvents = events.map((evento) =>
    mapEventoToTimelineEvent(
      evento,
      sprintStartDate,
      visibilityContext,
      new Map<string, string | null>(Object.entries(referenceLabelMap || {})),
    ),
  );

  const expectedEnd = asString(task.data?.conclusioneAttesa);
  const actualEnd = asString(task.data?.conclusioneEffettiva);

  const syntheticExpected = buildSyntheticEvent(
    `expected:${task.id}`,
    "expected-completion",
    `${title} | Conclusione attesa | Pianificata`,
    expectedEnd,
    sprintStartDate,
    "Target atteso di chiusura del task.",
  );

  const syntheticCompletion = buildSyntheticEvent(
    `completion:${task.id}`,
    "completion",
    `${title} | Chiusura task | Completato`,
    actualEnd,
    sprintStartDate,
    "Task chiuso.",
  );

  const hasRealCompletion = taskEvents.some((event) => event.kind === "completion");
  const allEvents = sortEvents([
    ...taskEvents.map(e => e.systemCheckpointType === "expected-completion" ? ({ ...e, kind: "expected-completion" as any }) : e),
    ...(!hasRealCompletion && syntheticCompletion ? [syntheticCompletion] : []),
  ]);

  const ownerRef = extractAnagraficaId(task.data?.titolareTask);
  const referenteRef = extractAnagraficaId(task.data?.referenteTask);
  const ownerUserIds = visibilityContext
    ? resolveUserIdsByAnagraficaId(visibilityContext, ownerRef)
    : [];
  const referenteUserIds = visibilityContext
    ? resolveUserIdsByAnagraficaId(visibilityContext, referenteRef)
    : [];
  const ownerName =
    (ownerRef && referenceLabelMap?.[ownerRef]) ||
    undefined;
  const referenteName =
    (referenteRef && referenceLabelMap?.[referenteRef]) ||
    undefined;

  const lineEndIndex =
    syntheticCompletion?.dateIndex ??
    allEvents.slice(-1)[0]?.dateIndex ??
    0;

  const viewerIsOwner = visibilityContext
    ? viewerOwnsReference(visibilityContext, ownerRef) ||
      viewerMatchesResolvedUserIds(visibilityContext, ownerUserIds)
    : false;

  const viewerIsParticipant = taskEvents.some(
    (event) => event.viewerIsParticipant || event.viewerIsValidator,
  );

  const viewerIsReferente = visibilityContext
    ? viewerOwnsReference(visibilityContext, referenteRef) ||
      viewerMatchesResolvedUserIds(visibilityContext, referenteUserIds)
    : false;

  return {
    id: task.id,
    taskId: task.id,
    title,
    subtitle: asString(task.data?.capitoloTask),
    description: asString(task.data?.descrizioneTask),
    objectives: asString(task.data?.antologiaTask) || "",
    ownerName,
    ownerId: ownerRef,
    ownerUserIds,
    referenteName,
    referenteId: referenteRef,
    referenteUserIds,
    viewerCanManage: visibilityContext
      ? visibilityContext.isScrumMaster || viewerIsOwner || viewerIsReferente
      : true,
    viewerIsOwner,
    // true se il viewer è il revisore (referenteTask) del task,
    // distinto da viewerIsOwner per consentire una separazione di ruolo in UI
    viewerIsReferente,
    viewerIsParticipant,
    viewerVisibility: visibilityContext
      ? viewerIsOwner || viewerIsReferente
        ? "owned"
        : viewerIsParticipant
          ? "participating"
          : visibilityContext.auth.isAdmin
            ? "extended"
            : null
      : undefined,
    taskType: (asString(task.data?.ambitoTask) || "operations") as any,
    priority: ((asString(task.data?.prioritaTask) ||
      asString(task.data?.priority) ||
      "medium") as any),
    expectedEnd: dateOnly(expectedEnd),
    actualEnd: dateOnly(actualEnd),
    lineEndIndex,
    events: allEvents,
  };
}

function buildSprintTimelineBoard(args: {
  sprint: AulaDetail;
  tasks: SprintTimelineTaskRecord[];
  taskEventsByTaskId: Record<string, EventoPreview[]>;
  referenceLabelMap?: Record<string, string | null>;
  visibilityContext?: SprintTimelineVisibilityContext;
}): SprintTimelineBoardData {
  const { sprint, tasks, taskEventsByTaskId, referenceLabelMap, visibilityContext } = args;

  const sprintStartDate = normalizeIsoDate(
    asString(sprint.campi?.inizioSprint) ||
      asString((sprint.campi as any)?.startDate),
  );

  const sprintEndDate = normalizeIsoDate(
    asString(sprint.campi?.fineSprint) ||
      asString((sprint.campi as any)?.endDate),
  );

  const totalUnits = computeTotalUnits(sprintStartDate, sprintEndDate);

  const lanes = tasks.map((task) =>
    mapTaskToLane({
      task,
      sprintStartDate,
      events: taskEventsByTaskId[task.id] || [],
      referenceLabelMap,
      visibilityContext,
    }),
  );

  return {
    sprint: {
      id: sprint.id,
      label:
        asString(sprint.campi?.sprintLabel) ||
        asString((sprint as any).label) ||
        "Sprint",
      description: asString(sprint.campi?.descrizioneSprint),
      startDate: sprintStartDate,
      endDate: sprintEndDate,
      statoAvanzamento: asString(sprint.campi?.statoAvanzamento),
      valutazioneSprint: asString(sprint.campi?.valutazioneSprint),
    },
    totalUnits,
    segments: [
      {
        id: `segment:${sprint.id}`,
        label:
          asString(sprint.campi?.sprintLabel) ||
          asString((sprint as any).label) ||
          "Sprint",
        description: asString(sprint.campi?.descrizioneSprint),
        startIndex: 0,
        endIndex: totalUnits,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
      },
    ],
    lanes,
  };
}

function chunkValues<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function listSprintTimelineTasks(args: {
  taskIds: string[];
  auth: AuthContext;
}): Promise<SprintTimelineTaskRecord[]> {
  // Queriamo entrambi i formati (pulito e con prefisso) per massima robustezza
  const originalIds = Array.from(new Set(args.taskIds.filter(Boolean)));
  const cleanIds = originalIds.map(id => extractAnagraficaId(id)).filter((id): id is string => !!id);
  const queryIds = Array.from(new Set([...originalIds, ...cleanIds]));

  if (!queryIds.length) return [];

  const chunks = chunkValues(queryIds, 200);
  const results = await Promise.all(
    chunks.map((chunk) =>
      listAnagrafiche({
        type: TASK_ANAGRAFICA_TYPE,
        ids: chunk,
        fields: TIMELINE_TASK_FIELDS as any,
        limit: chunk.length,
        offset: 0,
        auth: args.auth,
      }),
    ),
  );

  const taskMap = new Map<string, SprintTimelineTaskRecord>();
  for (const result of results) {
    for (const item of result.items ?? []) {
      const cleanId = extractAnagraficaId(item.id);
      if (!cleanId) continue;
      taskMap.set(cleanId, {
        id: cleanId,
        data: item.data ?? {},
        visibilityRoles: item.visibilityRoles ?? [],
        updatedAt: item.updatedAt,
      });
    }
  }

  return originalIds
    .map((id) => taskMap.get(extractAnagraficaId(id) || id))
    .filter((item): item is SprintTimelineTaskRecord => !!item);
}

async function listSprintTimelineEventsByTask(args: {
  sprintId: string;
  taskIds: string[];
  auth: AuthContext;
}): Promise<{
  byTaskId: Record<string, EventoPreview[]>;
  items: EventoPreview[];
}> {
  const taskIds = new Set(args.taskIds.map(id => extractAnagraficaId(id)).filter((id): id is string => !!id));
  if (!taskIds.size) {
    return {
      byTaskId: {},
      items: [],
    };
  }

  const firstPage = await listEventi({
    type: TIMELINE_EVENT_TYPE,
    gruppoFilter: {
      gruppoType: SPRINT_AULA_TYPE,
      gruppoId: args.sprintId,
    },
    page: 1,
    pageSize: 200,
    includeData: true,
    includePartecipanti: true,
    includeGruppo: true,
    includeAllDay: true,
    auth: args.auth,
  });

  const totalPages = Math.max(
    1,
    Math.ceil((firstPage.total || 0) / Math.max(1, 200)),
  );

  const remainingPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            listEventi({
              type: TIMELINE_EVENT_TYPE,
              gruppoFilter: {
                gruppoType: SPRINT_AULA_TYPE,
                gruppoId: args.sprintId,
              },
              page: index + 2,
              pageSize: 200,
              includeData: true,
              includePartecipanti: true,
              includeGruppo: true,
              includeAllDay: true,
              auth: args.auth,
            }),
          ),
        )
      : [];

  const allItems = [firstPage, ...remainingPages].flatMap(
    (result) => result.items ?? [],
  );

  const grouped = new Map<string, EventoPreview[]>();

  for (const item of allItems) {
    const rawTaskId = item.partecipanti?.find(
      (partecipante) => partecipante.anagraficaType === TASK_ANAGRAFICA_TYPE,
    )?.anagraficaId;
    const taskId = extractAnagraficaId(rawTaskId);

    if (!taskId || !taskIds.has(taskId)) continue;

    const current = grouped.get(taskId) ?? [];
    current.push(item);
    grouped.set(taskId, current);
  }

  return {
    byTaskId: Object.fromEntries(grouped.entries()),
    items: allItems,
  };
}


export async function loadSprintTimelineBoard(args: {
  sprintId: string;
  auth: AuthContext;
}): Promise<SprintTimelineBoardData> {
  // Handle aggregate board specially to avoid ObjectId cast errors
  if (args.sprintId === "__aggregate__") {
    const { aggregateBoard } = await loadAggregateSprintTimelineBoard({ auth: args.auth });
    if (!aggregateBoard) {
      throw new Error("SPRINT_NOT_FOUND");
    }
    return aggregateBoard;
  }

  const sprint = await getAulaById({
    type: SPRINT_AULA_TYPE,
    id: args.sprintId,
  });

  if (!sprint) {
    throw new Error("SPRINT_NOT_FOUND");
  }

  const taskIds = Array.from(
    new Set(
      (sprint.partecipanti ?? [])
        .map((item) => item.anagraficaId)
        .filter((id): id is string => !!id),
    ),
  );

  const tasks = await listSprintTimelineTasks({
    taskIds,
    auth: args.auth,
  });

  const taskEvents = await listSprintTimelineEventsByTask({
    sprintId: args.sprintId,
    taskIds: tasks.map((task) => task.id),
    auth: args.auth,
  });

  const ownerIds = uniqueStrings(tasks.map(t => extractAnagraficaId(t.data?.titolareTask)));
  const referenteIds = uniqueStrings(tasks.map(t => extractAnagraficaId(t.data?.referenteTask)));

  const participantIdsFromEvents = uniqueStrings(
    taskEvents.items.flatMap((evento) => {
      const payload = getTimelinePayloadFromData(evento.data);
      return [...(payload.participants ?? []), ...(payload.validators ?? [])];
    })
  ).filter(id => mongoose.isValidObjectId(id));

  const actorNames = uniqueStrings(
    taskEvents.items.flatMap((evento) => {
      const payload = getTimelinePayloadFromData(evento.data);
      return [...(payload.participants ?? []), ...(payload.validators ?? [])];
    })
  ).filter(name => !mongoose.isValidObjectId(name));

  const [referenceLabelMap, visibilityContext] = await Promise.all([
    resolveAtlasReferenceLabels({
      requests: {
        titolareTask: ownerIds,
        referenteTask: referenteIds,
      },
      extraByType: {
        evolver: participantIdsFromEvents,
      },
      auth: args.auth,
    }),
    buildSprintTimelineVisibilityContext({
      auth: args.auth,
      referenceIds: uniqueStrings([...ownerIds, ...referenteIds, ...participantIdsFromEvents]),
      actorNames,
    }),
  ]);

  const referenceLabelMapAsDict: Record<string, string | null> = referenceLabelMap;

  return buildSprintTimelineBoard({
    sprint,
    tasks,
    taskEventsByTaskId: taskEvents.byTaskId,
    referenceLabelMap: referenceLabelMapAsDict,
    visibilityContext,
  });
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const raw = value.slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoStartOfDay(date: Date) {
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function toIsoEndOfDay(date: Date) {
  return `${date.toISOString().slice(0, 10)}T23:59:00.000Z`;
}

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function buildAggregateBoardFromBoards(
  boards: SprintTimelineBoardData[],
): SprintTimelineBoardData | null {
  if (!boards.length) return null;

  const datedBoards = boards
    .map((board) => {
      const start = parseDateOnly(board.sprint.startDate);
      const end = parseDateOnly(board.sprint.endDate);
      if (!start || !end) return null;
      return { board, start, end };
    })
    .filter(Boolean) as Array<{
    board: SprintTimelineBoardData;
    start: Date;
    end: Date;
  }>;

  if (!datedBoards.length) return null;

  const globalStart = datedBoards.reduce(
    (min, item) => (item.start.getTime() < min.getTime() ? item.start : min),
    datedBoards[0]!.start,
  );

  const globalEnd = datedBoards.reduce(
    (max, item) => (item.end.getTime() > max.getTime() ? item.end : max),
    datedBoards[0]!.end,
  );

  const totalUnits = Math.max(1, diffDays(globalStart, globalEnd) + 1);

  const segments: SprintTimelineSegment[] = datedBoards
    .map(({ board, start, end }) => ({
      id: `segment:${board.sprint.id}`,
      label: board.sprint.label,
      description: board.sprint.description,
      startIndex: diffDays(globalStart, start),
      endIndex: diffDays(globalStart, end) + 1,
      startDate: toIsoStartOfDay(start),
      endDate: toIsoEndOfDay(end),
    }))
    .sort((a, b) => a.startIndex - b.startIndex);

  const lanes: SprintTimelineLane[] = datedBoards.flatMap(({ board, start }) => {
    const offset = diffDays(globalStart, start);

    return board.lanes.map((lane) => ({
      ...lane,
      id: `${board.sprint.id}::${lane.id}`,
      sourceSprintId: board.sprint.id,
      sourceLaneId: lane.id,
      lineEndIndex:
        typeof lane.lineEndIndex === "number"
          ? lane.lineEndIndex + offset
          : lane.lineEndIndex,
      events: lane.events.map((event) => ({
        ...event,
        dateIndex: event.dateIndex + offset,
      })),
    }));
  });

  return {
    sprint: {
      id: "__aggregate__",
      label: "Sprint timeline",
      description: "Vista aggregata di tutte le sprint",
      startDate: toIsoStartOfDay(globalStart),
      endDate: toIsoEndOfDay(globalEnd),
    },
    totalUnits,
    segments,
    lanes,
  };
}

export async function loadAggregateSprintTimelineBoard(args: {
  auth: AuthContext;
}): Promise<{
  aggregateBoard: SprintTimelineBoardData | null;
  items: { sprintId: string; board: SprintTimelineBoardData }[];
  failures: { sprintId: string; error: string }[];
}> {
  const res = await listAuleByType({
    type: SPRINT_AULA_TYPE,
    page: 1,
    pageSize: 200,
    auth: args.auth,
  });

  const settled = await Promise.all(
    (res.items ?? []).map(async (item) => {
      try {
        const board = await loadSprintTimelineBoard({
          sprintId: item.id,
          auth: args.auth,
        });
        return {
          ok: true as const,
          sprintId: item.id,
          board,
        };
      } catch (error: any) {
        return {
          ok: false as const,
          sprintId: item.id,
          error: error?.message || "Errore caricando la sprint",
        };
      }
    }),
  );

  const items: { sprintId: string; board: SprintTimelineBoardData }[] = [];
  const failures: { sprintId: string; error: string }[] = [];

  for (const entry of settled) {
    if (entry.ok) {
      items.push({
        sprintId: entry.sprintId,
        board: entry.board,
      });
    } else {
      failures.push({
        sprintId: entry.sprintId,
        error: entry.error,
      });
    }
  }

  return {
    aggregateBoard: buildAggregateBoardFromBoards(items.map((item) => item.board)),
    items,
    failures,
  };
}
