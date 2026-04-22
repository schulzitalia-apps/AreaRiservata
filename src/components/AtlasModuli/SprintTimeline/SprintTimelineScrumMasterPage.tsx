"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Select from "@/components/ui/select";
import type {
  SprintTaskPriority,
  SprintTaskType,
  SprintTimelineBoardData,
  SprintTimelineCreateTaskPayload,
  SprintTimelineLane,
  SprintTimelineMilestoneDraft,
  SprintTimelineSegment,
  SprintTimelineSelection,
} from "./SprintTimeline.types";
import {
  deriveLaneState,
  formatDateOnly,
  getIsoDateForUnitIndex,
  getPriorityMeta,
  getSemaforoDotClasses,
  getSignalLabel,
  getTaskTypeLabel,
  TASK_TYPE_OPTIONS,
  getLaneEffectiveEndIndex,
  getLaneFirstRelevantIndex,
} from "./SprintTimeline.helpers";
import type { SprintTimelineViewer } from "./permissions";
import { User } from "lucide-react";
import { SprintTimelineCreateTaskModal } from "./SprintTimelineCreateTaskModal";
import { SprintTimelineSprintContributions } from "./SprintTimelineSprintContributions";
import {
  SprintTimelineCreateSprintModal,
  type SprintTimelineCreateSprintPayload,
} from "./SprintTimelineCreateSprintModal";

function isBacklogLane(lane: SprintTimelineLane) {
  return !lane.events?.length;
}

function getCurrentSegment(
  segments: SprintTimelineSegment[],
  todayIndex: number,
): SprintTimelineSegment | null {
  return (
    segments.find(
      (segment) => todayIndex >= segment.startIndex && todayIndex < segment.endIndex,
    ) ?? null
  );
}

function getSegmentTimeState(
  segment: SprintTimelineSegment,
  todayIndex: number,
): "past" | "present" | "future" {
  if (todayIndex < segment.startIndex) return "future";
  if (todayIndex >= segment.endIndex) return "past";
  return "present";
}

function isLaneInSegment(lane: SprintTimelineLane, segment: SprintTimelineSegment, totalUnits: number) {
  const start = getLaneFirstRelevantIndex(lane);
  const end = getLaneEffectiveEndIndex(lane, totalUnits);

  return start < segment.endIndex && end >= segment.startIndex;
}

type ScrumColumnKey =
  | "backlog"
  | "gray"
  | "blue"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "green"
  | "teal";

function getColumnKeyForLane(
  lane: SprintTimelineLane,
  todayIndex: number,
  viewer?: SprintTimelineViewer,
): ScrumColumnKey {
  if (isBacklogLane(lane)) return "backlog";

  const derived = deriveLaneState(lane, todayIndex, viewer);
  switch (derived.signal) {
    case "gray":
      return "gray";
    case "blue":
      return "blue";
    case "yellow":
      return "yellow";
    case "orange":
      return "orange";
    case "red":
      return "red";
    case "purple":
      return "purple";
    case "green":
      return "green";
    case "teal":
      return "teal";
    default:
      return "blue";
  }
}

function getTaskTypeFilterOptions() {
  return TASK_TYPE_OPTIONS.filter((option) => option.value);
}

function getBoardMaxSelectableDate(data: SprintTimelineBoardData): string | undefined {
  const sprintEnd = data.sprint.endDate?.slice(0, 10);

  const segmentMax = data.segments
    .map((segment) => segment.endDate?.slice(0, 10))
    .filter(Boolean)
    .sort()
    .slice(-1)[0];

  const totalUnitsMax =
    data.totalUnits > 0
      ? getIsoDateForUnitIndex(data.sprint.startDate?.slice(0, 10), data.totalUnits - 1)
      : undefined;

  return [sprintEnd, segmentMax, totalUnitsMax].filter(Boolean).sort().slice(-1)[0];
}

export function SprintTimelineScrumMasterPage({
  data,
  todayIndex,
  currentUserId,
  selection,
  onSelectionChange,
  onClose,
  onCreateSprint,
  onCreateFullTask,
  onEditTask,
  onDeleteTask,
  onPromoteBacklogTask,
  onSegmentChange,
}: {
  data: SprintTimelineBoardData;
  todayIndex: number;
  /** ID utente autenticato, usato per filtrare la vista personale */
  currentUserId?: string;
  selection: SprintTimelineSelection;
  onSelectionChange: (next: SprintTimelineSelection) => void;
  onClose: () => void;
  onCreateSprint: (payload: SprintTimelineCreateSprintPayload) => void;
  onCreateFullTask: () => void;
  onEditTask: (laneId: string) => void;
  onDeleteTask: (laneId: string) => void;
  onPromoteBacklogTask: (laneId: string) => void;
  /** Notifica al genitore quando cambia il segmento selezionato (sprint) */
  onSegmentChange?: (segmentId: string | null) => void;
}) {
  const currentSegment = useMemo(
    () => getCurrentSegment(data.segments, todayIndex),
    [data.segments, todayIndex],
  );

  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    currentSegment?.id ?? data.segments[0]?.id ?? "",
  );
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [expandedColumn, setExpandedColumn] = useState<ScrumColumnKey | null>(null);

  const viewer = useMemo<SprintTimelineViewer>(() => ({
    userId: currentUserId,
    isElevated: true, // In questa pagina siamo in modalità Scrum Master
  }), [currentUserId]);

  useEffect(() => {
    const nextCurrentSegment = getCurrentSegment(data.segments, todayIndex);
    const fallbackId = nextCurrentSegment?.id ?? data.segments[0]?.id ?? "";
    const effectiveId = selectedSegmentId || fallbackId;
    if (effectiveId !== selectedSegmentId) {
      setSelectedSegmentId(effectiveId);
    }
  }, [data.segments, todayIndex, selectedSegmentId]);

  useEffect(() => {
    onSegmentChange?.(selectedSegmentId || null);
  }, [selectedSegmentId, onSegmentChange]);

  const selectedSegment = useMemo(
    () => data.segments.find((segment) => segment.id === selectedSegmentId) ?? null,
    [data.segments, selectedSegmentId],
  );

  const selectedSegmentTimeState = useMemo(() => {
    if (!selectedSegment) return null;
    return getSegmentTimeState(selectedSegment, todayIndex);
  }, [selectedSegment, todayIndex]);

  const visibleLanes = useMemo(() => {
    // Filtro base: segmento selezionato e tipo task
    const inSegment = data.lanes.filter((lane) => {
      if (isBacklogLane(lane)) return true;
      if (taskTypeFilter && lane.taskType !== taskTypeFilter) return false;
      if (!selectedSegment) return false;
      return isLaneInSegment(lane, selectedSegment, data.totalUnits);
    });

    // Filtro owner
    const filteredByOwner = ownerFilter
      ? inSegment.filter((lane) =>
          lane.ownerName === ownerFilter || lane.referenteName === ownerFilter,
        )
      : inSegment;

    // Ordinamento significativo (solo per lane non-backlog)
    return [...filteredByOwner].sort((a, b) => {
      // Il backlog va sempre in fondo
      const aIsBacklog = isBacklogLane(a);
      const bIsBacklog = isBacklogLane(b);
      if (aIsBacklog && !bIsBacklog) return 1;
      if (!aIsBacklog && bIsBacklog) return -1;
      if (aIsBacklog && bIsBacklog) return 0;

      // Gruppo A: ho checkpoint/blocchi/validazioni attivi su questa lane
      const aHasMyCheckpoint = a.events.some((event) => event.viewerCanAct);
      const bHasMyCheckpoint = b.events.some((event) => event.viewerCanAct);
      const aGroupA = aHasMyCheckpoint ? 0 : 1;
      const bGroupA = bHasMyCheckpoint ? 0 : 1;
      if (aGroupA !== bGroupA) return aGroupA - bGroupA;

      // All'interno del gruppo A: task scaduti prima
      if (aGroupA === 0) {
        const aExpired = (a.lineEndIndex ?? Infinity) < todayIndex ? 0 : 1;
        const bExpired = (b.lineEndIndex ?? Infinity) < todayIndex ? 0 : 1;
        if (aExpired !== bExpired) return aExpired - bExpired;
      }

      // Priorità: urgent(0) > high(1) > medium(2) > low(3)
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority ?? "medium"] ?? 2;
      const bPriority = priorityOrder[b.priority ?? "medium"] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Chiusura attesa ASC
      return (a.lineEndIndex ?? 9999) - (b.lineEndIndex ?? 9999);
    });
  }, [data.lanes, selectedSegment, taskTypeFilter, ownerFilter, todayIndex]);




  const boardMaxSelectableDate = useMemo(
    () => getBoardMaxSelectableDate(data),
    [data],
  );

  const columns = useMemo(() => {
    const result: Record<ScrumColumnKey, SprintTimelineLane[]> = {
      backlog: [],
      gray: [],
      blue: [],
      yellow: [],
      orange: [],
      red: [],
      purple: [],
      green: [],
      teal: [],
    };

    visibleLanes.forEach((lane) => {
      result[getColumnKeyForLane(lane, todayIndex, viewer)].push(lane);
    });

    return result;
  }, [visibleLanes, todayIndex]);

  const taskTypeOptions = useMemo(() => getTaskTypeFilterOptions(), []);

  const sprintSelectOptions = useMemo(
    () =>
      data.segments.map((segment) => {
        const state = getSegmentTimeState(segment, todayIndex);
        const suffix =
          state === "present"
            ? " · Presente"
            : state === "past"
              ? " · Passato"
              : " · Futuro";

        return {
          value: segment.id,
          label: `${segment.label}${suffix}`,
        };
      }),
    [data.segments, todayIndex],
  );

  const taskTypeSelectOptions = useMemo(
    () => [
      { value: "", label: "Tutti i tipi" },
      ...taskTypeOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ],
    [taskTypeOptions],
  );

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>(); // name -> value
    data.lanes.forEach((lane) => {
      if (lane.ownerName) owners.set(lane.ownerName, lane.ownerName);
      if (lane.referenteName) owners.set(lane.referenteName, lane.referenteName);
    });
    return [
      { value: "", label: "Tutti gli owner" },
      ...Array.from(owners.keys())
        .sort()
        .map((owner) => ({
          value: owner,
          label: owner,
        })),
    ];
  }, [data.lanes]);

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-primary/15 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
              Scrum master
            </div>

            <h2 className="mt-1 text-2xl font-semibold text-dark dark:text-white">
              Board sprint
            </h2>

            <p className="mt-2 text-sm text-dark/60 dark:text-white/60">
              Vista Scrum Master: hai i permessi di gestione su tutti i task.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={() => setSprintModalOpen(true)}
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                "border-primary/20 bg-primary text-white hover:brightness-110",
                "dark:border-primary/30 dark:bg-primary dark:text-white",
              )}
            >
              + Nuovo sprint
            </button>

            <button
              type="button"
              onClick={onCreateFullTask}
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                "border-primary/20 bg-primary text-white hover:brightness-110",
                "dark:border-primary/30 dark:bg-primary dark:text-white",
              )}
            >
              + Nuovo task sprint
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stroke bg-white/70 px-3 py-2 text-sm text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/60 dark:text-white"
            >
              Torna timeline
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[320px_220px_220px_1fr]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
              Sprint selezionato
            </div>

            <Select
              value={selectedSegmentId}
              onChange={(value) => setSelectedSegmentId(value)}
              options={sprintSelectOptions}
              placeholder="Seleziona sprint"
            />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
              Filtro tipo task
            </div>

            <Select
              value={taskTypeFilter}
              onChange={(value) => setTaskTypeFilter(value)}
              options={taskTypeSelectOptions}
              placeholder="Tutti i tipi"
            />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
              Filtro Owner
            </div>

            <Select
              value={ownerFilter}
              onChange={(value) => setOwnerFilter(value)}
              options={ownerOptions}
              placeholder="Tutti gli owner"
            />
          </div>

          {selectedSegment ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-sm text-dark/70 dark:text-white/70">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-dark dark:text-white">
                  {selectedSegment.label}
                </span>

                {selectedSegmentTimeState ? (
                  <span
                    className={clsx(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      selectedSegmentTimeState === "present"
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : selectedSegmentTimeState === "past"
                          ? "border-slate-400/20 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                          : "border-sky-400/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                    )}
                  >
                    {selectedSegmentTimeState === "present"
                      ? "Presente"
                      : selectedSegmentTimeState === "past"
                        ? "Passato"
                        : "Futuro"}
                  </span>
                ) : null}
              </div>

              <div className="mt-2">
                {formatDateOnly(selectedSegment.startDate)}
                {" → "}
                {formatDateOnly(selectedSegment.endDate)}
              </div>

              {selectedSegment.description ? (
                <div className="mt-1">{selectedSegment.description}</div>
              ) : null}

              {boardMaxSelectableDate ? (
                <div className="mt-2 text-xs text-dark/55 dark:text-white/55">
                  Chiusura attesa selezionabile fino al {formatDateOnly(boardMaxSelectableDate)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-auto">
        <div className="flex min-w-[2920px] gap-4">
          <ScrumColumn
            columnKey="backlog"
            title="BACKLOG"
            subtitle="Task non ancora portati nello sprint"
            lanes={columns.backlog}
            emptyText="Nessun task nel backlog."
            expanded={expandedColumn === "backlog"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "backlog" ? null : "backlog"))
            }
            renderCard={(lane) => (
              <BacklogCard
                key={lane.id}
                lane={lane}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onPromote={() => onPromoteBacklogTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="gray"
            title="PIANIFICATO"
            subtitle="Task creati ma non ancora partiti"
            lanes={columns.gray}
            emptyText="Nessun task pianificato."
            expanded={expandedColumn === "gray"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "gray" ? null : "gray"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="blue"
            title="IN ESECUZIONE"
            subtitle="Task attivi nello sprint"
            lanes={columns.blue}
            emptyText="Nessun task in esecuzione."
            expanded={expandedColumn === "blue"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "blue" ? null : "blue"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="yellow"
            title="CHECKPOINT APERTI"
            subtitle="Task con checkpoint operativi aperti"
            lanes={columns.yellow}
            emptyText="Nessun task con checkpoint aperti."
            expanded={expandedColumn === "yellow"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "yellow" ? null : "yellow"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="orange"
            title="A RISCHIO"
            subtitle="Task in ritardo o sotto pressione"
            lanes={columns.orange}
            emptyText="Nessun task a rischio."
            expanded={expandedColumn === "orange"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "orange" ? null : "orange"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="red"
            title="BLOCCATO"
            subtitle="Task bloccati nello sprint"
            lanes={columns.red}
            emptyText="Nessun task bloccato."
            expanded={expandedColumn === "red"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "red" ? null : "red"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="purple"
            title="ACCETTAZIONE"
            subtitle="Task in validazione / approvazione"
            lanes={columns.purple}
            emptyText="Nessun task in approvazione."
            expanded={expandedColumn === "purple"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "purple" ? null : "purple"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="teal"
            title="INFORMATIVO"
            subtitle="Lane note-driven o di coordinamento"
            lanes={columns.teal}
            emptyText="Nessuna lane informativa."
            expanded={expandedColumn === "teal"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "teal" ? null : "teal"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />

          <ScrumColumn
            columnKey="green"
            title="CONCLUSO"
            subtitle="Task chiusi nello sprint selezionato"
            lanes={columns.green}
            emptyText="Nessun task concluso."
            expanded={expandedColumn === "green"}
            onToggleExpanded={() =>
              setExpandedColumn((current) => (current === "green" ? null : "green"))
            }
            renderCard={(lane) => (
              <SprintLaneCard
                key={lane.id}
                lane={lane}
                todayIndex={todayIndex}
                isSelected={selection?.laneId === lane.id}
                onClick={() => onSelectionChange({ kind: "lane", laneId: lane.id })}
                onEditTask={() => onEditTask(lane.id)}
              />
            )}
          />
        </div>
      </div>

      <SprintTimelineSprintContributions
        data={data}
        selectedSegment={selectedSegment}
      />

      <SprintTimelineCreateSprintModal
        open={sprintModalOpen}
        onClose={() => setSprintModalOpen(false)}
        onSave={onCreateSprint}
      />
    </div>
  );
}

function ScrumColumn({
                       columnKey,
                       title,
                       subtitle,
                       lanes,
                       emptyText,
                       expanded,
                       onToggleExpanded,
                       renderCard,
                     }: {
  columnKey: ScrumColumnKey;
  title: string;
  subtitle: string;
  lanes: SprintTimelineLane[];
  emptyText: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  renderCard: (lane: SprintTimelineLane) => React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "shrink-0 rounded-[26px] border border-primary/15 bg-white/70 p-4 shadow-sm backdrop-blur transition-[width] duration-200 dark:border-dark-3 dark:bg-gray-dark/40",
        expanded ? "w-[420px]" : "w-[320px]",
      )}
      data-column={columnKey}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-dark dark:text-white">{title}</div>
          <div className="mt-1 text-sm text-dark/60 dark:text-white/60">{subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            {lanes.length}
          </span>

          <button
            type="button"
            onClick={onToggleExpanded}
            className="rounded-full border border-primary/15 bg-white/70 px-3 py-1 text-[11px] font-semibold text-dark transition hover:bg-primary/10 dark:bg-gray-dark/60 dark:text-white"
          >
            {expanded ? "Compatta" : "Espandi"}
          </button>
        </div>
      </div>

      <div
        className={clsx(
          "mt-4 space-y-3 overflow-y-auto pr-1",
          expanded ? "max-h-none" : "max-h-[72vh]",
        )}
      >
        {lanes.length ? (
          lanes.map(renderCard)
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/45 bg-transparent px-4 py-6 text-sm text-dark/55 dark:text-white/55">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

function BacklogCard({
                       lane,
                       isSelected,
                       onClick,
                       onPromote,
                     }: {
  lane: SprintTimelineLane;
  isSelected: boolean;
  onClick: () => void;
  onPromote: () => void;
}) {
  const priorityMeta = getPriorityMeta(lane.priority);

  return (
    <div
      onClick={onClick}
      className={clsx(
        "cursor-pointer rounded-[22px] border p-4 shadow-sm transition-all duration-200",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary dark:border-red-400 dark:bg-red-400/5 dark:ring-red-400"
          : "border-stroke bg-white/80 hover:border-primary/40 dark:border-dark-3 dark:bg-gray-dark/50 dark:hover:border-red-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-dark dark:text-white">
            {lane.title}
          </div>

          {lane.description ? (
            <div className="mt-2 text-sm text-dark/70 dark:text-white/70 line-clamp-2">
              {lane.description}
            </div>
          ) : null}
        </div>

        <span
          className={clsx(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            priorityMeta.surfaceClass,
          )}
        >
          {priorityMeta.label}
        </span>
      </div>

      {lane.viewerCanManage ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPromote();
            }}
            className="rounded-xl border border-primary/20 bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Porta nello sprint
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SprintLaneCard({
                          lane,
                          todayIndex,
                          isSelected,
                          onClick,
                          onEditTask,
                        }: {
  lane: SprintTimelineLane;
  todayIndex: number;
  isSelected?: boolean;
  onClick?: () => void;
  onEditTask?: () => void;
}) {
  const derived = deriveLaneState(lane, todayIndex, { userId: lane.ownerId, isElevated: true }); // Mock viewer per la card master
  const priorityMeta = getPriorityMeta(lane.priority);

  // Azione richiesta se c'è almeno un evento (checkpoint/validazione) in cui il viewer deve agire
  const actionRequired = lane.events.some((e) => e.viewerCanAct);

  return (
    <div
      onClick={onClick}
      className={clsx(
        "group cursor-pointer rounded-[22px] border p-4 shadow-sm transition-all duration-200",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary dark:border-red-400 dark:bg-red-400/5 dark:ring-red-400"
          : "border-stroke bg-white/80 hover:border-primary/40 dark:border-dark-3 dark:bg-gray-dark/50 dark:hover:border-red-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={clsx("h-3 w-3 rounded-full", getSemaforoDotClasses(derived.signal))}
            />
            <div className="text-base font-semibold text-dark dark:text-white truncate">
              {lane.title}
            </div>
          </div>

          {lane.subtitle ? (
            <div className="mt-2 text-sm text-dark/60 dark:text-white/60 line-clamp-1">
              {lane.subtitle}
            </div>
          ) : null}
        </div>

        <span
          className={clsx(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold shrink-0",
            priorityMeta.surfaceClass,
          )}
        >
          {priorityMeta.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          {getSignalLabel(derived.signal)}
        </span>

        {derived.daysRemaining !== null && (
          <span className="text-[11px] font-medium text-dark/45 dark:text-white/45 italic">
            {derived.daysRemaining > 0 
               ? `${derived.daysRemaining} gg piaz.` 
               : derived.daysRemaining === 0 
                 ? "scadenza oggi" 
                 : `ritardo ${Math.abs(derived.daysRemaining)} gg`}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {lane.ownerName ? (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
            <User className="h-3 w-3" />
            <span>{lane.ownerName}</span>
          </div>
        ) : null}

        {lane.referenteName && lane.referenteName !== lane.ownerName ? (
          <div className="flex items-center gap-1.5 rounded-full border border-sky-500/15 bg-sky-500/5 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
            <User className="h-3 w-3 opacity-70" />
            <span>{lane.referenteName}</span>
          </div>
        ) : null}
      </div>

      {lane.viewerCanManage && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditTask) onEditTask();
            }}
            className="rounded-lg border border-primary/20 bg-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110"
          >
            Gestione task
          </button>
        </div>
      )}
    </div>
  );
}
