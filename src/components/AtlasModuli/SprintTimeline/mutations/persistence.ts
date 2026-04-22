import {
  getAulaDetail,
  saveAulaApi,
} from "@/components/Store/services/auleService";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import { eventiService } from "@/components/Store/services/eventiService";
import type { AulaPartecipanteDetail } from "@/components/Store/models/aule";
import type {
  EventoFull,
  EventoPartecipanteView,
} from "@/components/Store/models/eventi";
import {
  buildTimelineEventData,
  getTimelinePayloadFromEvento,
  type TimelineChecklistItemCodec,
  type TimelinePayloadCodec,
} from "@/components/AtlasModuli/SprintTimeline/codecs/timelinePayload";
import {
  asString,
  buildEventDateFromUnitIndex,
  normalizeEventKind,
} from "@/components/AtlasModuli/SprintTimeline/mutations/domain";
import { resolveOwnerIdByName } from "@/components/AtlasModuli/SprintTimeline/joins/owners";
import {
  SPRINT_AULA_TYPE,
  TASK_ANAGRAFICA_TYPE,
  TIMELINE_EVENT_TYPE,
} from "@/components/AtlasModuli/SprintTimeline/constants";
import type { SprintTimelineEventKind } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import type { SprintTimelineParticipantReference } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

function buildTimelineTaskParticipant(taskId: string): EventoPartecipanteView {
  return {
    anagraficaType: TASK_ANAGRAFICA_TYPE,
    anagraficaId: ensureDbId(taskId),
    role: "task",
    status: "linked",
  };
}

function ensureDbId(id: string, opts?: { sprintIdHint?: string }): string {
  if (!id) return id;
  if (!id.includes("::")) return id;

  const parts = id.split("::").filter(Boolean);
  if (!parts.length) return id;

  const sprintHint = opts?.sprintIdHint;
  if (sprintHint) {
    const sprintParts = sprintHint.split("::").filter(Boolean);
    const sprintClean = sprintParts[sprintParts.length - 1];
    const withoutSprint = parts.filter((part) => part !== sprintClean);
    if (withoutSprint.length) {
      return withoutSprint[0];
    }
  }

  const [first, second] = parts;
  if (first && !/^[a-f0-9]{24}$/i.test(first) && second) return second;
  return parts[0];
}

export async function patchTaskData(
  taskId: string,
  partialData: Record<string, any>,
): Promise<void> {
  const cleanId = ensureDbId(taskId);
  const full = await anagraficheService.getOne({
    type: TASK_ANAGRAFICA_TYPE,
    id: cleanId,
  });

  await anagraficheService.update({
    type: TASK_ANAGRAFICA_TYPE,
    id: cleanId,
    data: {
      data: {
        ...(full.data ?? {}),
        ...partialData,
      },
    },
  });
}

export async function createTaskRecord(payload: {
  title: string;
  subtitle?: string;
  description?: string;
  objectives?: string;
  ownerId?: string;
  referenteId?: string;
  ownerName?: string;
  referenteName?: string;
  taskType?: string;
  priority?: string;
  expectedEnd?: string;
  actualEnd?: string | null;
  statoTask?: string;
}): Promise<string> {
  const finalOwnerId = payload.ownerId || (await resolveOwnerIdByName(payload.ownerName));
  const finalReferenteId = payload.referenteId || (await resolveOwnerIdByName(payload.referenteName));

  // Risoluzione nomi per denormalizzazione se mancano
  let ownerName = payload.ownerName;
  if (finalOwnerId && !ownerName) {
    const res = await anagraficheService.getOne({ type: "evolver", id: finalOwnerId }).catch(() => null);
    ownerName = res?.data?.nomeEvolver || "";
  }

  let referenteName = payload.referenteName;
  if (finalReferenteId && !referenteName) {
    const res = await anagraficheService.getOne({ type: "evolver", id: finalReferenteId }).catch(() => null);
    referenteName = res?.data?.nomeEvolver || "";
  }

  const res = await anagraficheService.create({
    type: TASK_ANAGRAFICA_TYPE,
    payload: {
      data: {
        titoloTask: payload.title,
        descrizioneTask: payload.description || "",
        capitoloTask: payload.subtitle || "",
        antologiaTask: payload.objectives || "",
        ambitoTask: payload.taskType || "operations",
        priority: payload.priority || "medium",
        prioritaTask: payload.priority || "medium",
        statoTask: payload.statoTask || "backlog",
        conclusioneAttesa: payload.expectedEnd || "",
        conclusioneEffettiva: payload.actualEnd || null,
        ...(finalOwnerId ? { titolareTask: finalOwnerId } : {}),
        ...(ownerName ? { titolareTaskNome: ownerName } : {}),
        ...(finalReferenteId ? { referenteTask: finalReferenteId } : {}),
        ...(referenteName ? { referenteTaskNome: referenteName } : {}),
      },
    },
  });

  return res.id;
}

export async function updateTaskRecord(
  taskId: string,
  payload: {
    title?: string;
    subtitle?: string;
    description?: string;
    objectives?: string;
    ownerId?: string;
    referenteId?: string;
    taskType?: string;
    priority?: string;
    expectedEnd?: string;
    actualEnd?: string | null;
    statoTask?: string;
  },
): Promise<void> {
  const cleanId = ensureDbId(taskId);
  const full = await anagraficheService.getOne({
    type: TASK_ANAGRAFICA_TYPE,
    id: cleanId,
  });

  // Risoluzione nomi se l'ID è cambiato o per sicurezza
  let ownerName = "";
  if (payload.ownerId) {
    const res = await anagraficheService.getOne({ type: "evolver", id: payload.ownerId }).catch(() => null);
    ownerName = res?.data?.nomeEvolver || "";
  }

  let referenteName = "";
  if (payload.referenteId) {
    const res = await anagraficheService.getOne({ type: "evolver", id: payload.referenteId }).catch(() => null);
    referenteName = res?.data?.nomeEvolver || "";
  }

  await anagraficheService.update({
    type: TASK_ANAGRAFICA_TYPE,
    id: cleanId,
    data: {
      data: {
        ...(full.data ?? {}),
        ...(payload.title ? { titoloTask: payload.title } : {}),
        ...(payload.subtitle ? { capitoloTask: payload.subtitle } : {}),
        ...(payload.description ? { descrizioneTask: payload.description } : {}),
        ...(payload.objectives ? { antologiaTask: payload.objectives } : {}),
        ...(payload.taskType ? { ambitoTask: payload.taskType } : {}),
        ...(payload.priority ? { priority: payload.priority, prioritaTask: payload.priority } : {}),
        ...(payload.expectedEnd ? { conclusioneAttesa: payload.expectedEnd } : {}),
        ...(payload.actualEnd !== undefined ? { conclusioneEffettiva: payload.actualEnd } : {}),
        ...(payload.statoTask ? { statoTask: payload.statoTask } : {}),
        ...(payload.ownerId ? { titolareTask: payload.ownerId } : {}),
        ...(ownerName ? { titolareTaskNome: ownerName } : {}),
        ...(payload.referenteId ? { referenteTask: payload.referenteId } : {}),
        ...(referenteName ? { referenteTaskNome: referenteName } : {}),
      },
    },
  });
}

export async function deleteTaskRecord(taskId: string): Promise<void> {
  const cleanId = ensureDbId(taskId);
  await anagraficheService.remove({
    type: TASK_ANAGRAFICA_TYPE,
    id: cleanId,
  });
}

export async function deleteTaskEvents(
  sprintId: string,
  taskId: string,
): Promise<void> {
  const cleanTaskId = ensureDbId(taskId);

  const events = await eventiService.list({
    type: TIMELINE_EVENT_TYPE,
    gruppoType: SPRINT_AULA_TYPE,
    gruppoId: sprintId,
    includePartecipanti: true,
    page: 1,
    pageSize: 1000,
  });

  const toRemove = (events.items ?? []).filter((e) =>
    (e.partecipanti ?? []).some(
      (p) => p.anagraficaType === TASK_ANAGRAFICA_TYPE && p.anagraficaId === cleanTaskId,
    ),
  );

  await Promise.all(
    toRemove.map((e) =>
      eventiService.remove({
        type: TIMELINE_EVENT_TYPE,
        id: e.id,
      }),
    ),
  );
}

export async function getTimelineEventFull(eventId: string): Promise<EventoFull> {
  return eventiService.getOne({
    type: TIMELINE_EVENT_TYPE,
    id: eventId,
  });
}

export async function createTimelineEventRecord(args: {
  sprintId?: string;
  taskId: string;
  kind: SprintTimelineEventKind;
  title: string;
  note?: string;
  sprintStartDate?: string;
  unitIndex: number;
  date?: string;
  time?: string;
  chainId?: string;
  sourceEventId?: string;
  createdByValidationId?: string;
  participants?: SprintTimelineParticipantReference[];
  validators?: SprintTimelineParticipantReference[];
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
  stato?: string;
  priorita?: string;
}) {
  const startAt = args.date || buildEventDateFromUnitIndex(
    args.sprintStartDate,
    args.unitIndex,
    args.time || "09:00:00",
  );
  const endAt = startAt;

  const timelinePayload: TimelinePayloadCodec = {
    kind: args.kind,
    chainId: args.chainId,
    sourceEventId: args.sourceEventId,
    createdByValidationId: args.createdByValidationId,
    participants: args.participants?.map(p => p.anagraficaId), // Fallback per legacy/compat
    validators: args.validators?.map(v => v.anagraficaId),
    checklist: args.checklist,
    validationState: args.validationState,
    validationResult: args.validationResult,
    decisionLocked: args.decisionLocked,
    decidedBy: args.decidedBy,
    decidedAt: args.decidedAt,
    decisionNote: args.decisionNote,
    completionDays: args.completionDays,
    delayDays: args.delayDays,
    color: args.color,
  };

  const nextPartecipanti: EventoPartecipanteView[] = [
    buildTimelineTaskParticipant(args.taskId),
  ];

  for (const p of args.participants ?? []) {
    nextPartecipanti.push({
      anagraficaType: p.anagraficaType || "evolver",
      anagraficaId: ensureDbId(p.anagraficaId),
      role: "participant",
      status: "linked",
    });
  }

  for (const v of args.validators ?? []) {
    nextPartecipanti.push({
      anagraficaType: v.anagraficaType || "evolver",
      anagraficaId: ensureDbId(v.anagraficaId),
      role: "validator",
      status: "linked",
    });
  }

  return eventiService.create({
    type: TIMELINE_EVENT_TYPE,
    payload: {
      timeKind: "point",
      startAt,
      endAt,
      anagraficaType: TASK_ANAGRAFICA_TYPE,
      anagraficaId: ensureDbId(args.taskId),
      partecipanti: nextPartecipanti,
      ...(args.sprintId
        ? {
          gruppo: {
            gruppoType: SPRINT_AULA_TYPE,
            gruppoId: ensureDbId(args.sprintId),
          },
        }
        : {}),
      data: buildTimelineEventData({
        title: args.title,
        note: args.note,
        stato: args.stato,
        priorita: args.priorita,
        payload: timelinePayload,
      }),
    },
  });
}

export async function updateTimelineEventRecord(args: {
  eventId: string;
  patchData?: Record<string, any>;
  patchPayload?: Partial<TimelinePayloadCodec>;
  participants?: SprintTimelineParticipantReference[];
  validators?: SprintTimelineParticipantReference[];
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;
}) {
  const full = await getTimelineEventFull(args.eventId);
  const currentPayload = getTimelinePayloadFromEvento(full);

  const nextPayload: TimelinePayloadCodec = {
    ...currentPayload,
    ...(args.patchPayload ?? {}),
    kind: normalizeEventKind(
      args.patchPayload?.kind || currentPayload.kind,
    ),
  };

  const nextPartecipanti: EventoPartecipanteView[] = [...(full.partecipanti ?? [])];

  if (args.participants !== undefined) {
    // Rimuove vecchi partecipanti umani (evolver/clienti/fornitori/etc.) con ruolo 'participant'
    const filtered = nextPartecipanti.filter(
      (p) => p.role !== "participant" || p.anagraficaType === TASK_ANAGRAFICA_TYPE,
    );
    nextPartecipanti.length = 0;
    nextPartecipanti.push(...filtered);

    for (const p of args.participants) {
      nextPartecipanti.push({
        anagraficaType: p.anagraficaType || "evolver",
        anagraficaId: ensureDbId(p.anagraficaId),
        role: "participant",
        status: "linked",
      });
    }
  }

  if (args.validators !== undefined) {
    // Rimuove vecchi validatori umani con ruolo 'validator'
    const filtered = nextPartecipanti.filter((p) => p.role !== "validator");
    nextPartecipanti.length = 0;
    nextPartecipanti.push(...filtered);

    for (const v of args.validators) {
      nextPartecipanti.push({
        anagraficaType: v.anagraficaType || "evolver",
        anagraficaId: ensureDbId(v.anagraficaId),
        role: "validator",
        status: "linked",
      });
    }
  }

  const nextTitle =
    asString(args.patchData?.titolo) ||
    asString(full.data?.titolo) ||
    "Evento";

  const nextNote =
    asString(args.patchData?.descrizione) ??
    asString(full.data?.descrizione) ??
    "";

  const nextStato =
    asString(args.patchData?.stato) ||
    asString(full.data?.stato) ||
    "programmato";

  const nextPriorita =
    asString(args.patchData?.priorita) ||
    asString(full.data?.priorita) ||
    "normal";

  const nextStartAt =
    args.startAt !== undefined ? args.startAt : full.startAt;
  const nextEndAt =
    args.endAt !== undefined
      ? args.endAt
      : (full.timeKind || "point") === "point" && args.startAt !== undefined
        ? args.startAt
        : full.endAt;

  await eventiService.update({
    type: TIMELINE_EVENT_TYPE,
    id: args.eventId,
    data: {
      timeKind: full.timeKind || "point",
      startAt: nextStartAt,
      endAt: nextEndAt,
      allDay: args.allDay !== undefined ? args.allDay : full.allDay,
      recurrence: full.recurrence,
      gruppo: full.gruppo,
      partecipanti: nextPartecipanti,
      visibilityRole: full.visibilityRole,
      data: {
        ...(full.data ?? {}),
        ...(args.patchData ?? {}),
        ...buildTimelineEventData({
          title: nextTitle,
          note: nextNote,
          stato: nextStato,
          priorita: nextPriorita,
          payload: nextPayload,
        }),
      },
    },
  });
}

export async function deleteTimelineEventRecord(eventId: string) {
  await eventiService.remove({
    type: TIMELINE_EVENT_TYPE,
    id: eventId,
  });
}

export async function attachTaskToSprint(
  sprintId: string,
  taskId: string,
): Promise<void> {
  const cleanSprintId = ensureDbId(sprintId);
  const sprint = await getAulaDetail({
    type: SPRINT_AULA_TYPE,
    id: cleanSprintId,
  });

  const cleanTaskId = ensureDbId(taskId);

  // Verifichiamo la presenza usando l'ID pulito per evitare duplicati (task::123 vs 123)
  const alreadyThere = (sprint.partecipanti ?? []).some(
    (item) => ensureDbId(item.anagraficaId) === cleanTaskId,
  );

  if (alreadyThere) return;

  const nextPartecipanti: AulaPartecipanteDetail[] = [
    ...(sprint.partecipanti ?? []),
    {
      anagraficaId: taskId, // Usiamo l'ID così come arriva (potenzialmente con prefisso)
      joinedAt: new Date().toISOString(),
      dati: {},
    },
  ];

  await saveAulaApi({
    type: SPRINT_AULA_TYPE,
    id: cleanSprintId,
    campi: sprint.campi ?? {},
    partecipanti: nextPartecipanti,
    visibilityRole: (sprint as any).visibilityRole ?? null,
  });
}
