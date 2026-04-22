"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type {
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineSelection,
} from "./SprintTimeline.types";
import {
  deriveLaneState,
  formatDateOnly,
  formatDateTime,
  formatElapsedDays,
  getChecklistProgress,
  getCheckpointChainStatus,
  getEventChainId,
  getEventDisplaySignal,
  getEventKindLabel,
  getLaneChainEvents,
  getSelectedEvent,
  getSelectedLane,
  getSemaforoAccentClass,
  getSemaforoDotClasses,
  getSemaforoSurfaceClasses,
  getSignalLabel,
  getTaskTypeLabel,
  getValidationStatusLabel,
  isCheckpointBlockReadyForResolution,
  isCheckpointReadyForCompletion,
  isTaskBlockReadyForResolution,
  sortEvents,
  getPriorityMeta,
  isOperationalCheckpoint,
  isExpectedSystemCheckpoint,
  isPlannedStartSystemCheckpoint,
} from "./SprintTimeline.helpers";
import {
  canDeleteCheckpoint,
  canDeleteTaskBlock,
  canManageCheckpoint,
  canManageCheckpointBlock,
  canManageTaskBlock,
  canResolveCheckpoint,
  getBlockResolvers,
  isValidationActionableByUser,
  type SprintTimelineViewer,
} from "./permissions";

function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function SprintTimelineDrawer({
                                       data,
                                       selection,
                                       open,
                                       onClose,
                                       todayIndex,
                                       currentUserName,
                                       currentUserId,
                                       onToggleChecklist,
                                       onStartTask,
                                       onCompleteCheckpoint,
                                       onBlockCheckpoint,
                                       onDeleteEvent,
                                       onRequestValidationDecision,
                                       onResolveCheckpointBlock,
                                       onResolveTaskBlock,
                                       onEditTask,
                                       onDeleteTask,
                                     }: {
  data: SprintTimelineBoardData;
  selection: SprintTimelineSelection;
  open: boolean;
  onClose: () => void;
  todayIndex: number;
  currentUserName?: string;
  currentUserId?: string;
  onToggleChecklist: (
    laneId: string,
    eventId: string,
    itemId: string,
    checked: boolean,
  ) => void;
  onStartTask: (laneId: string, eventId: string) => void;
  onCompleteCheckpoint: (laneId: string, eventId: string) => void;
  onBlockCheckpoint: (laneId: string, eventId: string) => void;
  onDeleteEvent: (laneId: string, eventId: string) => void;
  onRequestValidationDecision: (
    laneId: string,
    eventId: string,
    outcome: "approved" | "rejected",
  ) => void;
  onResolveCheckpointBlock: (laneId: string, eventId: string) => void;
  onResolveTaskBlock: (laneId: string, eventId: string) => void;
  onEditTask?: (laneId: string) => void;
  onDeleteTask: (laneId: string) => void;
}) {
  useLockBodyScroll(open);
  const viewer = useMemo<SprintTimelineViewer>(() => ({
    userId: currentUserId,
    userName: currentUserName,
  }), [currentUserId, currentUserName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !selection) return null;

  const lane = getSelectedLane(data, selection);
  const event = getSelectedEvent(data, selection);
  const derived = lane ? deriveLaneState(lane, todayIndex) : null;

  if (!lane || !derived) return null;

  return (
    <div className="fixed inset-0 z-[1100]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        aria-label="Chiudi"
        onClick={onClose}
      />

      <aside
        className={clsx(
          "absolute right-0 top-0 h-full w-full overflow-hidden border-l border-stroke bg-white shadow-2xl",
          "dark:border-dark-3 dark:bg-gray-dark",
          "max-w-[720px]",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-stroke px-5 py-4 dark:border-dark-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
                  {selection.kind === "event" ? "Evento" : "Task"}
                </div>
                <div className="mt-1 truncate text-xl font-semibold text-dark dark:text-white">
                  {selection.kind === "event" ? event?.title ?? "Evento" : lane.title}
                </div>
                <div className="mt-1 text-sm text-dark/60 dark:text-white/60">
                  {selection.kind === "event"
                    ? `Task collegato: ${lane.title}`
                    : lane.subtitle || "Dettaglio task"}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stroke bg-white/70 px-3 py-2 text-sm text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              >
                Chiudi
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {selection.kind === "event" && event ? (
              <EventFirstDrawer
                lane={lane}
                event={event}
                derived={derived}
                todayIndex={todayIndex}
                currentUserName={currentUserName}
                currentUserId={currentUserId}
                onToggleChecklist={onToggleChecklist}
                onStartTask={onStartTask}
                onCompleteCheckpoint={onCompleteCheckpoint}
                onBlockCheckpoint={onBlockCheckpoint}
                onDeleteEvent={onDeleteEvent}
                onRequestValidationDecision={onRequestValidationDecision}
                onResolveCheckpointBlock={onResolveCheckpointBlock}
                onResolveTaskBlock={onResolveTaskBlock}
                onEditTask={onEditTask}
              />
            ) : (
              <TaskFirstDrawer
                lane={lane}
                derived={derived}
                todayIndex={todayIndex}
                currentUserName={currentUserName}
                currentUserId={currentUserId}
                onEditTask={onEditTask}
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EventFirstDrawer({
                            lane,
                            event,
                            derived,
                            todayIndex,
                            currentUserName,
                            currentUserId,
                            onToggleChecklist,
                            onStartTask,
                            onCompleteCheckpoint,
                            onBlockCheckpoint,
                            onDeleteEvent,
                            onRequestValidationDecision,
                            onResolveCheckpointBlock,
                            onResolveTaskBlock,
                            onEditTask,
                          }: {
  lane: NonNullable<ReturnType<typeof getSelectedLane>>;
  event: NonNullable<ReturnType<typeof getSelectedEvent>>;
  derived: ReturnType<typeof deriveLaneState>;
  todayIndex: number;
  currentUserName?: string;
  currentUserId?: string;
  onToggleChecklist: (
    laneId: string,
    eventId: string,
    itemId: string,
    checked: boolean,
  ) => void;
  onStartTask: (laneId: string, eventId: string) => void;
  onCompleteCheckpoint: (laneId: string, eventId: string) => void;
  onBlockCheckpoint: (laneId: string, eventId: string) => void;
  onDeleteEvent: (laneId: string, eventId: string) => void;
  onRequestValidationDecision: (
    laneId: string,
    eventId: string,
    outcome: "approved" | "rejected",
  ) => void;
  onResolveCheckpointBlock: (laneId: string, eventId: string) => void;
  onResolveTaskBlock: (laneId: string, eventId: string) => void;
  onEditTask?: (laneId: string) => void;
}) {
  const viewer = useMemo<SprintTimelineViewer>(() => ({
    userId: currentUserId,
    userName: currentUserName,
  }), [currentUserId, currentUserName]);
  const priorityMeta = getPriorityMeta(lane.priority);
  const checklist = getChecklistProgress(event);
  const eventSignal = getEventDisplaySignal(lane, event, todayIndex);

  const isPlannedStart = event.kind === "planned-start" || isPlannedStartSystemCheckpoint(event);
  const isCheckpoint = event.kind === "checkpoint";
  const isOperational = isOperationalCheckpoint(event);
  const isValidation = event.kind === "validation";
  const isTaskBlock = event.kind === "task-block";
  const isCheckpointBlock = event.kind === "block-update";

  const chainStatus =
    isCheckpoint ? getCheckpointChainStatus(lane, getEventChainId(event)) : null;

  const hasExplicitStart = lane.events.some((item) => item.kind === "start");
  const canStartThisTask =
    isPlannedStart &&
    canManageCheckpoint(lane, viewer) &&
    !hasExplicitStart;

  const canDelete =
    event.kind === "note" ||
    (event.kind === "checkpoint" && canDeleteCheckpoint(lane, event, viewer)) ||
    (isTaskBlock && canDeleteTaskBlock(lane, event, viewer));

  const canResolveThisCheckpoint =
    isOperational && canResolveCheckpoint(lane, event, viewer);
  const checkpointReady =
    isOperational && isCheckpointReadyForCompletion(event);

  const canResolveThisCheckpointBlock =
    isCheckpointBlock && canManageCheckpointBlock(lane, event, viewer);
  const checkpointBlockReady =
    isCheckpointBlock && isCheckpointBlockReadyForResolution(event);

  const canDecideValidation =
    isValidation && isValidationActionableByUser(event, viewer);

  const canResolveThisTaskBlock =
    isTaskBlock && canManageTaskBlock(lane, event, viewer);
  const taskBlockReady =
    isTaskBlock && isTaskBlockReadyForResolution(event);

  const blockResolvers =
    isTaskBlock || isCheckpointBlock ? getBlockResolvers(event) : [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-stroke bg-white/75 dark:border-dark-3 dark:bg-gray-dark/40">
        <div
          className={clsx(
            "h-1.5 bg-gradient-to-r",
            getSemaforoAccentClass(eventSignal || derived.signal),
          )}
        />

        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-dark dark:text-white">
                  {event.title}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-dark/70 dark:text-white/70">
                    {lane.title}
                  </span>
                  {onEditTask ? (
                    <button
                      onClick={() => onEditTask(lane.id)}
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Modifica
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-1 text-sm text-dark/60 dark:text-white/60">
                {getEventKindLabel(event.kind)} • {formatDateTime(event.date)}
              </div>
            </div>

            {canDelete ? (
              <button
                type="button"
                onClick={() => onDeleteEvent(lane.id, event.id)}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/15 dark:text-rose-300"
              >
                Elimina
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                getSemaforoSurfaceClasses(eventSignal),
              )}
            >
              {getEventKindLabel(event.kind)}
            </span>

            {isValidation ? (
              <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-400/30 dark:text-violet-200">
                {getValidationStatusLabel(event)}
              </span>
            ) : null}

            {chainStatus ? (
              <span className="rounded-full border border-stroke px-2.5 py-1 text-[11px] font-semibold text-dark/75 dark:border-dark-3 dark:text-white/75">
                Chain: {chainStatus}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard label="Data evento" value={formatDateTime(event.date)} />
            <InfoCard label="Task" value={lane.title} />
            <InfoCard
              label="Partecipanti"
              value={event.participants?.map((item) => item.name).join(", ") || "—"}
            />
            <InfoCard
              label="Checklist"
              value={checklist.total ? `${checklist.done}/${checklist.total}` : "—"}
            />
            {isValidation ? (
              <InfoCard
                label="Validatori"
                value={event.validators?.map((item) => item.name).join(", ") || "—"}
              />
            ) : null}
            {event.decidedBy ? (
              <InfoCard label="Deciso da" value={event.decidedBy} />
            ) : null}
          </div>

          {event.note ? (
            <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/[0.04] p-3 text-sm text-dark/80 dark:text-white/80">
              {event.note}
            </div>
          ) : null}

          {blockResolvers.length ? (
            <div className="mt-3 rounded-2xl border border-rose-400/15 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-100">
              <span className="font-semibold">Può sbloccare:</span> {blockResolvers.join(", ")}
            </div>
          ) : null}

          {event.decisionNote ? (
            <div className="mt-3 rounded-2xl border border-violet-400/15 bg-violet-500/10 p-3 text-sm text-violet-900 dark:text-violet-100">
              <span className="font-semibold">Motivazione decisione:</span> {event.decisionNote}
            </div>
          ) : null}

          {isPlannedStart ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onStartTask(lane.id, event.id)}
                disabled={!canStartThisTask}
                className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-500/15 disabled:opacity-50 dark:text-sky-300"
              >
                Inizia task oggi
              </button>
            </div>
          ) : null}

          {isCheckpoint ? (
            <div className="mt-4 space-y-4">
              {event.checklist?.length ? (
                <div className="space-y-2">
                  {event.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-stroke/70 bg-white/80 px-3 py-3 text-sm dark:border-dark-3 dark:bg-gray-dark/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={item.done}
                        disabled={!canResolveThisCheckpoint || chainStatus !== "open"}
                        onChange={(changeEvent) =>
                          onToggleChecklist(
                            lane.id,
                            event.id,
                            item.id,
                            changeEvent.target.checked,
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div
                          className={clsx(
                            "text-dark dark:text-white",
                            item.done ? "line-through opacity-60" : "",
                          )}
                        >
                          {item.label}
                        </div>
                        {item.doneBy || item.doneAt ? (
                          <div className="mt-1 text-[11px] text-dark/55 dark:text-white/55">
                            {item.doneBy ? `Chiusa da ${item.doneBy}` : ""}
                            {item.doneBy && item.doneAt ? " • " : ""}
                            {item.doneAt ? formatDateTime(item.doneAt) : ""}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {chainStatus === "open" ? (
                  <button
                    type="button"
                    onClick={() => onCompleteCheckpoint(lane.id, event.id)}
                    disabled={!canResolveThisCheckpoint || !checkpointReady}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-300"
                  >
                    Completa checkpoint oggi
                  </button>
                ) : null}

                {chainStatus === "open" ? (
                  <button
                    type="button"
                    onClick={() => onBlockCheckpoint(lane.id, event.id)}
                    disabled={!canResolveThisCheckpoint}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/15 disabled:opacity-50 dark:text-rose-300"
                  >
                    Blocca e configura responsabili
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {isCheckpointBlock ? (
            <div className="mt-4 space-y-4">
              {event.checklist?.length ? (
                <div className="space-y-2">
                  {event.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-stroke/70 bg-white/80 px-3 py-3 text-sm dark:border-dark-3 dark:bg-gray-dark/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={item.done}
                        disabled={!canResolveThisCheckpointBlock}
                        onChange={(changeEvent) =>
                          onToggleChecklist(
                            lane.id,
                            event.id,
                            item.id,
                            changeEvent.target.checked,
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div
                          className={clsx(
                            "text-dark dark:text-white",
                            item.done ? "line-through opacity-60" : "",
                          )}
                        >
                          {item.label}
                        </div>
                        {item.doneBy || item.doneAt ? (
                          <div className="mt-1 text-[11px] text-dark/55 dark:text-white/55">
                            {item.doneBy ? `Chiusa da ${item.doneBy}` : ""}
                            {item.doneBy && item.doneAt ? " • " : ""}
                            {item.doneAt ? formatDateTime(item.doneAt) : ""}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResolveCheckpointBlock(lane.id, event.id)}
                  disabled={!canResolveThisCheckpointBlock || !checkpointBlockReady}
                  className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-500/15 disabled:opacity-50 dark:text-sky-300"
                >
                  Sblocca checkpoint
                </button>
              </div>
            </div>
          ) : null}

          {isTaskBlock ? (
            <div className="mt-4 space-y-4">
              {event.checklist?.length ? (
                <div className="space-y-2">
                  {event.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-stroke/70 bg-white/80 px-3 py-3 text-sm dark:border-dark-3 dark:bg-gray-dark/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={item.done}
                        disabled={!canResolveThisTaskBlock}
                        onChange={(changeEvent) =>
                          onToggleChecklist(
                            lane.id,
                            event.id,
                            item.id,
                            changeEvent.target.checked,
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div
                          className={clsx(
                            "text-dark dark:text-white",
                            item.done ? "line-through opacity-60" : "",
                          )}
                        >
                          {item.label}
                        </div>
                        {item.doneBy || item.doneAt ? (
                          <div className="mt-1 text-[11px] text-dark/55 dark:text-white/55">
                            {item.doneBy ? `Chiusa da ${item.doneBy}` : ""}
                            {item.doneBy && item.doneAt ? " • " : ""}
                            {item.doneAt ? formatDateTime(item.doneAt) : ""}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResolveTaskBlock(lane.id, event.id)}
                  disabled={!canResolveThisTaskBlock || !taskBlockReady}
                  className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-500/15 disabled:opacity-50 dark:text-sky-300"
                >
                  Sblocca task
                </button>
              </div>
            </div>
          ) : null}

          {isValidation ? (
            <div className="mt-4 space-y-3">
              {canDecideValidation ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRequestValidationDecision(lane.id, event.id, "approved")}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                  >
                    Approva
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestValidationDecision(lane.id, event.id, "rejected")}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/15 dark:text-rose-300"
                  >
                    Rimanda indietro
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[24px] border border-stroke bg-white/75 p-4 dark:border-dark-3 dark:bg-gray-dark/40">
        <div className="text-sm font-semibold text-dark dark:text-white">Task collegato</div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-stroke/70 bg-white/80 dark:border-dark-3 dark:bg-gray-dark/50">
          <div className={clsx("h-1.5 bg-gradient-to-r", getSemaforoAccentClass(derived.signal))} />
          <div className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className={clsx("mt-1 h-3 w-3 rounded-full", getSemaforoDotClasses(derived.signal))} />
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-dark dark:text-white">{lane.title}</div>
                {lane.subtitle ? (
                  <div className="mt-1 text-sm text-dark/60 dark:text-white/60">{lane.subtitle}</div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  getSemaforoSurfaceClasses(derived.signal),
                )}
              >
                {getSignalLabel(derived.signal)}
              </span>
              <span
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  priorityMeta.surfaceClass,
                )}
              >
                {priorityMeta.label}
              </span>
              <span className="rounded-full border border-stroke px-2.5 py-1 text-[11px] text-dark/70 dark:border-dark-3 dark:text-white/70">
                {getTaskTypeLabel(lane.taskType)}
              </span>
              {lane.ownerName ? (
                <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  {lane.ownerName}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoCard label="Chiusura attesa" value={formatDateOnly(lane.expectedEnd)} />
              <InfoCard label="Chiusura reale" value={formatDateOnly(lane.actualEnd)} />
              <InfoCard
                label="Tempo"
                value={formatElapsedDays(derived.elapsedDays, derived.signal === "green")}
              />
            </div>
          </div>
        </div>
      </section>

      <ChainSection lane={lane} event={event} todayIndex={todayIndex} />
      <TimelineSection lane={lane} todayIndex={todayIndex} />
    </div>
  );
}

function TaskFirstDrawer({
                           lane,
                           derived,
                           todayIndex,
                           currentUserName,
                           currentUserId,
                           onEditTask,
                         }: {
  lane: NonNullable<ReturnType<typeof getSelectedLane>>;
  derived: ReturnType<typeof deriveLaneState>;
  todayIndex: number;
  currentUserName?: string;
  currentUserId?: string;
  onEditTask?: (laneId: string) => void;
}) {
  const viewer = useMemo<SprintTimelineViewer>(() => ({
    userId: currentUserId,
    userName: currentUserName,
  }), [currentUserId, currentUserName]);
  const priorityMeta = getPriorityMeta(lane.priority);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] border border-stroke bg-white/75 dark:border-dark-3 dark:bg-gray-dark/40">
        <div className={clsx("h-1.5 bg-gradient-to-r", getSemaforoAccentClass(derived.signal))} />

        <div className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className={clsx("mt-1 h-3 w-3 rounded-full", getSemaforoDotClasses(derived.signal))} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-dark dark:text-white">{lane.title}</div>
                {onEditTask ? (
                  <button
                    onClick={() => onEditTask(lane.id)}
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Modifica
                  </button>
                ) : null}
              </div>
              {lane.subtitle ? (
                <div className="mt-1 text-sm text-dark/60 dark:text-white/60">{lane.subtitle}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                getSemaforoSurfaceClasses(derived.signal),
              )}
            >
              {derived.stateLabel}
            </span>
            <span
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                priorityMeta.surfaceClass,
              )}
            >
              {priorityMeta.label}
            </span>
            <span className="rounded-full border border-stroke px-2.5 py-1 text-[11px] text-dark/70 dark:border-dark-3 dark:text-white/70">
              {getTaskTypeLabel(lane.taskType)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard label="Conclusione attesa" value={formatDateOnly(lane.expectedEnd)} />
            <InfoCard label="Conclusione reale" value={formatDateOnly(lane.actualEnd)} />
            <InfoCard label="Tempo trascorso" value={formatElapsedDays(derived.elapsedDays, derived.signal === "green")} />
            {lane.ownerName ? <InfoCard label="Titolare Task" value={lane.ownerName} /> : null}
            {lane.referenteName ? <InfoCard label="Referente Task" value={lane.referenteName} /> : null}
          </div>
        </div>
      </section>

      <TimelineSection lane={lane} todayIndex={todayIndex} />
    </div>
  );
}

function ChainSection({
                        lane,
                        event,
                        todayIndex,
                      }: {
  lane: NonNullable<ReturnType<typeof getSelectedLane>>;
  event: SprintTimelineEvent;
  todayIndex: number;
}) {
  const chainEvents = getLaneChainEvents(lane, getEventChainId(event));

  return (
    <section className="rounded-[24px] border border-stroke bg-white/75 p-4 dark:border-dark-3 dark:bg-gray-dark/40">
      <div className="text-sm font-semibold text-dark dark:text-white">Evoluzione collegata</div>

      <div className="mt-4 space-y-3">
        {chainEvents.length ? (
          sortEvents(chainEvents).map((chainEvent) => {
            const signal = getEventDisplaySignal(lane, chainEvent, todayIndex);
            return (
              <div
                key={chainEvent.id}
                className="rounded-2xl border border-stroke/70 bg-white/80 p-3 dark:border-dark-3 dark:bg-gray-dark/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx("h-2.5 w-2.5 rounded-full", getSemaforoDotClasses(signal))} />
                      <div className="text-sm font-semibold text-dark dark:text-white">{chainEvent.title}</div>
                    </div>
                    <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                      {getEventKindLabel(chainEvent.kind)}
                      {chainEvent.kind === "validation" ? ` · ${getValidationStatusLabel(chainEvent)}` : ""}
                    </div>
                  </div>

                  <div className="text-xs text-dark/55 dark:text-white/55">
                    {formatDateTime(chainEvent.date)}
                  </div>
                </div>

                {typeof chainEvent.delayDays === "number" && chainEvent.delayDays > 0 ? (
                  <div className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                    Ritardo accumulato: {chainEvent.delayDays} giorni
                  </div>
                ) : null}

                {chainEvent.decisionNote ? (
                  <div className="mt-2 text-sm text-dark/75 dark:text-white/75">
                    {chainEvent.decisionNote}
                  </div>
                ) : null}

                {!chainEvent.decisionNote && chainEvent.note ? (
                  <div className="mt-2 text-sm text-dark/75 dark:text-white/75">
                    {chainEvent.note}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-dark/60 dark:text-white/60">
            Nessuna evoluzione collegata.
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineSection({
                           lane,
                           todayIndex,
                         }: {
  lane: NonNullable<ReturnType<typeof getSelectedLane>>;
  todayIndex: number;
}) {
  return (
    <section className="rounded-[24px] border border-stroke bg-white/75 p-4 dark:border-dark-3 dark:bg-gray-dark/40">
      <div className="text-sm font-semibold text-dark dark:text-white">Timeline task completa</div>

      <div className="mt-4 space-y-3">
        {lane.events.length ? (
          sortEvents(lane.events).map((evt) => {
            const signal = getEventDisplaySignal(lane, evt, todayIndex);
            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-stroke/70 bg-white/80 p-3 dark:border-dark-3 dark:bg-gray-dark/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx("h-2.5 w-2.5 rounded-full", getSemaforoDotClasses(signal))} />
                      <div className="text-sm font-semibold text-dark dark:text-white">{evt.title}</div>
                    </div>
                    <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                      {getEventKindLabel(evt.kind)}
                      {evt.kind === "validation" ? ` · ${getValidationStatusLabel(evt)}` : ""}
                    </div>
                  </div>

                  <div className="text-xs text-dark/55 dark:text-white/55">{formatDateTime(evt.date)}</div>
                </div>

                {evt.decisionNote ? (
                  <div className="mt-2 text-sm text-dark/75 dark:text-white/75">
                    {evt.decisionNote}
                  </div>
                ) : null}

                {!evt.decisionNote && evt.note ? (
                  <div className="mt-2 text-sm text-dark/75 dark:text-white/75">
                    {evt.note}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-dark/60 dark:text-white/60">Nessun evento presente.</div>
        )}
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-stroke/70 bg-white/80 p-3 dark:border-dark-3 dark:bg-gray-dark/50">
      <div className="text-[11px] font-medium text-dark/55 dark:text-white/55">{label}</div>
      <div className="mt-1 text-sm font-semibold text-dark dark:text-white">{value || "—"}</div>
    </div>
  );
}
