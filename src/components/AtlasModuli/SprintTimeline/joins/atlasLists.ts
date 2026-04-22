"use client";

import type {
  AnagraficaFull,
  AnagraficaPreview,
} from "@/components/Store/models/anagrafiche";
import type {
  EventoFull,
  EventoPreview,
} from "@/components/Store/models/eventi";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import { eventiService } from "@/components/Store/services/eventiService";
import {
  SPRINT_AULA_TYPE,
  TASK_ANAGRAFICA_TYPE,
  TIMELINE_EVENT_TYPE,
} from "@/components/AtlasModuli/SprintTimeline/constants";

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

function chunkValues<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function mapTaskPreviewToFull(task: AnagraficaPreview): AnagraficaFull {
  return {
    id: task.id,
    data: task.data ?? {},
    visibilityRoles: task.visibilityRoles ?? [],
    updatedAt: task.updatedAt,
  };
}

function mapEventPreviewToFull(evento: EventoPreview): EventoFull {
  return {
    id: evento.id,
    data: evento.data ?? {},
    timeKind: evento.timeKind,
    startAt: evento.startAt ?? null,
    endAt: evento.endAt ?? null,
    allDay: evento.allDay,
    gruppo: evento.gruppo ?? null,
    partecipanti: evento.partecipanti ?? [],
    visibilityRole: evento.visibilityRole ?? null,
    updatedAt: evento.updatedAt,
    _autoEvent: evento._autoEvent ?? null,
  };
}

function getTaskIdFromEvento(evento: EventoFull): string | undefined {
  return evento.partecipanti.find(
    (item) => item.anagraficaType === TASK_ANAGRAFICA_TYPE,
  )?.anagraficaId;
}

export async function listSprintTimelineTasks(
  taskIds: string[],
): Promise<AnagraficaFull[]> {
  const ids = Array.from(new Set(taskIds.filter(Boolean)));
  if (!ids.length) return [];

  const chunks = chunkValues(ids, 200);

  const results = await Promise.all(
    chunks.map((chunk) =>
      anagraficheService.list({
        type: TASK_ANAGRAFICA_TYPE,
        ids: chunk,
        page: 1,
        pageSize: chunk.length,
        fields: TIMELINE_TASK_FIELDS,
      }),
    ),
  );

  const taskMap = new Map<string, AnagraficaFull>();
  for (const result of results) {
    for (const item of result.items ?? []) {
      taskMap.set(item.id, mapTaskPreviewToFull(item));
    }
  }

  return ids
    .map((id) => taskMap.get(id))
    .filter((item): item is AnagraficaFull => !!item);
}

async function listTimelineEventsPage(args: {
  sprintId: string;
  page: number;
  pageSize: number;
}) {
  return eventiService.list({
    type: TIMELINE_EVENT_TYPE,
    gruppoType: SPRINT_AULA_TYPE,
    gruppoId: args.sprintId,
    page: args.page,
    pageSize: args.pageSize,
    includeData: true,
    includePartecipanti: true,
    includeGruppo: true,
    includeAllDay: true,
  });
}

export async function listSprintTimelineEventsByTask(args: {
  sprintId: string;
  taskIds: string[];
}): Promise<Record<string, EventoFull[]>> {
  const taskIds = new Set(args.taskIds.filter(Boolean));
  if (!taskIds.size) return {};

  const firstPage = await listTimelineEventsPage({
    sprintId: args.sprintId,
    page: 1,
    pageSize: 200,
  });

  const totalPages = Math.max(
    1,
    Math.ceil((firstPage.total || 0) / Math.max(firstPage.pageSize || 200, 1)),
  );

  const remainingPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            listTimelineEventsPage({
              sprintId: args.sprintId,
              page: index + 2,
              pageSize: firstPage.pageSize || 200,
            }),
          ),
        )
      : [];

  const allItems = [firstPage, ...remainingPages].flatMap(
    (result) => result.items ?? [],
  );

  const grouped = new Map<string, EventoFull[]>();

  for (const item of allItems) {
    const full = mapEventPreviewToFull(item);
    const taskId = getTaskIdFromEvento(full);
    if (!taskId || !taskIds.has(taskId)) continue;

    const current = grouped.get(taskId) ?? [];
    current.push(full);
    grouped.set(taskId, current);
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([taskId, items]) => [taskId, items]),
  );
}
