"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SprintTimelineToolbar } from "./SprintTimelineToolbar";
import { SprintTimelineBoard } from "./SprintTimelineBoard";
import { SprintTimelineSummary } from "./SprintTimelineSummary";
import { SprintTimelineDrawer } from "./SprintTimelineDrawer";
import { SprintTimelineEventModal } from "./SprintTimelineEventModal";
import { SprintTimelineQuickTaskModal } from "./SprintTimelineQuickTaskModal";
import { SprintTimelineScrumMasterPage } from "./SprintTimelineScrumMasterPage";
import { SprintTimelineValidationDecisionModal } from "./SprintTimelineValidationDecisionModal";
import { SprintTimelineValidationSetupModal } from "./SprintTimelineValidationSetupModal";
import { SprintTimelineBlockSetupModal } from "./SprintTimelineBlockSetupModal";
import { SprintTimelineCreateTaskModal, type InitialValues } from "./SprintTimelineCreateTaskModal";
import {
  buildTimelineViewport,
  countActiveFilters,
  filterLanesBySegment,
  filterTimelineLanes,
  getDefaultSprintFocusWindow,
  getTodayLabelForToolbar,
  getTodayUnitIndex,
  getLaneFirstRelevantIndex,
  getLaneEffectiveEndIndex,
  shiftViewportAnchor,
  sortTimelineLanes,
  getCheckpointChainStatus,
  getEventChainId,
  isOperationalCheckpoint,
} from "./SprintTimeline.helpers";
import {
  createSprintTimelineMutationBridge,
  isSprintTimelineRemoteMutation,
} from "./SprintTimeline.mutations";
import type {
  SprintTimelineBoardData,
  SprintTimelineFilters,
  SprintTimelineLane,
  SprintTimelineParticipantReference,
  SprintTimelineSelection,
  SprintTimelineZoom,
} from "./SprintTimeline.types";
import type { SprintTimelineMutationResult } from "./SprintTimeline.mutations";
import { useAppDispatch } from "@/components/Store/hooks";
import { createSprintTimelineSprint } from "@/components/Store/slices/sprintTimelineSlice";
import { canConfigureValidation, type SprintTimelineViewer } from "./permissions";

// LaneMeta is no longer needed since SprintTimelineLane now includes source metadata fields

function useCompactBoard() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => setCompact(window.innerWidth < 1024);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return compact;
}

function extractSprintIdFromSegment(segmentId?: string | null) {
  if (!segmentId) return undefined;
  
  // Rimuoviamo il prefisso 'segment:' se presente
  let id = segmentId;
  if (id.startsWith("segment:")) {
    id = id.slice("segment:".length);
  }
  
  // Se l'ID contiene ancora prefissi (es. sprint::...), li manteniamo perché verranno puliti dalle thunk/persistence
  // L'importante è aver rimosso la parte specifica del UI segment
  return id || undefined;
}

function toParticipantReferences(
  participants: SprintTimelineLane["events"][number]["participants"],
): SprintTimelineParticipantReference[] {
  return (participants ?? [])
    .map((participant) => {
      const anagraficaId = participant.referenceId || participant.id;
      const anagraficaType = participant.referenceType || "evolver";
      if (!anagraficaId) return null;
      return { anagraficaId, anagraficaType };
    })
    .filter((participant): participant is SprintTimelineParticipantReference => !!participant);
}

export function SprintTimelineScreen({
                                       data,
                                       currentUserName,
                                       currentUserId,
                                       isSuperUser,
                                       onDataChange,
                                     }: {
  data: SprintTimelineBoardData;
  currentUserName?: string;
  currentUserId?: string;
  isSuperUser?: boolean;
  onDataChange?: (next: SprintTimelineBoardData) => void;
}) {
  const dispatch = useAppDispatch();
  const isAggregateBoard = data.sprint.id === "__aggregate__";

  const [filters, setFilters] = useState<SprintTimelineFilters>({
    query: "",
    signal: "",
    taskType: "",
    ownerOnly: false,
    visibilityMode: "mine",
  });

  const sprintStartIsoDate = data.sprint.startDate?.slice(0, 10);
  const sprintEndIsoDate = data.sprint.endDate?.slice(0, 10);
  const todayIndex = getTodayUnitIndex(sprintStartIsoDate, sprintEndIsoDate) ?? 0;
  const todayLabel = getTodayLabelForToolbar(sprintStartIsoDate, sprintEndIsoDate);
  const compactBoard = useCompactBoard();

  const [mode, setMode] = useState<"timeline" | "scrum-master">("timeline");
  
  // Quando entriamo in Scrum Master, forziamo la visibilità a "all"
  const effectiveFilters = useMemo(() => {
    if (mode === "scrum-master") {
      return { ...filters, visibilityMode: "all" as const };
    }
    return filters;
  }, [mode, filters]);

  const [zoom, setZoom] = useState<SprintTimelineZoom>("sprint-focus");
  const [selection, setSelection] = useState<SprintTimelineSelection>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [focusWindow, setFocusWindow] = useState<number>(
    getDefaultSprintFocusWindow(data, todayIndex),
  );
  const [anchorIndex, setAnchorIndex] = useState<number>(todayIndex);

  const [quickTaskModalOpen, setQuickTaskModalOpen] = useState(false);
  const [eventModalState, setEventModalState] = useState<{
    open: boolean;
    laneId: string | null;
    unitIndex: number;
  }>({
    open: false,
    laneId: null,
    unitIndex: todayIndex,
  });

  const [validationSetupState, setValidationSetupState] = useState<{
    open: boolean;
    laneId: string | null;
    eventId: string | null;
  }>({
    open: false,
    laneId: null,
    eventId: null,
  });

  const [validationDecisionState, setValidationDecisionState] = useState<{
    open: boolean;
    laneId: string | null;
    eventId: string | null;
    outcome: "approved" | "rejected";
  }>({
    open: false,
    laneId: null,
    eventId: null,
    outcome: "approved",
  });

  const [blockSetupState, setBlockSetupState] = useState<{
    open: boolean;
    laneId: string | null;
    eventId: string | null;
    mode: "checkpoint" | "task";
  }>({
    open: false,
    laneId: null,
    eventId: null,
    mode: "checkpoint",
  });

  const [createTaskModalState, setCreateTaskModalState] = useState<{
    open: boolean;
    mode: "create" | "edit" | "promote";
    laneId: string | null;
    initialValues?: InitialValues;
  }>({
    open: false,
    mode: "create",
    laneId: null,
  });

  const [pendingValidationLaneId, setPendingValidationLaneId] = useState<string | null>(null);

  const viewer = useMemo<SprintTimelineViewer>(
    () => ({
      userId: currentUserId,
      userName: currentUserName,
    }),
    [currentUserId, currentUserName],
  );

  useEffect(() => {
    setFocusWindow(getDefaultSprintFocusWindow(data, todayIndex));
  }, [data, todayIndex]);

  useEffect(() => {
    setAnchorIndex(todayIndex);
  }, [data.sprint.id, todayIndex]);

  useEffect(() => {
    if (!pendingValidationLaneId) return;

    const lane = data.lanes.find((l) => l.id === pendingValidationLaneId);
    if (!lane) return;

    const validationEvent = lane.events.find(
      (e) =>
        e.kind === "validation" &&
        e.validationState === "requested" &&
        (!e.validators || e.validators.length === 0),
    );

    if (validationEvent && canConfigureValidation(lane, viewer)) {
      setValidationSetupState({
        open: true,
        laneId: pendingValidationLaneId,
        eventId: validationEvent.id,
      });
      setPendingValidationLaneId(null);
    }
  }, [data, pendingValidationLaneId, viewer]);

  const uiFilteredLanes = useMemo(() => {
    const filtered = filterTimelineLanes(data.lanes, effectiveFilters, viewer, todayIndex);
    return sortTimelineLanes(filtered, todayIndex, viewer);
  }, [data.lanes, effectiveFilters, viewer, todayIndex]);

  const selectedSegment = useMemo(() => {
    if (!selectedSegmentId) return null;
    return data.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  }, [data.segments, selectedSegmentId]);

  const visibleLanes = useMemo(() => {
    return filterLanesBySegment(uiFilteredLanes, selectedSegment, data.totalUnits);
  }, [uiFilteredLanes, selectedSegment, data.totalUnits]);

  const visibleData = useMemo<SprintTimelineBoardData>(() => {
    return {
      ...data,
      lanes: visibleLanes,
    };
  }, [data, visibleLanes]);

  const viewport = useMemo(() => {
    return buildTimelineViewport(
      data,
      zoom,
      anchorIndex,
      todayIndex,
      focusWindow,
      compactBoard,
    );
  }, [anchorIndex, data, focusWindow, todayIndex, zoom, compactBoard]);

  const eventModalLane = useMemo(() => {
    if (!eventModalState.laneId) return null;
    return data.lanes.find((lane) => lane.id === eventModalState.laneId) ?? null;
  }, [data.lanes, eventModalState.laneId]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const findLaneMeta = (displayLaneId: string): SprintTimelineLane | undefined => {
    return data.lanes.find((lane) => lane.id === displayLaneId);
  };

  const currentCreateSprintId = useMemo(() => {
    if (!isAggregateBoard) return data.sprint.id;

    const fromSelectedSegment = extractSprintIdFromSegment(selectedSegmentId);
    if (fromSelectedSegment) return fromSelectedSegment;

    const segmentContainingToday =
      data.segments.find(
        (segment) => todayIndex >= segment.startIndex && todayIndex < segment.endIndex,
      ) ?? data.segments[0];

    return extractSprintIdFromSegment(segmentContainingToday?.id) || undefined;
  }, [isAggregateBoard, data.sprint.id, data.segments, selectedSegmentId, todayIndex]);

  const resolveLaneTarget = (displayLaneId: string) => {
    const lane = findLaneMeta(displayLaneId);
    
    // Unwrapping robusto: usa sourceLaneId se presente, altrimenti prova a splittare manualmente
    let laneId = lane?.sourceLaneId || displayLaneId;
    if (laneId.includes("::")) {
      laneId = laneId.split("::")[1];
    }

    let sprintId = lane?.sourceSprintId || data.sprint.id;
    
    // Se siamo su una board aggregata e non abbiamo un sourceSprintId certo, 
    // proviamo a usare la sezione attiva (selezionata) o lo sprint corrente della board.
    if (!sprintId || sprintId === "__aggregate__") {
      sprintId = currentCreateSprintId || data.sprint.id;
    }

    return { laneId, sprintId };
  };

  const buildMutations = (sprintId?: string) =>
    createSprintTimelineMutationBridge({
      sprintId,
      dispatch,
      currentUserName,
      todayIndex,
      baseStartDate: data.sprint.startDate,
    });

  const buildCreateSprintMutation = () =>
    createSprintTimelineMutationBridge({
      dispatch,
      currentUserName,
      todayIndex,
      baseStartDate: data.sprint.startDate,
      onCreateSprint: async (payload) => {
        await dispatch(createSprintTimelineSprint({ payload }));
      },
    });

  const commit = (next: SprintTimelineMutationResult) => {
    if (isSprintTimelineRemoteMutation(next)) {
      void next.run();
      return;
    }

    onDataChange?.(next);
  };

  const deleteEventAction = (displayLaneId: string, eventId: string) => {
    const target = resolveLaneTarget(displayLaneId);
    commit(buildMutations(target.sprintId).deleteEventFromLane(data, target.laneId, eventId));
  };

  const startTaskAction = (displayLaneId: string, eventId: string) => {
    const target = resolveLaneTarget(displayLaneId);
    commit(
      buildMutations(target.sprintId).startTaskOnLane(
        data,
        target.laneId,
        eventId,
      ),
    );
  };

  const toggleChecklistAction = (
    displayLaneId: string,
    eventId: string,
    itemId: string,
    checked: boolean,
  ) => {
    const target = resolveLaneTarget(displayLaneId);
    commit(
      buildMutations(target.sprintId).toggleChecklistItem(
        data,
        target.laneId,
        eventId,
        itemId,
        checked,
        currentUserName,
        todayIndex,
      ),
    );
  };
  const completeCheckpointAction = (displayLaneId: string, eventId: string) => {
    const target = resolveLaneTarget(displayLaneId);

    commit(
      buildMutations(target.sprintId).appendChainUpdate(data, {
        laneId: target.laneId,
        eventId,
        kind: "completion-update",
        todayIndex,
        currentUserName,
      }),
    );
    setPendingValidationLaneId(displayLaneId);
  };

  const configureValidationAction = (displayLaneId: string, eventId: string) => {
    setValidationSetupState({
      open: true,
      laneId: displayLaneId,
      eventId,
    });
  };

  const validationSetupSaveAction = (payload: {
    validators: SprintTimelineParticipantReference[];
    note?: string;
  }) => {
    if (!validationSetupState.laneId || !validationSetupState.eventId) return;
    const target = resolveLaneTarget(validationSetupState.laneId);

    commit(
      buildMutations(target.sprintId).configureValidation(data, {
        laneId: target.laneId,
        eventId: validationSetupState.eventId,
        validators: payload.validators,
        note: payload.note,
      }),
    );
  };

  const blockCheckpointSaveAction = (payload: {
    note?: string;
    participants: SprintTimelineParticipantReference[];
    checklistItems: string[];
  }) => {
    if (!blockSetupState.laneId) return;

    const target = resolveLaneTarget(blockSetupState.laneId);

    if (blockSetupState.mode === "task") {
      commit(
        buildMutations(target.sprintId).appendLaneSystemEvent(
          data,
          target.laneId,
          "task-block",
          todayIndex,
          payload.note,
          payload.participants,
          payload.checklistItems,
        ),
      );
      return;
    }

    if (blockSetupState.eventId) {
      commit(
        buildMutations(target.sprintId).appendChainUpdate(data, {
          laneId: target.laneId,
          eventId: blockSetupState.eventId,
          kind: "block-update",
          todayIndex,
          currentUserName,
          note: payload.note,
          participants: payload.participants,
          checklistItems: payload.checklistItems,
        }),
      );
    }
  };

  const resolveCheckpointBlockAction = (displayLaneId: string, eventId: string) => {
    const target = resolveLaneTarget(displayLaneId);

    commit(
      buildMutations(target.sprintId).resolveCheckpointBlock(
        data,
        target.laneId,
        eventId,
      ),
    );

    if (selection?.kind === "event" && selection.eventId === eventId) {
      setSelection(null);
    }
  };

  const resolveTaskBlockAction = (displayLaneId: string, eventId: string) => {
    const target = resolveLaneTarget(displayLaneId);
    commit(
      buildMutations(target.sprintId).resolveTaskBlock(
        data,
        target.laneId,
        eventId,
      ),
    );
  };

  const openEventModal = (laneId: string, unitIndex: number) => {
    setEventModalState({
      open: true,
      laneId,
      unitIndex,
    });
  };

  const closeEventModal = () => {
    setEventModalState({
      open: false,
      laneId: null,
      unitIndex: todayIndex,
    });
  };

  function handleEditTask(laneId: string) {
    const lane = data.lanes.find((l) => l.id === laneId);
    if (!lane) return;

    // Carichiamo solo i checkpoint operativi gia esistenti:
    // i checkpoint di sistema non devono diventare nuove milestone in edit.
    const milestones = (lane.events || [])
      .filter((event) => isOperationalCheckpoint(event))
      .map(e => ({
        eventId: e.id,
        title: e.title || "",
        unitIndex: e.dateIndex,
        note: e.note || "",
        participants: toParticipantReferences(e.participants),
        checklistItems: (e.checklist || []).map((c: any) => c.label).filter(Boolean),
      }));

    setCreateTaskModalState({
      open: true,
      mode: "edit",
      laneId,
      initialValues: {
        ...lane,
        id: laneId,
        plannedStartIndex: getLaneFirstRelevantIndex(lane),
        expectedEndIndex: getLaneEffectiveEndIndex(lane, data.totalUnits),
        milestones,
      },
    });
  }

  function handlePromoteBacklogTask(laneId: string) {
    const lane = data.lanes.find((l) => l.id === laneId);
    if (!lane) return;

    const defaultExpectedEndIndex = Math.min(
      Math.max(todayIndex + 7, todayIndex),
      Math.max(0, data.totalUnits - 1),
    );

    setCreateTaskModalState({
      open: true,
      mode: "promote",
      laneId,
      initialValues: {
        ...lane,
        id: laneId,
        plannedStartIndex: todayIndex,
        expectedEndIndex: defaultExpectedEndIndex,
      },
    });
  }

  function handleDeleteTask(laneId: string) {
    const target = resolveLaneTarget(laneId);
    commit(buildMutations(target.sprintId).deleteTaskFromBoard(target.laneId));
  }

  return (
    <div className="relative isolate w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <SprintTimelineSummary 
        data={data} 
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        mode={mode === "scrum-master" ? "global" : "personal"}
      />

      {mode === "timeline" ? (
        <>
          <SprintTimelineToolbar
            data={data}
            filters={effectiveFilters}
            zoom={zoom}
            totalVisible={visibleLanes.length}
            viewportTitle={viewport.title}
            todayLabel={todayLabel}
            activeFilterCount={activeFilterCount}
            onFiltersChange={setFilters}
            onZoomChange={(nextZoom) => {
              setZoom(nextZoom);
              if (nextZoom === "sprint-focus") {
                setFocusWindow(getDefaultSprintFocusWindow(data, todayIndex));
                setAnchorIndex(todayIndex);
              } else if (nextZoom === "week") {
                setAnchorIndex(todayIndex);
              } else if (nextZoom === "month") {
                setAnchorIndex(todayIndex);
              } else {
                setAnchorIndex(0);
              }
            }}
            onMoveViewport={(direction) =>
              setAnchorIndex((current) =>
                shiftViewportAnchor(data, zoom, current, direction, focusWindow),
              )
            }
            onResetViewport={() => {
              setAnchorIndex(todayIndex);
              if (zoom === "sprint-focus") {
                setFocusWindow(getDefaultSprintFocusWindow(data, todayIndex));
              }
            }}
            onClearFilters={() =>
              setFilters({
                query: "",
                signal: "",
                taskType: "",
                ownerOnly: false,
                visibilityMode: "mine",
              })
            }
            onQuickAdd={() => setQuickTaskModalOpen(true)}
            onOpenScrumMaster={isSuperUser ? () => setMode("scrum-master") : undefined}
          />

          {selectedSegment ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
              Sprint selezionato: <span className="font-semibold">{selectedSegment.label}</span>
              <button
                type="button"
                className="ml-3 rounded-full border border-primary/20 px-2 py-0.5 text-xs hover:bg-primary/10"
                onClick={() => setSelectedSegmentId(null)}
              >
                reset
              </button>
            </div>
          ) : null}

          <SprintTimelineBoard
            data={visibleData}
            viewport={viewport}
            currentUserName={currentUserName}
            currentUserId={currentUserId}
            selection={selection}
            selectedSegmentId={selectedSegmentId}
            compactMode={compactBoard}
            onSelectionChange={setSelection}
            onSegmentSelect={setSelectedSegmentId}
            onCellQuickAdd={openEventModal}
            onOpenEvent={(laneId, eventId) => setSelection({ kind: "event", laneId, eventId })}
            onDeleteEvent={(laneId, eventId) => {
              deleteEventAction(laneId, eventId);
              if (selection?.kind === "event" && selection.eventId === eventId) {
                setSelection(null);
              }
            }}
            onConfigureValidation={(laneId, eventId) => {
              setValidationSetupState({
                open: true,
                laneId,
                eventId
              });
            }}
          />
        </>
      ) : (
                <SprintTimelineScrumMasterPage
          data={data}
          todayIndex={todayIndex}
          currentUserId={currentUserId}
          selection={selection}
          onSelectionChange={setSelection}
          onClose={() => setMode("timeline")}
          onCreateSprint={(payload) =>
            commit(buildCreateSprintMutation().createSprintOnBoard(data, payload))
          }
          onCreateFullTask={() => {
                  setCreateTaskModalState({ open: true, mode: "create", laneId: null });
                }}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onPromoteBacklogTask={handlePromoteBacklogTask}
          onSegmentChange={setSelectedSegmentId}
        />
      )}

      {/* GLOBAL MODALS AND DRAWERS (Always available in both modes) */}
      <SprintTimelineDrawer
        data={data}
        selection={selection}
        open={!!selection}
        onClose={() => setSelection(null)}
        todayIndex={todayIndex}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        onToggleChecklist={(laneId, eventId, itemId, checked) => {
          toggleChecklistAction(laneId, eventId, itemId, checked);
        }}
        onStartTask={(laneId, eventId) => {
          startTaskAction(laneId, eventId);
        }}
        onCompleteCheckpoint={(laneId, eventId) => {
          completeCheckpointAction(laneId, eventId);
        }}
        onBlockCheckpoint={(laneId, eventId) =>
          setBlockSetupState({
            open: true,
            laneId,
            eventId,
            mode: "checkpoint",
          })
        }
        onDeleteEvent={(laneId, eventId) => {
          deleteEventAction(laneId, eventId);
          if (selection?.kind === "event" && selection.eventId === eventId) {
            setSelection(null);
          }
        }}
        onRequestValidationDecision={(laneId, eventId, outcome) =>
          setValidationDecisionState({
            open: true,
            laneId,
            eventId,
            outcome,
          })
        }
        onResolveCheckpointBlock={(laneId, eventId) => {
          resolveCheckpointBlockAction(laneId, eventId);
        }}
        onResolveTaskBlock={(laneId, eventId) => {
          resolveTaskBlockAction(laneId, eventId);
          if (selection?.kind === "event" && selection.eventId === eventId) {
            setSelection(null);
          }
        }}
        onEditTask={undefined}
        onDeleteTask={handleDeleteTask}
      />

      <SprintTimelineQuickTaskModal
        open={quickTaskModalOpen}
        onClose={() => setQuickTaskModalOpen(false)}
        onSave={(payload) => {
          if (!currentCreateSprintId) return;
          commit(
            buildMutations(currentCreateSprintId).createBacklogTaskOnBoard(
              data,
              payload,
            ),
          );
        }}
      />

      <SprintTimelineEventModal
        open={eventModalState.open}
        onClose={closeEventModal}
        onSave={(payload) => {
          const target = resolveLaneTarget(payload.laneId);

          if (payload.kind === "task-block") {
            commit(
              buildMutations(target.sprintId).appendLaneSystemEvent(
                data,
                target.laneId,
                "task-block",
                payload.unitIndex,
                payload.note,
                payload.participants,
                payload.checklistItems,
              ),
            );
            return;
          }

          commit(
            buildMutations(target.sprintId).createEventOnLane(data, {
              ...payload,
              laneId: target.laneId,
            }),
          );
        }}
        lane={eventModalLane}
        sprintStartDate={sprintStartIsoDate}
        sprintEndDate={sprintEndIsoDate}
        segments={data.segments}
        initialUnitIndex={eventModalState.unitIndex}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
      />

      <SprintTimelineBlockSetupModal
        open={blockSetupState.open}
        onClose={() =>
          setBlockSetupState({
            open: false,
            laneId: null,
            eventId: null,
            mode: "checkpoint",
          })
        }
        onSave={(payload) => {
          blockCheckpointSaveAction(payload);
          setBlockSetupState({
            open: false,
            laneId: null,
            eventId: null,
            mode: "checkpoint",
          });
        }}
      />

      <SprintTimelineValidationSetupModal
        open={validationSetupState.open}
        onClose={() =>
          setValidationSetupState({
            open: false,
            laneId: null,
            eventId: null,
          })
        }
        onSave={(payload) => {
          validationSetupSaveAction(payload);
          setValidationSetupState({
            open: false,
            laneId: null,
            eventId: null,
          });
        }}
      />

      <SprintTimelineValidationDecisionModal
        open={validationDecisionState.open}
        outcome={validationDecisionState.outcome}
        onClose={() =>
          setValidationDecisionState({
            open: false,
            laneId: null,
            eventId: null,
            outcome: "approved",
          })
        }
        onSave={({ decisionNote }) => {
          if (!validationDecisionState.laneId || !validationDecisionState.eventId) return;

          const target = resolveLaneTarget(validationDecisionState.laneId);

          commit(
            buildMutations(target.sprintId).decideValidationOnLane(data, {
              laneId: target.laneId,
              eventId: validationDecisionState.eventId,
              outcome: validationDecisionState.outcome,
              decisionNote,
              currentUserName,
              todayIndex,
            }),
          );

          setValidationDecisionState({
            open: false,
            laneId: null,
            eventId: null,
            outcome: "approved",
          });
        }}
      />

      <SprintTimelineCreateTaskModal
        open={createTaskModalState.open}
        initialValues={createTaskModalState.initialValues}
        titleOverride={
          createTaskModalState.mode === "promote" ? "Porta nello sprint" : undefined
        }
        subtitleOverride={
          createTaskModalState.mode === "promote"
            ? "Rivedi il task backlog, imposta le date operative e portalo nello sprint corrente."
            : undefined
        }
        saveLabel={
          createTaskModalState.mode === "promote" ? "Porta nello sprint" : undefined
        }
        onClose={() =>
          setCreateTaskModalState({ open: false, mode: "create", laneId: null })
        }
        onSave={(payload) => {
          if (createTaskModalState.mode === "promote" && createTaskModalState.laneId) {
            if (!currentCreateSprintId) return;
            commit(
              buildMutations(currentCreateSprintId).promoteBacklogTaskToSprint(
                data,
                createTaskModalState.laneId,
                payload,
              ),
            );
          } else if (
            createTaskModalState.mode === "edit" &&
            createTaskModalState.initialValues?.id
          ) {
            const target = resolveLaneTarget(createTaskModalState.initialValues.id);
            commit(
              buildMutations(target.sprintId).updateTaskOnBoard(
                target.laneId,
                payload,
              ),
            );
          } else {
            if (!currentCreateSprintId) return;
            commit(
              buildMutations(currentCreateSprintId).createTaskOnBoard(
                data,
                payload,
              ),
            );
          }
          setCreateTaskModalState({ open: false, mode: "create", laneId: null });
        }}
        onDelete={
          createTaskModalState.mode !== "create" &&
          (createTaskModalState.laneId || createTaskModalState.initialValues?.id)
            ? () => {
                handleDeleteTask(
                  createTaskModalState.laneId || createTaskModalState.initialValues!.id!,
                );
                setCreateTaskModalState({ open: false, mode: "create", laneId: null });
              }
            : undefined
        }
        existingOwners={data.lanes.map((l) => l.ownerName).filter(Boolean) as string[]}
        sprintStartDate={sprintStartIsoDate}
        sprintEndDate={sprintEndIsoDate}
        expectedEndMaxDate={data.segments[data.segments.length - 1]?.endDate?.slice(0, 10) ?? sprintEndIsoDate}
        totalUnits={data.totalUnits}
        segments={data.segments}
      />
    </div>
  );
}
