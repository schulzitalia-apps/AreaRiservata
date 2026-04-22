
"use client";

import React, { useMemo, useRef, useState } from "react";
import FloatingPortal from "@/components/AtlasModuli/Calendario/Tools/FloatingPortal";
import { Popover } from "@/components/ui/Popover";
import type { SprintTimelineEvent, TimelineSemaforo } from "./SprintTimeline.types";
import {
  formatDateTime,
  getChecklistProgress,
  getEventKindLabel,
  getSemaforoDotClasses,
} from "./SprintTimeline.helpers";

type Placement = "top" | "bottom" | "left" | "right";

export default function SprintTimelineEventHover({
  event,
  signal,
  placement = "top",
  maxWidth = "22rem",
  className,
  children,
  withConnector = false,
}: {
  event: SprintTimelineEvent;
  signal?: TimelineSemaforo;
  placement?: Placement;
  maxWidth?: string;
  className?: string;
  children: React.ReactNode;
  withConnector?: boolean;
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

  const checklist = getChecklistProgress(event);
  const actorNames = useMemo(() => {
    const names =
      event.kind === "validation"
        ? event.validators?.map((item) => item.name).filter(Boolean)
        : event.participants?.map((item) => item.name).filter(Boolean);
    return Array.from(new Set(names ?? []));
  }, [event]);

  const body = useMemo(
    () => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${getSemaforoDotClasses(signal ?? event.color)}`} />
          <div className="truncate text-sm font-semibold text-dark dark:text-white">
            {event.title}
          </div>
        </div>

        <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
          {getEventKindLabel(event.kind)}
          {event.date ? ` · ${formatDateTime(event.date)}` : ""}
        </div>

        {actorNames.length ? (
          <div className="mt-2 text-xs text-dark/75 dark:text-white/75">
            {event.kind === "validation" ? "Validatori" : "Partecipanti"}:{" "}
            <span className="font-semibold">{actorNames.join(", ")}</span>
          </div>
        ) : null}

        {checklist.total ? (
          <div className="mt-2 text-xs text-dark/75 dark:text-white/75">
            Checklist:{" "}
            <span className="font-semibold">
              {checklist.done}/{checklist.total}
            </span>
          </div>
        ) : null}

        {typeof event.completionDays === "number" ? (
          <div className="mt-2 rounded-full bg-black/5 px-2 py-1 text-[11px] text-dark/75 dark:bg-white/10 dark:text-white/75">
            Chiuso in {event.completionDays} giorni
          </div>
        ) : null}

        {event.note ? (
          <div className="mt-2 text-xs text-dark/80 dark:text-white/80">{event.note}</div>
        ) : null}
      </div>
    ),
    [actorNames, checklist.done, checklist.total, event, signal],
  );

  return (
    <div
      ref={anchorRef}
      className={className}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
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
            withConnector={withConnector}
          >
            {body}
          </Popover>
        )}
      </FloatingPortal>
    </div>
  );
}
