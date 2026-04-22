"use client";

import React, { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import FloatingPortal from "@/components/AtlasModuli/Calendario/Tools/FloatingPortal";
import { Popover } from "@/components/ui/Popover";
import type {
  SprintTimelineBoardData,
  SprintTimelineEvent,
  SprintTimelineLane,
  SprintTimelineSegment,
} from "./SprintTimeline.types";
import {
  formatDateOnly,
  getEventChainId,
  isOperationalCheckpoint,
} from "./SprintTimeline.helpers";

type PersonDayStats = {
  isoDate: string;
  intensity: number;
  resolvedDots: number;
  resolvedCheckpointTitles: string[];
  ownTaskClosed: boolean;
  ownTaskClosedTitles: string[];
};

type PersonContribution = {
  name: string;
  assignedTaskCount: number;
  resolvedDotsCount: number;
  activeDaysCount: number;
  totalSprintDays: number;
  daily: PersonDayStats[];
};

type Placement = "top" | "bottom" | "left" | "right";

function toIsoDate(value?: string) {
  return value?.slice(0, 10) || "";
}

function enumerateSprintDays(segment: SprintTimelineSegment): string[] {
  const startIso = segment.startDate?.slice(0, 10);
  const endIso = segment.endDate?.slice(0, 10);

  if (!startIso || !endIso) return [];

  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const cursor = new Date(start);

  while (cursor <= end) {
    out.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate(),
      ).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

function isEventInsideSegment(event: SprintTimelineEvent, segment: SprintTimelineSegment) {
  return event.dateIndex >= segment.startIndex && event.dateIndex < segment.endIndex;
}

function getLaneEventsInsideSegment(lane: SprintTimelineLane, segment: SprintTimelineSegment) {
  return lane.events.filter((event) => isEventInsideSegment(event, segment));
}

function getCheckpointSourceEvent(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent,
): SprintTimelineEvent | null {
  const chainId = getEventChainId(event);
  return (
    lane.events.find(
      (item) => isOperationalCheckpoint(item) && getEventChainId(item) === chainId,
    ) ?? null
  );
}

function getContributionPeople(
  data: SprintTimelineBoardData,
  segment: SprintTimelineSegment,
) {
  const names = new Set<string>();

  data.lanes.forEach((lane) => {
    const eventsInSegment = getLaneEventsInsideSegment(lane, segment);
    if (!eventsInSegment.length) return;

    if (lane.ownerName?.trim()) {
      names.add(lane.ownerName.trim());
    }

    eventsInSegment.forEach((event) => {
      if (isOperationalCheckpoint(event)) {
        event.participants?.forEach((participant) => {
          if (participant.name?.trim()) {
            names.add(participant.name.trim());
          }
        });
      }

      if (event.kind === "completion-update") {
        const sourceCheckpoint = getCheckpointSourceEvent(lane, event);
        sourceCheckpoint?.participants?.forEach((participant) => {
          if (participant.name?.trim()) {
            names.add(participant.name.trim());
          }
        });
      }
    });
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b, "it-IT"));
}

function buildEmptyDayMap(days: string[]) {
  const map = new Map<string, PersonDayStats>();
  days.forEach((isoDate) => {
    map.set(isoDate, {
      isoDate,
      intensity: 0,
      resolvedDots: 0,
      resolvedCheckpointTitles: [],
      ownTaskClosed: false,
      ownTaskClosedTitles: [],
    });
  });
  return map;
}

function buildPersonContribution(
  personName: string,
  data: SprintTimelineBoardData,
  segment: SprintTimelineSegment,
): PersonContribution {
  const sprintDays = enumerateSprintDays(segment);
  const dayMap = buildEmptyDayMap(sprintDays);

  let assignedTaskCount = 0;
  let resolvedDotsCount = 0;

  data.lanes.forEach((lane) => {
    const eventsInSegment = getLaneEventsInsideSegment(lane, segment);
    if (!eventsInSegment.length) return;

    const isOwner = lane.ownerName?.trim() === personName;
    if (isOwner) {
      assignedTaskCount += 1;
    }

    eventsInSegment.forEach((event) => {
      const eventIso = toIsoDate(event.date);
      if (!eventIso || !dayMap.has(eventIso)) return;

      const day = dayMap.get(eventIso)!;

      if (event.kind === "completion-update") {
        const sourceCheckpoint = getCheckpointSourceEvent(lane, event);
        const isParticipant =
          sourceCheckpoint?.participants?.some(
            (participant) => participant.name === personName,
          ) ?? false;

        if (isParticipant) {
          day.intensity += 1;
          day.resolvedDots += 1;
          day.resolvedCheckpointTitles.push(sourceCheckpoint?.title || event.title);
          resolvedDotsCount += 1;
        }
      }

      if (event.kind === "completion" && isOwner) {
        day.ownTaskClosed = true;
        day.ownTaskClosedTitles.push(lane.title);
      }
    });
  });

  const daily = sprintDays.map((isoDate) => dayMap.get(isoDate)!);
  const activeDaysCount = daily.filter(
    (day) => day.intensity > 0 || day.ownTaskClosed,
  ).length;

  return {
    name: personName,
    assignedTaskCount,
    resolvedDotsCount,
    activeDaysCount,
    totalSprintDays: sprintDays.length,
    daily,
  };
}

function getHeatClass(intensity: number) {
  if (intensity <= 0) {
    return "bg-slate-200/80 dark:bg-white/8 border border-slate-300/60 dark:border-white/6";
  }
  if (intensity === 1) {
    return "bg-emerald-400/55 border border-emerald-300/35";
  }
  if (intensity === 2) {
    return "bg-emerald-400/75 border border-emerald-300/45";
  }
  if (intensity === 3) {
    return "bg-emerald-500/85 border border-emerald-400/55";
  }
  return "bg-emerald-600 border border-emerald-500/65";
}

function HeatDayHover({
                        children,
                        content,
                        placement = "top",
                        maxWidth = "24rem",
                      }: {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: Placement;
  maxWidth?: string;
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
      className="inline-block"
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
          <Popover placement={finalPlacement} maxWidth={maxWidth} withConnector={true}>
            {content}
          </Popover>
        )}
      </FloatingPortal>
    </div>
  );
}

function HeatTooltip({
                       personName,
                       day,
                     }: {
  personName: string;
  day: PersonDayStats;
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-dark dark:text-white">
        {personName}
      </div>

      <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
        {day.isoDate}
      </div>

      <div className="mt-3 space-y-2 text-xs text-dark/80 dark:text-white/80">
        <div>
          Intensità checkpoint chiusi:{" "}
          <span className="font-semibold">{day.intensity}</span>
        </div>

        <div>
          Pallini risolti:{" "}
          <span className="font-semibold">{day.resolvedDots}</span>
        </div>

        <div>
          Chiusura task proprio:{" "}
          <span className="font-semibold">{day.ownTaskClosed ? "Sì" : "No"}</span>
        </div>
      </div>

      {day.resolvedCheckpointTitles.length ? (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark/50 dark:text-white/50">
            Checkpoint chiusi
          </div>
          <div className="mt-1 space-y-1">
            {day.resolvedCheckpointTitles.map((title, index) => (
              <div
                key={`${day.isoDate}-resolved-${index}`}
                className="text-xs text-dark/75 dark:text-white/75"
              >
                • {title}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {day.ownTaskClosedTitles.length ? (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
            Task chiusi
          </div>
          <div className="mt-1 space-y-1">
            {day.ownTaskClosedTitles.map((title, index) => (
              <div
                key={`${day.isoDate}-closed-task-${index}`}
                className="text-xs text-dark/75 dark:text-white/75"
              >
                • {title}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SprintTimelineSprintContributions({
                                                    data,
                                                    selectedSegment,
                                                  }: {
  data: SprintTimelineBoardData;
  selectedSegment: SprintTimelineSegment | null;
}) {
  const people = useMemo(() => {
    if (!selectedSegment) return [];
    return getContributionPeople(data, selectedSegment);
  }, [data, selectedSegment]);

  const contributions = useMemo(() => {
    if (!selectedSegment) return [];
    return people.map((person) => buildPersonContribution(person, data, selectedSegment));
  }, [data, people, selectedSegment]);

  const sprintDays = useMemo(() => {
    if (!selectedSegment) return [];
    return enumerateSprintDays(selectedSegment);
  }, [selectedSegment]);

  const maxIntensity = useMemo(() => {
    const values = contributions.flatMap((item) => item.daily.map((day) => day.intensity));
    return Math.max(0, ...values);
  }, [contributions]);

  const segmentStartLabel = selectedSegment?.startDate
    ? formatDateOnly(selectedSegment.startDate)
    : "—";

  const segmentEndLabel = selectedSegment?.endDate
    ? formatDateOnly(selectedSegment.endDate)
    : "—";

  if (!selectedSegment) return null;

  return (
    <section className="rounded-[26px] border border-primary/15 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
            Sprint analytics
          </div>
          <div className="mt-1 text-2xl font-semibold text-dark dark:text-white">
            Contributi sprint
          </div>
          <div className="mt-2 text-sm text-dark/60 dark:text-white/60">
            Intensità reale sui checkpoint chiusi nello sprint selezionato. Bordo dorato quando la persona chiude un proprio task in quel giorno.
          </div>
        </div>

        <div className="text-sm text-dark/60 dark:text-white/60">
          Sprint:{" "}
          <span className="font-semibold text-dark dark:text-white">
            {selectedSegment.label}
          </span>
          {" · "}
          {segmentStartLabel}
          {" → "}
          {segmentEndLabel}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-dark/55 dark:text-white/55">
        <span>Intensità checkpoint chiusi</span>
        <div className="flex items-center gap-1">
          <span className={clsx("h-3.5 w-3.5 rounded-[4px]", getHeatClass(0))} />
          <span className={clsx("h-3.5 w-3.5 rounded-[4px]", getHeatClass(1))} />
          <span className={clsx("h-3.5 w-3.5 rounded-[4px]", getHeatClass(2))} />
          <span className={clsx("h-3.5 w-3.5 rounded-[4px]", getHeatClass(3))} />
          <span className={clsx("h-3.5 w-3.5 rounded-[4px]", getHeatClass(4))} />
        </div>
        <span className="text-amber-700 dark:text-amber-300">
          bordo dorato = chiusura task proprio
        </span>
        <span>
          max intensità: <span className="font-semibold">{maxIntensity}</span>
        </span>
      </div>

      {contributions.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-primary/30 bg-white/40 px-4 py-8 text-sm text-dark/60 dark:bg-gray-dark/20 dark:text-white/60">
          Nessuna persona coinvolta nello sprint selezionato.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {contributions.map((person) => (
            <article
              key={person.name}
              className="rounded-[22px] border border-stroke bg-white/80 p-4 dark:border-dark-3 dark:bg-gray-dark/50"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-dark dark:text-white">
                    {person.name}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatPill label="Task assegnati" value={person.assignedTaskCount} />
                    <StatPill label="Pallini risolti" value={person.resolvedDotsCount} />
                    <StatPill
                      label="Giorni attivi"
                      value={`${person.activeDaysCount}/${person.totalSprintDays}`}
                    />
                  </div>
                </div>

                <div className="text-xs text-dark/50 dark:text-white/50">
                  +1 intensità per ogni checkpoint chiuso nel periodo
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${sprintDays.length}, minmax(14px, 14px))`,
                    minWidth: sprintDays.length * 15,
                  }}
                >
                  {person.daily.map((day) => (
                    <HeatDayHover
                      key={`${person.name}-${day.isoDate}`}
                      content={<HeatTooltip personName={person.name} day={day} />}
                      placement="top"
                      maxWidth="24rem"
                    >
                      <div
                        className={clsx(
                          "h-3.5 w-3.5 rounded-[4px]",
                          getHeatClass(day.intensity),
                          day.ownTaskClosed
                            ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-amber-300 dark:ring-offset-gray-dark"
                            : "",
                        )}
                      />
                    </HeatDayHover>
                  ))}
                </div>

                <div
                  className="mt-2 grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${sprintDays.length}, minmax(14px, 14px))`,
                    minWidth: sprintDays.length * 15,
                  }}
                >
                  {person.daily.map((day, index) => (
                    <div
                      key={`${person.name}-${day.isoDate}-label`}
                      className="text-center text-[9px] text-dark/40 dark:text-white/35"
                    >
                      {index === 0 || day.isoDate.endsWith("-01") || index === sprintDays.length - 1
                        ? Number(day.isoDate.slice(8, 10))
                        : ""}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StatPill({
                    label,
                    value,
                  }: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
      {label}: <span className="font-semibold">{value}</span>
    </div>
  );
}