"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import FloatingPortal from "@/components/AtlasModuli/Calendario/Tools/FloatingPortal";
import { Popover } from "@/components/ui/Popover";
import type {
  SprintTimelineBoardData,
  SprintTimelineLane,
  SprintTimelineMenuPayload,
  SprintTimelineSegment,
  SprintTimelineSelection,
  SprintTimelineViewport,
  TimelineSemaforo,
} from "./SprintTimeline.types";
import {
  buildLaneVisualSegments,
  deriveLaneState,
  formatDateOnly,
  formatElapsedDays,
  getChecklistProgress,
  getCheckpointChainStatus,
  getEventChainId,
  getEventDisplaySignal,
  getEventKindLabel,
  getIsoDateForUnitIndex,
  getLaneEffectiveEndIndex,
  getLaneFirstRelevantIndex,
  getPriorityMeta,
  getSemaforoAccentClass,
  getSemaforoClasses,
  getSemaforoDotClasses,
  getSemaforoSurfaceClasses,
  getSignalLabel,
  getSprintArrowTone,
  getTaskTypeLabel,
  getTodayUnitIndex,
  getUnitX,
  getValidationStatusLabel,
  getViewportTodayX,
  isValidationRequested,
  isExpectedSystemCheckpoint,
  isOperationalCheckpoint,
  sortEvents,
} from "./SprintTimeline.helpers";
import {
  canCreateLaneNote,
  canManageCheckpoint,
  type SprintTimelineViewer,
} from "./permissions";
import SprintTimelineContextMenu from "./SprintTimelineContextMenu";
import SprintTimelineEventHover from "./SprintTimelineEventHover";

type MenuState = {
  x: number;
  y: number;
  payload: SprintTimelineMenuPayload;
} | null;

type HeaderGroup = {
  key: string;
  label: string;
  startIndex: number;
  endIndex: number;
};

type VisibleSprintLayer = {
  segment: SprintTimelineSegment;
  visibleStart: number;
  visibleEnd: number;
  layer: number;
  sourceIndex: number;
};

const TIMELINE_TOP_SURFACE =
  "border border-primary/16 bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.05),transparent_22%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.05),transparent_20%),rgba(255,255,255,0.985)] dark:border-dark-3 dark:bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.08),transparent_20%),rgba(5,7,11,0.992)]";

const TIMELINE_MONTH_BLOCK =
  "border-l border-stroke/60 bg-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.03]";

const TIMELINE_WEEK_BLOCK =
  "border-l border-stroke/50 bg-slate-900/[0.02] dark:border-white/10 dark:bg-white/[0.02]";

const TIMELINE_COLUMN_LINE =
  "border-l border-stroke/50 dark:border-white/8";

const TIMELINE_HEADER_BOTTOM_LINE =
  "border-b border-stroke/50 dark:border-white/8";

const TIMELINE_MONTH_TEXT =
  "text-dark/48 dark:text-white/55";

const TIMELINE_WEEK_TEXT =
  "text-primary/85 dark:text-emerald-300/92";

const TIMELINE_DAY_TOP_TEXT =
  "text-dark/40 dark:text-white/38";

const TIMELINE_DAY_BOTTOM_TEXT =
  "text-dark/78 dark:text-white/72";

/**
 * SOLO correzione della parte sticky:
 * più solida, niente fade sopra la timeline
 */
const TASK_COLUMN_HEADER_GLASS =
  "overflow-hidden border-r border-primary/16 bg-white shadow-[12px_0_30px_rgba(2,8,23,0.08)] dark:border-white/10 dark:bg-[#05070b] dark:shadow-[12px_0_30px_rgba(0,0,0,0.34)]";

const TASK_COLUMN_ROW_GLASS =
  "overflow-hidden border-r border-stroke/70 bg-white shadow-[10px_0_24px_rgba(2,8,23,0.06)] dark:border-white/10 dark:bg-[#05070b] dark:shadow-[10px_0_24px_rgba(0,0,0,0.28)]";

const TASK_COLUMN_EDGE_HEADER =
  "pointer-events-none absolute inset-y-0 right-0 z-[3] w-8 bg-gradient-to-r from-transparent via-black/6 to-black/10 dark:via-white/[0.04] dark:to-white/[0.08]";

const TASK_COLUMN_EDGE_ROW =
  "pointer-events-none absolute inset-y-0 right-0 z-[3] w-6 bg-gradient-to-r from-transparent via-black/5 to-black/8 dark:via-white/[0.03] dark:to-white/[0.06]";

function HoverPopover({
                        children,
                        content,
                        placement = "top",
                        maxWidth = "22rem",
                        fullWidth = false,
                        className,
                      }: {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  maxWidth?: string;
  fullWidth?: boolean;
  className?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openNow = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };

  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={anchorRef}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      className={clsx(
        fullWidth ? "block h-full w-full" : "inline-block",
        className,
      )}
    >
      {children}

      <FloatingPortal
        open={open}
        anchorRef={anchorRef as never}
        placement={placement}
        offset={10}
        shift={10}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        {({ placement: finalPlacement }) => (
          <Popover
            placement={finalPlacement}
            maxWidth={maxWidth}
            withConnector={true}
          >
            {content}
          </Popover>
        )}
      </FloatingPortal>
    </div>
  );
}

function SegmentHoverCard({ segment }: { segment: SprintTimelineSegment }) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-dark dark:text-white">
        {segment.label}
      </div>
      {segment.description ? (
        <div className="mt-1 text-xs text-dark/75 dark:text-white/75">
          {segment.description}
        </div>
      ) : null}
      <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60">
        Start: {formatDateOnly(segment.startDate)}
      </div>
      <div className="text-[11px] text-dark/60 dark:text-white/60">
        End: {formatDateOnly(segment.endDate)}
      </div>
    </div>
  );
}

function TaskHoverCard({
                         lane,
                         signal,
                       }: {
  lane: SprintTimelineLane;
  signal: TimelineSemaforo;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={clsx("h-2.5 w-2.5 rounded-full", getSemaforoDotClasses(signal))}
        />
        <div className="text-sm font-semibold text-dark dark:text-white">
          {lane.title}
        </div>
      </div>

      {lane.subtitle ? (
        <div className="mt-1 text-xs text-dark/70 dark:text-white/70">
          {lane.subtitle}
        </div>
      ) : null}

      {lane.description ? (
        <div className="mt-2 text-xs text-dark/80 dark:text-white/80">
          {lane.description}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-dark/60 dark:text-white/60">
        {lane.ownerName ? <span>Owner: {lane.ownerName}</span> : null}
        {lane.taskType ? <span>Tipo: {getTaskTypeLabel(lane.taskType)}</span> : null}
        {lane.priority ? <span>Priorità: {lane.priority}</span> : null}
      </div>
    </div>
  );
}

function LaneActionBadge({ 
  signal, 
  pulse, 
  label 
}: { 
  signal: TimelineSemaforo; 
  pulse?: boolean; 
  label: string;
}) {
  return (
    <div className={clsx(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm",
      getSemaforoSurfaceClasses(signal),
      pulse && "animate-badge-flash ring-2 ring-rose-500/20"
    )}>
      {pulse && <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"></span>
        <span className={clsx("relative inline-flex h-1.5 w-1.5 rounded-full", getSemaforoDotClasses(signal))}></span>
      </span>}
      {!pulse && <span className={clsx("h-1.5 w-1.5 rounded-full", getSemaforoDotClasses(signal))} />}
      {label}
    </div>
  );
}

function ClampTitle({
                      children,
                      className,
                      lines = 2,
                    }: {
  children: React.ReactNode;
  className?: string;
  lines?: number;
}) {
  return (
    <div
      className={clsx("min-w-0 overflow-hidden whitespace-normal break-words", className)}
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
      }}
    >
      {children}
    </div>
  );
}

function rowMinHeight(expanded: boolean, compactMode: boolean) {
  if (compactMode) return expanded ? 220 : 124;
  return expanded ? 252 : 148;
}

function getEventSpreadSettings(
  compactMode: boolean,
  expanded: boolean,
  unitWidth: number,
) {
  return {
    rows: compactMode ? (expanded ? 5 : 4) : expanded ? 6 : 5,
    spreadX: compactMode
      ? Math.max(12, Math.min(expanded ? 28 : 20, unitWidth * (expanded ? 0.3 : 0.24)))
      : Math.max(18, Math.min(expanded ? 38 : 28, unitWidth * (expanded ? 0.32 : 0.24))),
    spreadY: compactMode ? (expanded ? 18 : 15) : expanded ? 26 : 20,
    expectedYOffset: compactMode ? -28 : expanded ? -40 : -34,
  };
}

function getBalancedRowOffset(row: number, spreadY: number) {
  if (row === 0) return 0;
  const ring = Math.ceil(row / 2);
  return (row % 2 === 1 ? -1 : 1) * ring * spreadY;
}

function getBalancedColumnOffset(column: number, spreadX: number) {
  if (column === 0) return 0;
  const ring = Math.ceil(column / 2);
  return (column % 2 === 1 ? 1 : -1) * ring * spreadX;
}

function buildPositionedLaneEvents(args: {
  lane: SprintTimelineLane;
  visibleEvents: SprintTimelineLane["events"];
  eventsByDay: Map<number, SprintTimelineLane["events"]>;
  viewport: SprintTimelineViewport;
  unitWidth: number;
  baseY: number;
  compactMode: boolean;
  expanded: boolean;
  todayIndex: number;
}) {
  const settings = getEventSpreadSettings(
    args.compactMode,
    args.expanded,
    args.unitWidth,
  );

  return sortEvents(args.visibleEvents).map((event) => {
    const sameDay = sortEvents(args.eventsByDay.get(event.dateIndex) ?? []);
    const positionInDay = sameDay.findIndex((item) => item.id === event.id);
    // Vertical-first packing: in this layout we have more headroom above/below the line
    // than left/right inside a day cell, so we fill rows first and spill horizontally later.
    const visibleRows = Math.min(settings.rows, Math.max(1, sameDay.length));
    const row = positionInDay % visibleRows;
    const column = Math.floor(positionInDay / visibleRows);
    const isExpected = event.kind === "expected-completion" || isExpectedSystemCheckpoint(event);
    const x =
      getUnitX(args.viewport.columns, args.unitWidth, event.dateIndex, "center") +
      (isExpected ? 0 : getBalancedColumnOffset(column, settings.spreadX));
    const y =
      args.baseY +
      (isExpected
        ? settings.expectedYOffset
        : getBalancedRowOffset(row, settings.spreadY));

    return {
      event,
      x,
      y,
      signal: getEventDisplaySignal(args.lane, event, args.todayIndex),
      dayCount: sameDay.length,
      positionInDay,
    };
  });
}

function connectorColor(signal: TimelineSemaforo) {
  switch (signal) {
    case "green":
      return "rgba(52,211,153,0.85)";
    case "yellow":
      return "rgba(251,191,36,0.88)";
    case "orange":
      return "rgba(251,146,60,0.90)";
    case "red":
      return "rgba(251,113,133,0.88)";
    case "blue":
      return "rgba(56,189,248,0.84)";
    case "purple":
      return "rgba(167,139,250,0.88)";
    case "teal":
      return "rgba(45,212,191,0.88)";
    default:
      return "rgba(148,163,184,0.72)";
  }
}

function getSegmentClasses(segmentSignal: TimelineSemaforo) {
  switch (segmentSignal) {
    case "green":
      return {
        solid: "bg-emerald-400/95 shadow-[0_0_18px_rgba(52,211,153,0.30)]",
        dashed: "border-emerald-400/95",
      };
    case "yellow":
      return {
        solid: "bg-amber-300/95 shadow-[0_0_18px_rgba(251,191,36,0.30)]",
        dashed: "border-amber-300/95",
      };
    case "orange":
      return {
        solid: "bg-orange-400/95 shadow-[0_0_18px_rgba(251,146,60,0.30)]",
        dashed: "border-orange-400/95",
      };
    case "red":
      return {
        solid: "bg-rose-400/95 shadow-[0_0_18px_rgba(251,113,133,0.30)]",
        dashed: "border-rose-400/95",
      };
    case "blue":
      return {
        solid: "bg-sky-400/95 shadow-[0_0_18px_rgba(56,189,248,0.26)]",
        dashed: "border-sky-400/95",
      };
    case "purple":
      return {
        solid: "bg-violet-400/95 shadow-[0_0_18px_rgba(167,139,250,0.30)]",
        dashed: "border-violet-400/95",
      };
    case "teal":
      return {
        solid: "bg-teal-400/95 shadow-[0_0_18px_rgba(45,212,191,0.26)]",
        dashed: "border-teal-400/95",
      };
    case "gray":
    default:
      return {
        solid: "bg-slate-400/80 shadow-[0_0_14px_rgba(148,163,184,0.20)]",
        dashed: "border-slate-400/80",
      };
  }
}

function buildGroups(
  viewport: SprintTimelineViewport,
  key: "monthKey" | "weekKey",
  label: "monthLabel" | "weekLabel",
): HeaderGroup[] {
  const groups: HeaderGroup[] = [];
  viewport.columns.forEach((column, index) => {
    const currentKey = column[key];
    const previous = groups[groups.length - 1];
    if (!previous || previous.key !== currentKey) {
      groups.push({
        key: currentKey,
        label: column[label],
        startIndex: index,
        endIndex: index + 1,
      });
      return;
    }
    previous.endIndex = index + 1;
  });
  return groups;
}

function buildVisibleSprintLayers(
  segments: SprintTimelineSegment[],
  viewport: SprintTimelineViewport,
): VisibleSprintLayer[] {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const toUtcDate = (iso?: string) => {
    if (!iso) return null;
    const raw = iso.slice(0, 10);
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  };

  const viewportStartDate = viewport.columns[0]?.isoDate
    ? toUtcDate(viewport.columns[0].isoDate)
    : null;

  const resolveStartOffset = (segment: SprintTimelineSegment) => {
    const segmentStart = toUtcDate(segment.startDate);
    if (!viewportStartDate || !segmentStart) return null;
    return Math.round(
      (segmentStart.getTime() - viewportStartDate.getTime()) / DAY_MS,
    );
  };

  const resolveEndOffsetExclusive = (segment: SprintTimelineSegment) => {
    const segmentEnd = toUtcDate(segment.endDate);
    if (!viewportStartDate || !segmentEnd) return null;
    return (
      Math.round((segmentEnd.getTime() - viewportStartDate.getTime()) / DAY_MS) + 1
    );
  };

  const visible = segments
    .map((segment, sourceIndex) => {
      const rawStart = resolveStartOffset(segment);
      const rawEnd = resolveEndOffsetExclusive(segment);

      if (rawStart === null || rawEnd === null) return null;

      const visibleStart = Math.max(0, rawStart);
      const visibleEnd = Math.min(viewport.columns.length, rawEnd);

      if (visibleStart >= visibleEnd) return null;

      return {
        segment,
        visibleStart: viewport.startIndex + visibleStart,
        visibleEnd: viewport.startIndex + visibleEnd,
        layer: 0,
        sourceIndex,
      };
    })
    .filter(Boolean) as VisibleSprintLayer[];

  const layersEnd: number[] = [];
  const placed = visible
    .sort((a, b) => {
      if (a.visibleStart !== b.visibleStart) return a.visibleStart - b.visibleStart;
      return a.visibleEnd - b.visibleEnd;
    })
    .map((item) => {
      let layer = layersEnd.findIndex((lastEnd) => item.visibleStart >= lastEnd);
      if (layer === -1) {
        layer = layersEnd.length;
        layersEnd.push(item.visibleEnd);
      } else {
        layersEnd[layer] = item.visibleEnd;
      }
      return { ...item, layer };
    });

  return placed;
}

function SprintArrow({
                       label,
                       startLabel,
                       endLabel,
                       toneClass,
                       borderColor,
                       active,
                       hovered,
                       compactMode,
                       onClick,
                     }: {
  label: string;
  startLabel?: string;
  endLabel?: string;
  toneClass: string;
  borderColor: string;
  active: boolean;
  hovered: boolean;
  compactMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative h-full w-full overflow-visible transition-all duration-200"
      onClick={onClick}
      title={label}
    >
      <div
        className={clsx(
          "absolute inset-y-0 left-0 right-[28px] rounded-l-[16px] border-y border-l backdrop-blur-[1px]",
          toneClass,
          hovered || active
            ? "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_38px_rgba(99,102,241,0.30)]"
            : "shadow-[0_16px_30px_rgba(0,0,0,0.26)] group-hover:shadow-[0_0_28px_rgba(99,102,241,0.22)]",
        )}
        style={{ borderColor }}
      />

      <div
        className={clsx(
          "absolute inset-y-0 right-0 w-[28px] border-y border-r backdrop-blur-[1px]",
          toneClass,
        )}
        style={{
          borderColor,
          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        }}
      />

      <div
        className="absolute inset-y-0 left-0 w-[14px] opacity-90"
        style={{
          background: "rgba(0,0,0,0.12)",
          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        }}
      />

      <div className="relative z-[2] flex h-full min-w-0 items-center justify-between gap-3 px-4 pr-10 text-left">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black tracking-[0.01em] text-white">
            {label}
          </div>

          {!compactMode && startLabel && endLabel ? (
            <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/72">
              <span className="truncate">{startLabel}</span>
              <span className="text-white/45">→</span>
              <span className="truncate">{endLabel}</span>
            </div>
          ) : null}
        </div>

        <span className="shrink-0 rounded-full border border-white/16 bg-black/18 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
          sprint
        </span>
      </div>
    </button>
  );
}

function EventNode({
                     lane,
                     event,
                     signal,
                     isSelected,
                     onClick,
                     onContextMenu,
                     dayCount,
                     positionInDay,
                     compactMode,
                   }: {
  lane: SprintTimelineLane;
  event: SprintTimelineLane["events"][number];
  signal: TimelineSemaforo;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  dayCount: number;
  positionInDay: number;
  compactMode: boolean;
}) {
  const checklist = getChecklistProgress(event);

  const checkpointChainStatus =
    isOperationalCheckpoint(event)
      ? getCheckpointChainStatus(lane, getEventChainId(event))
      : null;

  const expectedCompletion = event.kind === "expected-completion" || isExpectedSystemCheckpoint(event);
  const validationRequested =
    event.kind === "validation" && isValidationRequested(event);
  const validation = event.kind === "validation";
  const validationResolvedTone =
    validation && !validationRequested
      ? event.validationResult === "approved"
        ? "ring-2 ring-emerald-400/85 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark"
        : event.validationResult === "rejected"
          ? "ring-2 ring-sky-400/85 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark"
          : "ring-2 ring-violet-400/55 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark"
      : "";
  const note = event.kind === "note";
  const participantNames = Array.from(
    new Set(
      (
        validation
          ? event.validators?.map((item) => item.name)
          : event.participants?.map((item) => item.name)
      )?.filter(Boolean) ?? [],
    ),
  );
  const hoverParticipantLabel = participantNames.length
    ? `${
        validation ? "Validatori" : "Partecipanti"
      }: ${participantNames.join(", ")}`
    : "";
  const actionLabel =
    validationRequested && (event.viewerCanValidate || event.viewerIsValidator)
      ? "Valida questo"
      : (event.kind === "block-update" || event.kind === "task-block") &&
          event.viewerIsParticipant
        ? "Sblocca questo"
        : isOperationalCheckpoint(event) &&
            checkpointChainStatus === "open" &&
            event.viewerIsParticipant
          ? "Completa questo"
          : "";

  const sizeClass = compactMode ? "h-5 w-5" : "h-6 w-6";

  return (
    <SprintTimelineEventHover
      event={event}
      signal={signal}
      placement="top"
      maxWidth="24rem"
      withConnector={true}
    >
      <div className="group relative">
        {actionLabel ? (
          <div
            className={clsx(
              "pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(15,23,42,0.18)]",
              signal === "purple"
                ? "animate-pulse border-violet-300/70 bg-violet-500/92 text-white"
                : signal === "red"
                  ? "animate-pulse border-rose-300/70 bg-rose-500/92 text-white"
                  : "animate-pulse border-amber-300/80 bg-amber-300/95 text-slate-950",
            )}
          >
            {actionLabel}
          </div>
        ) : null}

        {hoverParticipantLabel ? (
          <div className="pointer-events-none absolute left-1/2 z-[3] -translate-x-1/2 -translate-y-[calc(100%+38px)] whitespace-nowrap rounded-full border border-white/15 bg-[#0b1220]/96 px-2.5 py-1 text-[9px] font-semibold text-white opacity-0 shadow-[0_12px_28px_rgba(2,6,23,0.36)] transition-all duration-150 group-hover:-translate-y-[calc(100%+44px)] group-hover:animate-pulse group-hover:opacity-100">
            {hoverParticipantLabel}
          </div>
        ) : null}

        <button
          type="button"
          className={clsx(
            "relative rounded-full border-2 transition-all duration-200",
            sizeClass,
            compactMode
              ? "shadow-[0_8px_18px_rgba(15,23,42,0.14)]"
              : "shadow-[0_10px_20px_rgba(15,23,42,0.16)]",
            expectedCompletion
              ? "border-dashed border-orange-300 bg-orange-500/8 shadow-[0_0_0_1px_rgba(251,146,60,0.20),0_0_22px_rgba(251,146,60,0.18)]"
              : validationRequested
                ? "border-dashed border-violet-300 bg-violet-500/8 shadow-[0_0_0_1px_rgba(167,139,250,0.20),0_0_22px_rgba(167,139,250,0.18)]"
                : getSemaforoClasses(signal),
            isSelected ? "scale-110 ring-4 ring-primary/15" : "hover:scale-110",
            "group-hover:animate-pulse",
            actionLabel ? "animate-pulse" : "",
            validationResolvedTone,
            checkpointChainStatus === "completed"
              ? "ring-2 ring-emerald-400/85 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark"
              : "",
            checkpointChainStatus === "blocked"
              ? "ring-2 ring-rose-400/85 ring-offset-2 ring-offset-white dark:ring-offset-gray-dark"
              : "",
            note
              ? "after:absolute after:inset-[4px] after:rounded-full after:bg-white/90 dark:after:bg-gray-dark"
              : "",
          )}
          onClick={onClick}
          onContextMenu={onContextMenu}
          title={`${event.title} • ${
            event.kind === "validation"
              ? getValidationStatusLabel(event)
              : getEventKindLabel(event.kind)
          }`}
        >
          {expectedCompletion ? (
            <span className="absolute inset-[4px] rounded-full border border-orange-300/70" />
          ) : validationRequested ? (
            <span className="absolute inset-[4px] rounded-full border border-violet-300/70" />
          ) : null}

          {dayCount > 1 && positionInDay === 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-dark shadow-sm dark:bg-gray-dark dark:text-white">
              {dayCount}
            </span>
          ) : null}

          {checklist.total && !compactMode ? (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 text-[8px] font-bold text-dark shadow dark:bg-gray-dark dark:text-white">
              {checklist.done}/{checklist.total}
            </span>
          ) : null}

          <span className="sr-only">{event.title}</span>
        </button>
      </div>
    </SprintTimelineEventHover>
  );
}

function getMobileUnitWidth(unitWidth: number) {
  return Math.max(58, Math.min(76, unitWidth + 8));
}

function getMobileTimelineMinHeight(maxEventsInDay: number, expanded: boolean) {
  const rows = Math.max(1, Math.ceil(maxEventsInDay / 2));
  return 106 + (rows - 1) * 24 + (expanded ? 18 : 0);
}

export function SprintTimelineBoard({
  data,
  viewport,
  currentUserName,
  currentUserId,
  selection,
  selectedSegmentId,
  compactMode = false,
  onSelectionChange,
  onSegmentSelect,
  onCellQuickAdd,
  onOpenEvent,
  onDeleteEvent,
  onConfigureValidation,
}: {
  data: SprintTimelineBoardData;
  viewport: SprintTimelineViewport;
  currentUserName?: string;
  currentUserId?: string;
  selection: SprintTimelineSelection;
  selectedSegmentId?: string | null;
  compactMode?: boolean;
  onSelectionChange: (next: SprintTimelineSelection) => void;
  onSegmentSelect?: (segmentId: string | null) => void;
  onCellQuickAdd: (laneId: string, unitIndex: number) => void;
  onOpenEvent?: (laneId: string, eventId: string) => void;
  onDeleteEvent?: (laneId: string, eventId: string) => void;
  onConfigureValidation?: (laneId: string, eventId: string) => void;
}) {
  const [hoverLaneId, setHoverLaneId] = useState<string | null>(null);
  const [hoverColumnIndex, setHoverColumnIndex] = useState<number | null>(null);
  const [hoverSegmentId, setHoverSegmentId] = useState<string | null>(null);
  const [expandedLaneIds, setExpandedLaneIds] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState>(null);
  const viewer = useMemo<SprintTimelineViewer>(
    () => ({
      userId: currentUserId,
      userName: currentUserName,
    }),
    [currentUserId, currentUserName],
  );

  const mobileScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileScrollSyncingRef = useRef(false);
  const mobileScrollLeftRef = useRef(0);
  const desktopScrollerRef = useRef<HTMLDivElement | null>(null);
  const autoCenterKeyRef = useRef<string>("");

  const registerMobileScroller =
    (key: string) => (node: HTMLDivElement | null) => {
      if (node) {
        mobileScrollRefs.current[key] = node;
        node.scrollLeft = mobileScrollLeftRef.current;
      } else {
        delete mobileScrollRefs.current[key];
      }
    };

  const syncMobileScroll = (sourceKey: string, nextScrollLeft: number) => {
    mobileScrollLeftRef.current = nextScrollLeft;
    if (mobileScrollSyncingRef.current) return;

    mobileScrollSyncingRef.current = true;

    Object.entries(mobileScrollRefs.current).forEach(([key, node]) => {
      if (!node || key === sourceKey) return;
      if (Math.abs(node.scrollLeft - nextScrollLeft) < 1) return;
      node.scrollLeft = nextScrollLeft;
    });

    requestAnimationFrame(() => {
      mobileScrollSyncingRef.current = false;
    });
  };

  const leftColWidth = compactMode ? 248 : 372;
  const unitWidth = viewport.unitWidth;
  const mobileUnitWidth = useMemo(() => getMobileUnitWidth(unitWidth), [unitWidth]);
  const timelineWidth = viewport.columns.length * unitWidth;
  const mobileTimelineWidth = viewport.columns.length * mobileUnitWidth;
  const boardWidth = leftColWidth + timelineWidth;

  const monthGroups = useMemo(
    () => buildGroups(viewport, "monthKey", "monthLabel"),
    [viewport],
  );
  const weekGroups = useMemo(
    () => buildGroups(viewport, "weekKey", "weekLabel"),
    [viewport],
  );
  const visibleSprintLayers = useMemo(
    () => buildVisibleSprintLayers(data.segments, viewport),
    [data.segments, viewport],
  );

  const sprintLayerCount = Math.max(
    1,
    ...visibleSprintLayers.map((item) => item.layer + 1),
  );

  const sprintBandHeight = compactMode ? 46 : 54;
  const headerTopPads = compactMode
    ? { month: 0, week: 24 }
    : { month: 0, week: 28 };
  const sprintBaseTop = compactMode ? 52 : 46;
  const headerHeight = Math.max(
    compactMode ? 136 : 168,
    sprintBaseTop + sprintLayerCount * sprintBandHeight + 56,
  );

  const mobileSprintBandHeight = 40;
  const mobileSprintBaseTop = 42;
  const mobileSprintHeaderHeight = Math.max(
    118,
    mobileSprintBaseTop + sprintLayerCount * mobileSprintBandHeight + 18,
  );

  const gridTemplateColumns = useMemo(() => {
    return `${leftColWidth}px repeat(${viewport.columns.length}, minmax(${unitWidth}px, ${unitWidth}px))`;
  }, [leftColWidth, unitWidth, viewport.columns.length]);

  const headerSprintGridTemplate = useMemo(() => {
    return `repeat(${viewport.columns.length}, minmax(${unitWidth}px, ${unitWidth}px))`;
  }, [viewport.columns.length, unitWidth]);

  const mobileHeaderSprintGridTemplate = useMemo(() => {
    return `repeat(${viewport.columns.length}, minmax(${mobileUnitWidth}px, ${mobileUnitWidth}px))`;
  }, [viewport.columns.length, mobileUnitWidth]);

  const todayIndex = getTodayUnitIndex(
    data.sprint.startDate,
    data.sprint.endDate,
  );

  const todayX = getViewportTodayX(viewport, todayIndex);
  const mobileTodayX =
    todayIndex !== null &&
    todayIndex >= viewport.startIndex &&
    todayIndex < viewport.endIndex
      ? getUnitX(viewport.columns, mobileUnitWidth, todayIndex, "center")
      : null;

  useEffect(() => {
    const viewportKey = `${data.sprint.id}:${viewport.startIndex}:${viewport.endIndex}:${todayIndex}`;
    if (autoCenterKeyRef.current === viewportKey) return;
    autoCenterKeyRef.current = viewportKey;

    if (desktopScrollerRef.current && todayX !== null) {
      const node = desktopScrollerRef.current;
      const target = Math.max(
        0,
        Math.min(
          todayX - node.clientWidth / 2,
          Math.max(0, node.scrollWidth - node.clientWidth),
        ),
      );
      node.scrollLeft = target;
    }

    if (mobileTodayX !== null) {
      const mobileNodes = Object.values(mobileScrollRefs.current).filter(
        (node): node is HTMLDivElement => !!node,
      );

      if (mobileNodes.length) {
        const reference = mobileNodes[0];
        const target = Math.max(
          0,
          Math.min(
            mobileTodayX - reference.clientWidth / 2,
            Math.max(0, reference.scrollWidth - reference.clientWidth),
          ),
        );
        mobileScrollLeftRef.current = target;
        mobileNodes.forEach((node) => {
          node.scrollLeft = target;
        });
      }
    }
  }, [data.sprint.id, mobileTodayX, todayIndex, todayX, viewport.endIndex, viewport.startIndex]);

  const toggleLaneExpanded = (laneId: string) => {
    setExpandedLaneIds((current) => {
      const next = new Set(current);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  };

  const menuLane = useMemo(() => {
    if (!menu?.payload) return null;
    return data.lanes.find((lane) => lane.id === menu.payload.laneId) ?? null;
  }, [data.lanes, menu]);

  return (
    <>
      {/* MOBILE */}
      <div className="space-y-4 md:hidden">
        <div className="overflow-hidden rounded-[24px] border border-primary/15 bg-white/80 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/50">
          <div className="px-4 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
              Sprint overview
            </div>
            <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
              Scorri la timeline col dito
            </div>
            <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
              Vista touch-friendly con scroll sincronizzato.
            </div>
          </div>

          <div
            ref={registerMobileScroller("overview")}
            onScroll={(event) =>
              syncMobileScroll("overview", event.currentTarget.scrollLeft)
            }
            className="overflow-x-auto px-3 pb-3 pt-3 touch-pan-x overscroll-x-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div
              className={clsx("relative overflow-hidden rounded-[20px]", TIMELINE_TOP_SURFACE)}
              style={{
                width: mobileTimelineWidth,
                minWidth: mobileTimelineWidth,
                height: mobileSprintHeaderHeight,
              }}
            >
              {monthGroups.map((group) => (
                <div
                  key={`mobile-month-${group.key}`}
                  className={clsx("absolute h-5 px-2", TIMELINE_MONTH_BLOCK)}
                  style={{
                    top: 0,
                    left: group.startIndex * mobileUnitWidth,
                    width: (group.endIndex - group.startIndex) * mobileUnitWidth,
                  }}
                >
                  <div
                    className={clsx(
                      "truncate pt-1 text-[9px] font-semibold uppercase tracking-[0.16em]",
                      TIMELINE_MONTH_TEXT,
                    )}
                  >
                    {group.label}
                  </div>
                </div>
              ))}

              {weekGroups.map((group) => (
                <div
                  key={`mobile-week-${group.key}`}
                  className={clsx("absolute h-5 px-2", TIMELINE_WEEK_BLOCK)}
                  style={{
                    top: 18,
                    left: group.startIndex * mobileUnitWidth,
                    width: (group.endIndex - group.startIndex) * mobileUnitWidth,
                  }}
                >
                  <div
                    className={clsx(
                      "truncate pt-1 text-[9px] font-semibold uppercase tracking-[0.14em]",
                      TIMELINE_WEEK_TEXT,
                    )}
                  >
                    {group.label}
                  </div>
                </div>
              ))}

              {viewport.columns.map((column, index) => (
                <div
                  key={`mobile-overview-col-${column.id}`}
                  className={clsx("absolute bottom-0 top-0", TIMELINE_COLUMN_LINE)}
                  style={{ left: index * mobileUnitWidth, width: mobileUnitWidth }}
                >
                  <div className="flex h-full flex-col justify-end pb-2">
                    <div
                      className={clsx(
                        "text-center text-[9px] font-semibold uppercase tracking-wide",
                        TIMELINE_DAY_TOP_TEXT,
                      )}
                    >
                      {column.labelTop}
                    </div>
                    <div
                      className={clsx(
                        "px-1 text-center text-[10px] font-semibold",
                        TIMELINE_DAY_BOTTOM_TEXT,
                      )}
                    >
                      {column.labelBottom}
                    </div>
                  </div>
                </div>
              ))}

              <div
                className="absolute left-0 right-0 z-[12]"
                style={{
                  top: mobileSprintBaseTop,
                  height: sprintLayerCount * mobileSprintBandHeight,
                }}
              >
                {visibleSprintLayers.map((item) => {
                  const { segment, visibleStart, visibleEnd, layer, sourceIndex } =
                    item;

                  const active = selectedSegmentId === segment.id;
                  const tone = getSprintArrowTone(sourceIndex);

                  const arrowBorderColor =
                    sourceIndex % 4 === 0
                      ? "rgba(45,212,191,0.96)"
                      : sourceIndex % 4 === 1
                        ? "rgba(168,85,247,0.95)"
                        : sourceIndex % 4 === 2
                          ? "rgba(59,130,246,0.95)"
                          : "rgba(251,146,60,0.95)";

                  const startCol = visibleStart - viewport.startIndex + 1;
                  const endCol = visibleEnd - viewport.startIndex + 1;

                  return (
                    <div
                      key={`mobile-segment-${segment.id}`}
                      className="absolute left-0 right-0"
                      style={{
                        top: layer * mobileSprintBandHeight,
                        height: 34,
                      }}
                    >
                      <div
                        className="grid h-full"
                        style={{ gridTemplateColumns: mobileHeaderSprintGridTemplate }}
                      >
                        <div
                          style={{
                            gridColumn: `${startCol} / ${endCol}`,
                          }}
                        >
                          <SprintArrow
                            label={segment.label}
                            startLabel={formatDateOnly(segment.startDate)}
                            endLabel={formatDateOnly(segment.endDate)}
                            toneClass={tone}
                            borderColor={arrowBorderColor}
                            active={active}
                            hovered={false}
                            compactMode={true}
                            onClick={() =>
                              onSegmentSelect?.(active ? null : segment.id)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {mobileTodayX !== null ? (
                <div
                  className="absolute bottom-0 top-0 z-[15] pointer-events-none"
                  style={{ left: mobileTodayX }}
                >
                  <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_18px_rgba(0,224,168,0.35)]" />
                  <div className="absolute left-1/2 top-[6px] -translate-x-1/2">
                    <div className="rounded-full border border-primary/30 bg-[linear-gradient(135deg,rgba(0,224,168,0.95),rgba(15,118,110,0.88))] px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(0,224,168,0.24)]">
                      oggi
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {data.lanes.map((lane) => {
          const derived = deriveLaneState(lane, todayIndex ?? 0);
          const expanded = expandedLaneIds.has(lane.id);
          const isLaneSelected =
            selection?.kind === "lane" && selection.laneId === lane.id;
          const priorityMeta = getPriorityMeta(lane.priority);

          const firstRelevantIndex = getLaneFirstRelevantIndex(lane);
          const effectiveEndIndex = getLaneEffectiveEndIndex(
            lane,
            data.totalUnits,
          );
          const visualSegments = buildLaneVisualSegments(
            lane,
            data.totalUnits,
            todayIndex ?? 0,
          );

          const visibleEvents = lane.events.filter(
            (event) =>
              event.dateIndex >= viewport.startIndex &&
              event.dateIndex < viewport.endIndex,
          );

          const eventsByDay = new Map<number, typeof visibleEvents>();
          for (const event of visibleEvents) {
            const group = eventsByDay.get(event.dateIndex) ?? [];
            group.push(event);
            eventsByDay.set(event.dateIndex, group);
          }

          const maxEventsInDay = Math.max(
            1,
            ...Array.from(eventsByDay.values()).map((items) => items.length),
          );

          const mobileTimelineHeight = getMobileTimelineMinHeight(
            maxEventsInDay,
            expanded,
          );
          const mobileHeaderHeight = 44;
          const mobileSceneHeight = mobileHeaderHeight + mobileTimelineHeight;

          const positionedEvents = buildPositionedLaneEvents({
            lane,
            visibleEvents,
            eventsByDay,
            viewport,
            unitWidth: mobileUnitWidth,
            baseY: mobileTimelineHeight / 2,
            compactMode: true,
            expanded,
            todayIndex: todayIndex ?? 0,
          });

          const chainMap = positionedEvents.reduce<Map<string, typeof positionedEvents>>(
            (acc, item) => {
              const key = getEventChainId(item.event);
              const group = acc.get(key) ?? [];
              group.push(item);
              acc.set(key, group);
              return acc;
            },
            new Map(),
          );

          const preStartVisible =
            firstRelevantIndex > viewport.startIndex
              ? {
                left: 0,
                right:
                  firstRelevantIndex >= viewport.endIndex
                    ? viewport.columns.length * mobileUnitWidth
                    : getUnitX(
                      viewport.columns,
                      mobileUnitWidth,
                      firstRelevantIndex,
                      "start",
                    ),
              }
              : null;

          const openIso =
            lane.events.length > 0
              ? lane.events
                .slice()
                .sort((a, b) => a.dateIndex - b.dateIndex)[0]?.date
              : undefined;

          const endIso =
            lane.actualEnd ||
            lane.expectedEnd ||
            lane.events
              .slice()
              .sort((a, b) => a.dateIndex - b.dateIndex)
              .slice(-1)[0]?.date;

          const canOpenQuickAdd = canCreateLaneNote(
            lane,
            viewer,
          ) || canManageCheckpoint(
            lane,
            viewer,
          );

          return (
            <div
              key={`mobile-lane-${lane.id}`}
              className={clsx(
                "overflow-hidden rounded-[24px] border bg-white/80 shadow-sm backdrop-blur dark:bg-gray-dark/50",
                isLaneSelected
                  ? "border-primary/30 ring-2 ring-primary/12 dark:border-primary/40"
                  : "border-primary/15 dark:border-dark-3",
              )}
            >
              <div className="relative p-4">
                <div
                  className={clsx(
                    "absolute inset-y-4 left-0 w-1.5 rounded-r-full bg-gradient-to-b",
                    getSemaforoAccentClass(derived.signal),
                  )}
                />

                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectionChange({
                        kind: "lane",
                        laneId: lane.id,
                      })
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    {derived.viewerNeedsToAct && (
                      <div className="mb-2">
                        <LaneActionBadge
                          signal={derived.signal}
                          pulse
                          label={derived.signal === "orange" ? "In Ritardo" : "Azione Richiesta"}
                        />
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span
                        className={clsx(
                          "mt-1 h-3 w-3 rounded-full",
                          getSemaforoDotClasses(derived.signal),
                        )}
                      />
                      <ClampTitle
                        className="text-[15px] font-semibold leading-5 text-dark dark:text-white"
                        lines={2}
                      >
                        {lane.title}
                      </ClampTitle>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {derived.daysRemaining !== null && (
                        <span className="text-[10px] font-medium text-dark/40 dark:text-white/40">
                          {derived.daysRemaining > 0 
                            ? `mancano ${derived.daysRemaining} gg` 
                            : derived.daysRemaining === 0 
                              ? "scade oggi" 
                              : `ritardo ${Math.abs(derived.daysRemaining)} gg`}
                        </span>
                      )}
                    </div>

                    {lane.subtitle ? (
                      <div className="mt-1 text-xs text-dark/68 dark:text-white/68">
                        {lane.subtitle}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-1 text-[10px] font-semibold",
                          getSemaforoSurfaceClasses(derived.signal),
                        )}
                      >
                        {getSignalLabel(derived.signal)}
                      </span>

                      <span
                        className={clsx(
                          "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm",
                          priorityMeta.surfaceClass,
                        )}
                      >
                        {priorityMeta.label}
                      </span>

                      <span className="rounded-full border border-stroke px-2 py-1 text-[10px] text-dark/65 dark:border-dark-3 dark:text-white/65">
                        {getTaskTypeLabel(lane.taskType)}
                      </span>

                      {lane.ownerName ? (
                        <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                          {lane.ownerName}
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLaneExpanded(lane.id)}
                    className="shrink-0 self-start rounded-xl border border-stroke bg-white/70 px-3 py-2 text-xs font-semibold text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                    title={expanded ? "Comprimi task" : "Espandi task"}
                  >
                    {expanded ? "−" : "+"}
                  </button>
                </div>

                {expanded ? (
                  <div className="mt-4 space-y-3">
                    {lane.description ? (
                      <div className="rounded-2xl border border-stroke/60 bg-white/75 p-3 text-sm text-dark/75 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white/75">
                        {lane.description}
                      </div>
                    ) : null}

                    {lane.objectives ? (
                      <div className="rounded-2xl border border-primary/12 bg-primary/[0.05] p-3 text-sm text-dark/78 dark:text-white/78">
                        <span className="font-semibold">Obiettivi:</span>{" "}
                        {lane.objectives}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      <CompactStat
                        label="Aperto"
                        value={formatDateOnly(openIso)}
                      />
                      <CompactStat
                        label="Scadenza"
                        value={formatDateOnly(endIso)}
                      />
                      <CompactStat
                        label="Tempo"
                        value={formatElapsedDays(
                          derived.elapsedDays,
                          derived.signal === "green",
                        )}
                      />
                      <CompactStat
                        label="Vista"
                        value={currentUserName || "Generale"}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <CompactCounter
                        label="Aperti"
                        value={derived.openCheckpointCount}
                        tone="yellow"
                      />
                      <CompactCounter
                        label="Bloccati"
                        value={derived.blockedCheckpointCount}
                        tone="red"
                      />
                      <CompactCounter
                        label="Chiusi"
                        value={derived.completedCheckpointCount}
                        tone="green"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-stroke/60 px-3 py-3 dark:border-dark-3/60">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark/45 dark:text-white/45">
                    Timeline
                  </div>
                  {canOpenQuickAdd ? (
                    <div className="text-[11px] text-primary">
                      Tocca una colonna vuota per aggiungere
                    </div>
                  ) : null}
                </div>

                <div
                  ref={registerMobileScroller(`lane-${lane.id}`)}
                  onScroll={(event) =>
                    syncMobileScroll(`lane-${lane.id}`, event.currentTarget.scrollLeft)
                  }
                  className="overflow-x-auto touch-pan-x overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div
                    className={clsx("relative overflow-hidden rounded-[20px]", TIMELINE_TOP_SURFACE)}
                    style={{
                      width: mobileTimelineWidth,
                      minWidth: mobileTimelineWidth,
                      height: mobileSceneHeight,
                    }}
                  >
                    {viewport.columns.map((column, columnIndex) => (
                      <div
                        key={`mobile-day-${lane.id}-${column.id}`}
                        className={clsx(
                          "absolute top-0 bottom-0 z-[1]",
                          TIMELINE_COLUMN_LINE,
                          canOpenQuickAdd
                            ? "cursor-pointer active:bg-primary/[0.04] dark:active:bg-white/[0.04]"
                            : "",
                        )}
                        style={{
                          left: columnIndex * mobileUnitWidth,
                          width: mobileUnitWidth,
                        }}
                        onClick={() => {
                          if (!canOpenQuickAdd) return;
                          onCellQuickAdd(lane.id, column.centerIndex);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMenu({
                            x: event.clientX,
                            y: event.clientY,
                            payload: {
                              kind: "day",
                              laneId: lane.id,
                              unitIndex: column.centerIndex,
                              isoDate: getIsoDateForUnitIndex(
                                data.sprint.startDate?.slice(0, 10),
                                column.centerIndex,
                              ),
                            },
                          });
                        }}
                        title={
                          canOpenQuickAdd ? "Tocca per aggiungere un evento" : undefined
                        }
                      >
                        <div className={clsx("flex h-11 flex-col items-center justify-center", TIMELINE_HEADER_BOTTOM_LINE)}>
                          <div
                            className={clsx(
                              "text-center text-[9px] font-semibold uppercase tracking-wide",
                              TIMELINE_DAY_TOP_TEXT,
                            )}
                          >
                            {column.labelTop}
                          </div>
                          <div
                            className={clsx(
                              "px-1 text-center text-[11px] font-semibold",
                              TIMELINE_DAY_BOTTOM_TEXT,
                            )}
                          >
                            {column.labelBottom}
                          </div>
                        </div>
                      </div>
                    ))}

                    {mobileTodayX !== null ? (
                      <div
                        className="absolute bottom-0 top-0 z-[4] pointer-events-none"
                        style={{ left: mobileTodayX }}
                      >
                        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary/90 shadow-[0_0_12px_rgba(0,224,168,0.34)]" />
                      </div>
                    ) : null}

                    <div
                      className="absolute left-0 right-0 z-[2] pointer-events-none"
                      style={{
                        top: mobileHeaderHeight,
                        height: mobileTimelineHeight,
                      }}
                    >
                      {preStartVisible && preStartVisible.right > preStartVisible.left ? (
                        <div
                          className="absolute inset-y-0 z-[1] border-r border-slate-400/15 bg-slate-400/[0.05] dark:bg-white/[0.03]"
                          style={{
                            left: preStartVisible.left,
                            width: preStartVisible.right - preStartVisible.left,
                          }}
                        >
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(15,23,42,0.06)_10px,rgba(15,23,42,0.06)_20px)] dark:bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(255,255,255,0.04)_10px,rgba(255,255,255,0.04)_20px)]" />
                          <div className="absolute right-2 top-2 rounded-full border border-slate-400/20 bg-slate-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-white/60">
                            pre-avvio
                          </div>
                        </div>
                      ) : null}

                      {visualSegments.map((segment, index) => {
                        const visibleStart = Math.max(
                          segment.startIndex,
                          viewport.startIndex,
                        );
                        const visibleEnd = Math.min(
                          segment.endIndex,
                          viewport.endIndex,
                        );
                        if (visibleStart >= visibleEnd) return null;

                        const left = getUnitX(
                          viewport.columns,
                          mobileUnitWidth,
                          visibleStart,
                          "start",
                        );
                        const right = getUnitX(
                          viewport.columns,
                          mobileUnitWidth,
                          visibleEnd - 1,
                          "end",
                        );
                        const width = Math.max(0, right - left);
                        const classes = getSegmentClasses(segment.tone);

                        if (segment.dashed) {
                          return (
                            <div
                              key={`${lane.id}-mobile-seg-${index}`}
                              className={clsx(
                                "absolute top-1/2 h-0 -translate-y-1/2 border-t-[3px] border-dashed",
                                classes.dashed,
                              )}
                              style={{ left, width }}
                              title={segment.description}
                            />
                          );
                        }

                        return (
                          <div
                            key={`${lane.id}-mobile-seg-${index}`}
                            className={clsx(
                              "absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full",
                              classes.solid,
                            )}
                            style={{ left, width }}
                            title={segment.description}
                          />
                        );
                      })}

                      <svg
                        className="absolute inset-0"
                        width={mobileTimelineWidth}
                        height={mobileTimelineHeight}
                        viewBox={`0 0 ${mobileTimelineWidth} ${mobileTimelineHeight}`}
                        fill="none"
                      >
                        {Array.from(chainMap.entries()).map(([chainId, items]) => {
                          if (items.length < 2) return null;
                          const sortedItems = [...items].sort(
                            (a, b) => a.event.dateIndex - b.event.dateIndex,
                          );
                          return sortedItems.slice(1).map((current, index) => {
                            const previous = sortedItems[index];
                            const stroke = connectorColor(current.signal);
                            const dx = Math.max(
                              24,
                              Math.abs(current.x - previous.x) * 0.35,
                            );
                            const path = `M ${previous.x} ${previous.y} C ${
                              previous.x + dx
                            } ${previous.y}, ${current.x - dx} ${
                              current.y
                            }, ${current.x} ${current.y}`;
                            return (
                              <path
                                key={`${chainId}-${current.event.id}`}
                                d={path}
                                stroke={stroke}
                                strokeWidth="2"
                                strokeDasharray="7 6"
                                opacity="0.84"
                              />
                            );
                          });
                        })}
                      </svg>

                      {effectiveEndIndex >= viewport.startIndex &&
                      effectiveEndIndex < viewport.endIndex ? (
                        <div
                          className="absolute z-[7] -translate-y-1/2"
                          style={{
                            top: mobileTimelineHeight / 2,
                            left: getUnitX(
                              viewport.columns,
                              mobileUnitWidth,
                              effectiveEndIndex,
                              "end",
                            ),
                          }}
                        >
                          <div className="h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-primary/65" />
                        </div>
                      ) : null}
                    </div>

                    {positionedEvents.map(
                      ({ event, x, y, signal, dayCount, positionInDay }) => {
                        const isSelected =
                          selection?.kind === "event" &&
                          selection.laneId === lane.id &&
                          selection.eventId === event.id;

                        return (
                          <div
                            key={`mobile-event-${event.id}`}
                            className="absolute z-10 pointer-events-auto"
                            style={{
                              left: x,
                              top: mobileHeaderHeight + y,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            <EventNode
                              lane={lane}
                              event={event}
                              signal={signal}
                              isSelected={isSelected}
                              dayCount={dayCount}
                              positionInDay={positionInDay}
                              compactMode={true}
                              onClick={() => {
                                onSelectionChange({
                                  kind: "event",
                                  laneId: lane.id,
                                  eventId: event.id,
                                });
                                onOpenEvent?.(lane.id, event.id);
                              }}
                              onContextMenu={(contextEvent) => {
                                contextEvent.preventDefault();
                                setMenu({
                                  x: contextEvent.clientX,
                                  y: contextEvent.clientY,
                                  payload: {
                                    kind: "event",
                                    laneId: lane.id,
                                    unitIndex: event.dateIndex,
                                    eventId: event.id,
                                    isoDate: event.date?.slice(0, 10),
                                  },
                                });
                              }}
                            />
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="relative isolate w-full min-w-0 max-w-full overflow-hidden">
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[28px] border border-primary/15 bg-white/70 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40">
            <div
              ref={desktopScrollerRef}
              className="max-w-full overflow-x-auto overflow-y-hidden"
            >
              <div
                className="relative"
                style={{ width: boardWidth, minWidth: boardWidth, maxWidth: boardWidth }}
              >
                <div
                  className="sticky top-0 z-20 grid border-b border-stroke/60 dark:border-white/8"
                  style={{ gridTemplateColumns, minHeight: headerHeight }}
                >
                  <div className={clsx("sticky left-0 z-50", TASK_COLUMN_HEADER_GLASS)}>
                    <div className="relative h-full p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark/45 dark:text-white/45">
                        Task column
                      </div>
                      <div className="mt-2 text-sm font-semibold text-dark dark:text-white">
                        Stato operativo in evidenza, priorità forte, dettagli puliti.
                      </div>
                      <div className="mt-2 text-xs text-dark/58 dark:text-white/58">
                        Timeline su giorni reali, sprint sovrapposti leggibili, board
                        contenuta nel layout.
                      </div>

                      <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-px bg-black/10 dark:bg-white/10" />
                      <div className={TASK_COLUMN_EDGE_HEADER} />
                    </div>
                  </div>

                  <div
                    className={clsx("relative z-[1] overflow-hidden", TIMELINE_TOP_SURFACE)}
                    style={{ gridColumn: "2 / -1", height: headerHeight }}
                  >
                    {monthGroups.map((group) => (
                      <div
                        key={group.key}
                        className={clsx("absolute h-7 px-3", TIMELINE_MONTH_BLOCK)}
                        style={{
                          top: headerTopPads.month,
                          left: group.startIndex * unitWidth,
                          width: (group.endIndex - group.startIndex) * unitWidth,
                        }}
                      >
                        <div
                          className={clsx(
                            "truncate pt-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                            TIMELINE_MONTH_TEXT,
                          )}
                        >
                          {group.label}
                        </div>
                      </div>
                    ))}

                    {weekGroups.map((group) => (
                      <div
                        key={group.key}
                        className={clsx("absolute h-6 px-3", TIMELINE_WEEK_BLOCK)}
                        style={{
                          top: headerTopPads.week,
                          left: group.startIndex * unitWidth,
                          width: (group.endIndex - group.startIndex) * unitWidth,
                        }}
                      >
                        <div
                          className={clsx(
                            "truncate pt-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                            TIMELINE_WEEK_TEXT,
                          )}
                        >
                          {group.label}
                        </div>
                      </div>
                    ))}

                    {viewport.columns.map((column, index) => (
                      <div
                        key={column.id}
                        className={clsx("absolute bottom-0 top-0", TIMELINE_COLUMN_LINE)}
                        style={{ left: index * unitWidth, width: unitWidth }}
                      >
                        <div className="flex h-full flex-col justify-end pb-2">
                          <div
                            className={clsx(
                              "text-center text-[10px] font-semibold uppercase tracking-wide",
                              TIMELINE_DAY_TOP_TEXT,
                            )}
                          >
                            {column.labelTop}
                          </div>
                          <div
                            className={clsx(
                              "px-2 text-center text-[11px] font-semibold",
                              TIMELINE_DAY_BOTTOM_TEXT,
                            )}
                          >
                            {column.labelBottom}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div
                      className="absolute left-0 right-0 z-[12]"
                      style={{
                        top: sprintBaseTop,
                        height: sprintLayerCount * sprintBandHeight,
                      }}
                    >
                      {visibleSprintLayers.map((item) => {
                        const { segment, visibleStart, visibleEnd, layer, sourceIndex } =
                          item;

                        const active = selectedSegmentId === segment.id;
                        const hovered = hoverSegmentId === segment.id;
                        const tone = getSprintArrowTone(sourceIndex);

                        const arrowBorderColor =
                          sourceIndex % 4 === 0
                            ? "rgba(45,212,191,0.96)"
                            : sourceIndex % 4 === 1
                              ? "rgba(168,85,247,0.95)"
                              : sourceIndex % 4 === 2
                                ? "rgba(59,130,246,0.95)"
                                : "rgba(251,146,60,0.95)";

                        const startLabel = formatDateOnly(segment.startDate);
                        const endLabel = formatDateOnly(segment.endDate);

                        const startCol = visibleStart - viewport.startIndex + 1;
                        const endCol = visibleEnd - viewport.startIndex + 1;

                        return (
                          <div
                            key={segment.id}
                            className="absolute left-0 right-0"
                            style={{
                              top: layer * sprintBandHeight,
                              height: compactMode ? 40 : 46,
                            }}
                            onMouseEnter={() => setHoverSegmentId(segment.id)}
                            onMouseLeave={() =>
                              setHoverSegmentId((current) =>
                                current === segment.id ? null : current,
                              )
                            }
                          >
                            <div
                              className="grid h-full"
                              style={{ gridTemplateColumns: headerSprintGridTemplate }}
                            >
                              <div
                                style={{
                                  gridColumn: `${startCol} / ${endCol}`,
                                }}
                              >
                                <HoverPopover
                                  content={<SegmentHoverCard segment={segment} />}
                                  placement="top"
                                  fullWidth={true}
                                >
                                  <SprintArrow
                                    label={segment.label}
                                    startLabel={startLabel}
                                    endLabel={endLabel}
                                    toneClass={tone}
                                    borderColor={arrowBorderColor}
                                    active={active}
                                    hovered={hovered}
                                    compactMode={compactMode}
                                    onClick={() =>
                                      onSegmentSelect?.(active ? null : segment.id)
                                    }
                                  />
                                </HoverPopover>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {todayX !== null ? (
                      <div className="absolute bottom-0 top-0 z-[15]" style={{ left: todayX }}>
                        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_18px_rgba(0,224,168,0.35)]" />
                        <div className="absolute left-1/2 top-[6px] -translate-x-1/2">
                          <div className="rounded-full border border-primary/30 bg-[linear-gradient(135deg,rgba(0,224,168,0.95),rgba(15,118,110,0.88))] px-3 py-1 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(0,224,168,0.24)]">
                            oggi
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="divide-y divide-stroke/70 dark:divide-dark-3/70">
                  {data.lanes.map((lane) => {
                    const derived = deriveLaneState(lane, todayIndex ?? 0, viewer);
                    const isLaneHovered = hoverLaneId === lane.id;
                    const isLaneSelected =
                      selection?.kind === "lane" && selection.laneId === lane.id;
                    const expanded = expandedLaneIds.has(lane.id);
                    const minHeight = rowMinHeight(expanded, compactMode);
                    const priorityMeta = getPriorityMeta(lane.priority);

                    const firstRelevantIndex = getLaneFirstRelevantIndex(lane);
                    const effectiveEndIndex = getLaneEffectiveEndIndex(
                      lane,
                      data.totalUnits,
                    );
                    const visualSegments = buildLaneVisualSegments(
                      lane,
                      data.totalUnits,
                      todayIndex ?? 0,
                    );

                    const visibleEvents = lane.events.filter(
                      (event) =>
                        event.dateIndex >= viewport.startIndex &&
                        event.dateIndex < viewport.endIndex,
                    );

                    const eventsByDay = new Map<number, typeof visibleEvents>();
                    for (const event of visibleEvents) {
                      const group = eventsByDay.get(event.dateIndex) ?? [];
                      group.push(event);
                      eventsByDay.set(event.dateIndex, group);
                    }

                    const positionedEvents = buildPositionedLaneEvents({
                      lane,
                      visibleEvents,
                      eventsByDay,
                      viewport,
                      unitWidth,
                      baseY: minHeight / 2,
                      compactMode,
                      expanded,
                      todayIndex: todayIndex ?? 0,
                    });

                    const chainMap = positionedEvents.reduce<
                      Map<string, typeof positionedEvents>
                    >((acc, item) => {
                      const key = getEventChainId(item.event);
                      const group = acc.get(key) ?? [];
                      group.push(item);
                      acc.set(key, group);
                      return acc;
                    }, new Map());

                    const preStartVisible =
                      firstRelevantIndex > viewport.startIndex
                        ? {
                          left: 0,
                          right:
                            firstRelevantIndex >= viewport.endIndex
                              ? viewport.columns.length * unitWidth
                              : getUnitX(
                                viewport.columns,
                                unitWidth,
                                firstRelevantIndex,
                                "start",
                              ),
                        }
                        : null;

                    const openIso =
                      lane.events.length > 0
                        ? lane.events
                          .slice()
                          .sort((a, b) => a.dateIndex - b.dateIndex)[0]?.date
                        : undefined;

                    const endIso =
                      lane.actualEnd ||
                      lane.expectedEnd ||
                      lane.events
                        .slice()
                        .sort((a, b) => a.dateIndex - b.dateIndex)
                        .slice(-1)[0]?.date;

                    const canOpenQuickAdd = canCreateLaneNote(
                      lane,
                      viewer,
                    ) || canManageCheckpoint(
                      lane,
                      viewer,
                    );

                    return (
                      <div
                        key={lane.id}
                        className={clsx(
                          "grid",
                          isLaneHovered || isLaneSelected
                            ? "bg-primary/[0.03] dark:bg-primary/[0.06]"
                            : "",
                        )}
                        style={{ gridTemplateColumns, minHeight }}
                        onMouseEnter={() => setHoverLaneId(lane.id)}
                        onMouseLeave={() => {
                          setHoverLaneId((current) =>
                            current === lane.id ? null : current,
                          );
                          setHoverColumnIndex(null);
                        }}
                      >
                        <div className={clsx("sticky left-0 z-40", TASK_COLUMN_ROW_GLASS)}>
                          <div className={clsx("relative h-full", compactMode ? "p-3" : "p-4")}>
                            <div
                              className={clsx(
                                "absolute inset-y-3 left-0 w-1.5 rounded-r-full bg-gradient-to-b",
                                getSemaforoAccentClass(derived.signal),
                              )}
                            />

                            <HoverPopover
                              content={<TaskHoverCard lane={lane} signal={derived.signal} />}
                              placement="right"
                              maxWidth="24rem"
                            >
                              <div className="min-w-0">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectionChange({
                                        kind: "lane",
                                        laneId: lane.id,
                                      })
                                    }
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span
                                        className={clsx(
                                          "mt-1 h-3 w-3 rounded-full",
                                          getSemaforoDotClasses(derived.signal),
                                        )}
                                      />
                                      <ClampTitle
                                        className={clsx(
                                          "font-semibold leading-[1.3] text-dark dark:text-white",
                                          compactMode ? "text-[13px]" : "text-sm",
                                        )}
                                        lines={compactMode ? 2 : 3}
                                      >
                                        {lane.title}
                                      </ClampTitle>
                                    </div>

                                    <div className="mt-2 flex items-center gap-3">
                                      {derived.viewerNeedsToAct && (
                                        <LaneActionBadge 
                                          signal={derived.signal} 
                                          pulse 
                                          label={derived.signal === "orange" ? "In Ritardo" : "Azione Richiesta"} 
                                        />
                                      )}
                                      {derived.daysRemaining !== null && (
                                        <span className="text-[11px] font-medium text-dark/40 dark:text-white/40 italic">
                                          {derived.daysRemaining > 0 
                                            ? `mancano ${derived.daysRemaining} gg` 
                                            : derived.daysRemaining === 0 
                                              ? "chiusura oggi" 
                                              : `ritardo ${Math.abs(derived.daysRemaining)} gg`}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <span
                                        className={clsx(
                                          "rounded-full border px-2 py-1 text-[10px] font-semibold",
                                          getSemaforoSurfaceClasses(derived.signal),
                                        )}
                                      >
                                        {getSignalLabel(derived.signal)}
                                      </span>

                                      {!compactMode ? (
                                        <span
                                          className={clsx(
                                            "rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm",
                                            priorityMeta.surfaceClass,
                                          )}
                                        >
                                          {priorityMeta.label}
                                        </span>
                                      ) : null}

                                      {!compactMode ? (
                                        <span className="rounded-full border border-stroke px-2 py-1 text-[10px] text-dark/65 dark:border-dark-3 dark:text-white/65">
                                          {getTaskTypeLabel(lane.taskType)}
                                        </span>
                                      ) : null}

                                      {lane.ownerName && !compactMode ? (
                                        <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                                          Owner: {lane.ownerName}
                                        </span>
                                      ) : null}

                                      {lane.referenteName && !compactMode ? (
                                        <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-700 dark:text-violet-200">
                                          Rev: {lane.referenteName}
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleLaneExpanded(lane.id)}
                                    className="shrink-0 self-start rounded-xl border border-stroke bg-white/70 px-2.5 py-2 text-xs font-semibold text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                                    title={expanded ? "Comprimi task" : "Espandi task"}
                                  >
                                    {expanded ? "−" : "+"}
                                  </button>
                                </div>

                                {expanded ? (
                                  <div className="mt-4 space-y-3">
                                    {lane.subtitle ? (
                                      <div className="text-sm text-dark/70 dark:text-white/70">
                                        {lane.subtitle}
                                      </div>
                                    ) : null}

                                    {lane.description ? (
                                      <div className="rounded-2xl border border-stroke/60 bg-white/75 p-3 text-sm text-dark/75 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white/75">
                                        {lane.description}
                                      </div>
                                    ) : null}

                                    {lane.objectives ? (
                                      <div className="rounded-2xl border border-primary/12 bg-primary/[0.05] p-3 text-sm text-dark/78 dark:text-white/78">
                                        <span className="font-semibold">Obiettivi:</span>{" "}
                                        {lane.objectives}
                                      </div>
                                    ) : null}

                                    <div
                                      className={clsx(
                                        "grid gap-2",
                                        compactMode ? "grid-cols-2" : "grid-cols-3",
                                      )}
                                    >
                                      <CompactStat
                                        label="Aperto"
                                        value={formatDateOnly(openIso)}
                                      />
                                      <CompactStat
                                        label="Scadenza"
                                        value={formatDateOnly(endIso)}
                                      />
                                      {!compactMode ? (
                                        <CompactStat
                                          label="Tempo"
                                          value={formatElapsedDays(
                                            derived.elapsedDays,
                                            derived.signal === "green",
                                          )}
                                        />
                                      ) : null}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <CompactCounter
                                        label="Aperti"
                                        value={derived.openCheckpointCount}
                                        tone="yellow"
                                      />
                                      <CompactCounter
                                        label="Bloccati"
                                        value={derived.blockedCheckpointCount}
                                        tone="red"
                                      />
                                      <CompactCounter
                                        label="Chiusi"
                                        value={derived.completedCheckpointCount}
                                        tone="green"
                                      />
                                    </div>

                                    {currentUserName ? (
                                      <div className="text-xs text-dark/55 dark:text-white/55">
                                        Vista come{" "}
                                        <span className="font-semibold">
                                          {currentUserName}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </HoverPopover>

                            <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-px bg-black/8 dark:bg-white/8" />
                            <div className={TASK_COLUMN_EDGE_ROW} />
                          </div>
                        </div>

                        <div className="relative z-[1] overflow-hidden" style={{ gridColumn: "2 / -1" }}>
                          <div className="relative h-full" style={{ minHeight }}>
                            {todayX !== null ? (
                              <div className="absolute bottom-0 top-0 z-[4]" style={{ left: todayX }}>
                                <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary/85 shadow-[0_0_10px_rgba(0,224,168,0.24)]" />
                              </div>
                            ) : null}

                            {viewport.columns.map((column, columnIndex) => {
                              const isHoveredCell =
                                isLaneHovered && hoverColumnIndex === columnIndex;
                              return (
                                <div
                                  key={column.id}
                                  className={clsx(
                                    "absolute bottom-0 top-0 border-l border-stroke/30 dark:border-dark-3/40",
                                    isHoveredCell
                                      ? "bg-primary/[0.04] dark:bg-primary/[0.08]"
                                      : "",
                                  )}
                                  style={{ left: columnIndex * unitWidth, width: unitWidth }}
                                  onMouseEnter={() => setHoverColumnIndex(columnIndex)}
                                  onContextMenu={(event) => {
                                    event.preventDefault();
                                    setMenu({
                                      x: event.clientX,
                                      y: event.clientY,
                                      payload: {
                                        kind: "day",
                                        laneId: lane.id,
                                        unitIndex: column.centerIndex,
                                        isoDate: getIsoDateForUnitIndex(
                                          data.sprint.startDate?.slice(0, 10),
                                          column.centerIndex,
                                        ),
                                      },
                                    });
                                  }}
                                >
                                  {isHoveredCell && canOpenQuickAdd ? (
                                    <button
                                      type="button"
                                      className={clsx(
                                        "absolute left-1/2 z-[20] inline-flex -translate-x-1/2 items-center justify-center rounded-full border border-primary/20 bg-white/85 font-semibold text-primary shadow-[0_0_18px_rgba(0,224,168,0.18)] backdrop-blur hover:scale-105 hover:bg-primary/10",
                                        compactMode
                                          ? "top-3 h-7 w-7 text-sm"
                                          : "top-4 h-8 w-8 text-base",
                                      )}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onCellQuickAdd(lane.id, column.centerIndex);
                                      }}
                                      title="Nuovo evento qui"
                                    >
                                      +
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}

                            {preStartVisible && preStartVisible.right > preStartVisible.left ? (
                              <div
                                className="absolute inset-y-0 z-[1] border-r border-slate-400/15 bg-slate-400/[0.05] dark:bg-white/[0.03]"
                                style={{
                                  left: preStartVisible.left,
                                  width: preStartVisible.right - preStartVisible.left,
                                }}
                              >
                                <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(15,23,42,0.06)_10px,rgba(15,23,42,0.06)_20px)] dark:bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(255,255,255,0.04)_10px,rgba(255,255,255,0.04)_20px)]" />
                                <div className="absolute right-2 top-2 rounded-full border border-slate-400/20 bg-slate-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-white/60">
                                  pre-avvio
                                </div>
                              </div>
                            ) : null}

                            {visualSegments.map((segment, index) => {
                              const visibleStart = Math.max(
                                segment.startIndex,
                                viewport.startIndex,
                              );
                              const visibleEnd = Math.min(
                                segment.endIndex,
                                viewport.endIndex,
                              );
                              if (visibleStart >= visibleEnd) return null;

                              const left = getUnitX(
                                viewport.columns,
                                unitWidth,
                                visibleStart,
                                "start",
                              );
                              const right = getUnitX(
                                viewport.columns,
                                unitWidth,
                                visibleEnd - 1,
                                "end",
                              );
                              const width = Math.max(0, right - left);
                              const classes = getSegmentClasses(segment.tone);

                              if (segment.dashed) {
                                return (
                                  <div
                                    key={`${lane.id}-seg-${index}`}
                                    className={clsx(
                                      "absolute top-1/2 h-0 -translate-y-1/2 border-t-[3px] border-dashed",
                                      classes.dashed,
                                    )}
                                    style={{ left, width }}
                                    title={segment.description}
                                  />
                                );
                              }

                              return (
                                <div
                                  key={`${lane.id}-seg-${index}`}
                                  className={clsx(
                                    "absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full",
                                    classes.solid,
                                  )}
                                  style={{ left, width }}
                                  title={segment.description}
                                />
                              );
                            })}

                            <svg
                              className="pointer-events-none absolute inset-0 z-[6]"
                              width={viewport.columns.length * unitWidth}
                              height={minHeight}
                              viewBox={`0 0 ${viewport.columns.length * unitWidth} ${minHeight}`}
                              fill="none"
                            >
                              {Array.from(chainMap.entries()).map(([chainId, items]) => {
                                if (items.length < 2) return null;
                                const sortedItems = [...items].sort(
                                  (a, b) => a.event.dateIndex - b.event.dateIndex,
                                );
                                return sortedItems.slice(1).map((current, index) => {
                                  const previous = sortedItems[index];
                                  const stroke = connectorColor(current.signal);
                                  const dx = Math.max(
                                    26,
                                    Math.abs(current.x - previous.x) * 0.35,
                                  );
                                  const path = `M ${previous.x} ${previous.y} C ${
                                    previous.x + dx
                                  } ${previous.y}, ${current.x - dx} ${
                                    current.y
                                  }, ${current.x} ${current.y}`;
                                  return (
                                    <path
                                      key={`${chainId}-${current.event.id}`}
                                      d={path}
                                      stroke={stroke}
                                      strokeWidth="2"
                                      strokeDasharray="7 6"
                                      opacity="0.84"
                                    />
                                  );
                                });
                              })}
                            </svg>

                            {positionedEvents.map(
                              ({ event, x, y, signal, dayCount, positionInDay }) => {
                                const isSelected =
                                  selection?.kind === "event" &&
                                  selection.laneId === lane.id &&
                                  selection.eventId === event.id;

                                return (
                                  <div
                                    key={event.id}
                                    className="absolute z-10"
                                    style={{
                                      left: x,
                                      top: y,
                                      transform: "translate(-50%, -50%)",
                                    }}
                                  >
                                    <EventNode
                                      lane={lane}
                                      event={event}
                                      signal={signal}
                                      isSelected={isSelected}
                                      dayCount={dayCount}
                                      positionInDay={positionInDay}
                                      compactMode={compactMode}
                                      onClick={() => {
                                        onSelectionChange({
                                          kind: "event",
                                          laneId: lane.id,
                                          eventId: event.id,
                                        });
                                        onOpenEvent?.(lane.id, event.id);
                                      }}
                                      onContextMenu={(contextEvent) => {
                                        contextEvent.preventDefault();
                                        setMenu({
                                          x: contextEvent.clientX,
                                          y: contextEvent.clientY,
                                          payload: {
                                            kind: "event",
                                            laneId: lane.id,
                                            unitIndex: event.dateIndex,
                                            eventId: event.id,
                                            isoDate: event.date?.slice(0, 10),
                                          },
                                        });
                                      }}
                                    />
                                  </div>
                                );
                              },
                            )}

                            {derived.expectedEndIndex !== undefined &&
                            derived.expectedEndIndex >= viewport.startIndex &&
                            derived.expectedEndIndex < viewport.endIndex && (
                              <div
                                className="absolute top-1/2 z-[7] -translate-y-1/2"
                                style={{
                                  left: getUnitX(
                                    viewport.columns,
                                    unitWidth,
                                    derived.expectedEndIndex,
                                    "center",
                                  ),
                                }}
                              >
                                <div className="h-4 w-4 rounded-full border-2 border-orange-400 bg-transparent shadow-[0_0_8px_rgba(251,146,60,0.3)]" title="Scadenza (Target)" />
                              </div>
                            )}

                            {effectiveEndIndex >= viewport.startIndex &&
                            effectiveEndIndex < viewport.endIndex ? (
                              <div
                                className="absolute top-1/2 z-[7] -translate-y-1/2"
                                style={{
                                  left: getUnitX(
                                    viewport.columns,
                                    unitWidth,
                                    effectiveEndIndex,
                                    "end",
                                  ),
                                }}
                              >
                                <div className="h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-primary/65" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SprintTimelineContextMenu
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        payload={menu?.payload ?? null}
        lane={menuLane}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        onClose={() => setMenu(null)}
        onCreateEvent={onCellQuickAdd}
        onOpenEvent={onOpenEvent}
        onDeleteEvent={onDeleteEvent}
        onConfigureValidation={onConfigureValidation}
      />
    </>
  );
}

function CompactStat({
                       label,
                       value,
                     }: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke/60 bg-white/75 px-2.5 py-2 dark:border-dark-3 dark:bg-gray-dark/45">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark/45 dark:text-white/45">
        {label}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-dark dark:text-white">
        {value || "—"}
      </div>
    </div>
  );
}

function CompactCounter({
                          label,
                          value,
                          tone,
                        }: {
  label: string;
  value: number;
  tone: TimelineSemaforo;
}) {
  return (
    <div className="rounded-2xl border border-stroke/60 bg-white/75 px-2.5 py-2 dark:border-dark-3 dark:bg-gray-dark/45">
      <div className="flex items-center gap-1.5">
        <span className={clsx("h-2 w-2 rounded-full", getSemaforoDotClasses(tone))} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark/45 dark:text-white/45">
          {label}
        </div>
      </div>
      <div className="mt-1 text-[13px] font-bold text-dark dark:text-white">
        {value}
      </div>
    </div>
  );
}
