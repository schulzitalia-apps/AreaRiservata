"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import { cn } from "@/server-utils/lib/utils";
import type { CalendarEventVM } from "../types";
import EventLabelHover from "../Tools/EventLabelHover";
import FloatingPortal from "../Tools/FloatingPortal";
import { Popover } from "@/components/ui/Popover";

type ColorScheme = {
  pillSolid: string;
  pillMiddle: string;
};

type Props = {
  month: string; // YYYY-MM
  events: CalendarEventVM[];
  status?: "idle" | "loading" | "succeeded" | "failed";

  onPrevMonth: () => void;
  onNextMonth: () => void;

  createMode?: boolean;
  onToggleCreate?: (v: boolean) => void;
  onCreateRange?: (r: { dateStart: string; dateEnd: string }) => void;

  // menu sul giorno
  onDayMenu?: (e: React.MouseEvent, isoDate: string) => void;

  // menu sull'evento
  onEventMenu?: (e: React.MouseEvent, isoDate: string, ev: CalendarEventVM) => void;

  // mappa tipo → indice nella palette
  typeColorMap: Record<string, number>;
  // palette colori
  colorSchemes: ColorScheme[];

  selectionModeEnabled?: boolean;
};

type Day = { date: Date; inMonth: boolean; iso: string; dayNum: number };

function buildMonthGrid(yyyyMm: string): Day[] {
  const [y, m] = yyyyMm.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = (first.getDay() + 6) % 7; // lun=0
  const start = new Date(first);
  start.setDate(first.getDate() - startWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      date: d,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === m - 1,
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
    };
  });
}

const isSameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const cmpISO = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function segmentKindForDay(isoDay: string, ev: CalendarEventVM) {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const dDate = new Date(isoDay + "T00:00:00");

  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());

  // endDay: se termina a mezzanotte e dura più di un giorno, l’ultimo giorno “effettivo” è quello prima
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const endsAtMidnight = e.getHours() === 0 && e.getMinutes() === 0;

  const isStart = isSameYMD(dDate, startDay);

  // se endsAtMidnight, NON considerare quel giorno come “fine”
  const isEnd = isSameYMD(dDate, endDay) && !endsAtMidnight;

  // “middle” = né start né end
  const isMiddle = !isStart && !isEnd;

  return { isStart, isEnd, isMiddle };
}

/* -------------------------------------------------------------------------- */
/*                         POPOVER PER "+N" (more)                             */
/* -------------------------------------------------------------------------- */

function MoreEventsPopover({
                             isoDay,
                             events,
                             label,
                             maxWidth = "22rem",
                             getEventColor,
                             onEventMenu,
                           }: {
  isoDay: string;
  events: CalendarEventVM[];
  label: React.ReactNode; // bottone +N
  maxWidth?: string;
  getEventColor: (ev: CalendarEventVM) => ColorScheme;
  onEventMenu?: (e: React.MouseEvent, isoDate: string, ev: CalendarEventVM) => void;
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

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div
      ref={anchorRef}
      className="relative"
      // desktop: hover
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <div
        onClick={toggle} // mobile: tap
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openNow();
        }}
      >
        {label}
      </div>

      <FloatingPortal
        open={open}
        anchorRef={anchorRef as any}
        placement="bottom"
        offset={10}
        shift={10}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        {({ placement: finalPlacement }) => (
          <Popover placement={finalPlacement} maxWidth={maxWidth} withConnector>
            <div className="p-2">
              <div className="mb-1 text-[11px] font-semibold text-gray-7 dark:text-white/80">
                Altri appuntamenti
              </div>

              <ul className="space-y-1">
                {events.map((ev, i) => {
                  const { isStart, isEnd, isMiddle } = segmentKindForDay(isoDay, ev);
                  const scheme = getEventColor(ev);

                  return (
                    <li key={`${ev.id}-more-${i}`}>
                      <EventLabelHover event={ev} placement="right" maxWidth="22rem">
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left truncate rounded-md border px-2 py-1 text-xs transition",
                            isMiddle ? scheme.pillMiddle : scheme.pillSolid,
                            !isStart && "rounded-l-none",
                            !isEnd && "rounded-r-none",
                            "hover:opacity-95",
                          )}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEventMenu?.(e, isoDay, ev);
                            setOpen(false);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEventMenu?.(e, isoDay, ev);
                            setOpen(false);
                          }}
                        >
                          {ev.title}
                        </button>
                      </EventLabelHover>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Popover>
        )}
      </FloatingPortal>

      {/* chiudi tappando fuori (solo per mobile/click) */}
      {open && (
        <div
          className="fixed inset-0 z-[49]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              COMPONENTE                                    */
/* -------------------------------------------------------------------------- */

export default function CalendarMonthGrid({
                                            month,
                                            events,
                                            status,
                                            onPrevMonth,
                                            onNextMonth,
                                            onDayMenu,
                                            createMode,
                                            onToggleCreate,
                                            onCreateRange,
                                            typeColorMap,
                                            colorSchemes,
                                            selectionModeEnabled = true,
                                            onEventMenu,
                                          }: Props) {
  const days = useMemo(() => buildMonthGrid(month), [month]);
  const monthDaysOnly = useMemo(() => days.filter((d) => d.inMonth), [days]);

  const [anchorISO, setAnchorISO] = useState<string | null>(null);
  const [hoverISO, setHoverISO] = useState<string | null>(null);

  useMemo(() => {
    setAnchorISO(null);
    setHoverISO(null);
  }, [month, createMode]);

  const currentSel = useMemo(() => {
    if (!anchorISO) return null;
    const end = hoverISO ?? anchorISO;
    const [s, e] = cmpISO(anchorISO, end) <= 0 ? [anchorISO, end] : [end, anchorISO];
    return { s, e };
  }, [anchorISO, hoverISO]);

  const inSelection = useCallback(
    (iso: string) => currentSel && cmpISO(iso, currentSel.s) >= 0 && cmpISO(iso, currentSel.e) <= 0,
    [currentSel],
  );

  const getEventColor = (ev: CalendarEventVM) => {
    const idx = typeColorMap[ev.typeSlug] ?? 0;
    return colorSchemes[idx] ?? colorSchemes[0];
  };

  const mapEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventVM[]>();
    for (const d of days) map.set(d.iso, []);

    for (const ev of events) {
      const s = new Date(ev.start);
      const e = new Date(ev.end);

      const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());

      // se termina a mezzanotte, considera il giorno prima come ultimo
      if (e.getHours() === 0 && e.getMinutes() === 0 && endDay > startDay) {
        endDay.setDate(endDay.getDate() - 1);
      }

      const cursor = new Date(startDay);
      while (cursor <= endDay) {
        const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
          cursor.getDate(),
        ).padStart(2, "0")}`;

        if (map.has(iso)) map.get(iso)!.push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const [, arr] of map) {
      arr.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    }

    return map;
  }, [days, events]);

  // se il child (pill evento) ha già fatto preventDefault, non apro il menu del giorno
  const primaryAction = (e: React.MouseEvent, iso: string) => {
    if ((e as any).defaultPrevented) return;

    if (!createMode) {
      onDayMenu?.(e, iso);
      return;
    }

    if (!anchorISO) {
      setAnchorISO(iso);
      setHoverISO(iso);
      return;
    }

    const [dateStart, dateEnd] = cmpISO(anchorISO, iso) <= 0 ? [anchorISO, iso] : [iso, anchorISO];

    onCreateRange?.({ dateStart, dateEnd });
    setAnchorISO(null);
    setHoverISO(null);
  };

  const handleMouseEnter = (iso: string) => {
    if (createMode && anchorISO) setHoverISO(iso);
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-full rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* HEADER */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-t-[10px]
                      bg-slate-100 text-slate-900
                      dark:bg-slate-950 dark:text-sky-50 dark:border dark:border-sky-500/40
                      dark:shadow-[0_0_22px_rgba(59,130,246,0.45)]"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevMonth}
            aria-label="Mese precedente"
            className="rounded-full p-2 text-gray-7 hover:text-primary dark:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span
            className="select-none rounded-full px-4 py-1 font-semibold
                           bg-slate-900 text-slate-50
                           dark:bg-sky-500 dark:text-slate-950
                           dark:shadow-[0_0_18px_rgba(59,130,246,0.65)]"
          >
            {monthLabel}
          </span>

          <button
            onClick={onNextMonth}
            aria-label="Mese successivo"
            className="rounded-full p-2 text-gray-7 hover:text-primary dark:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {selectionModeEnabled && (
            <label className="ml-3 flex items-center gap-2 text-sm text-gray-7 dark:text-white">
              <span className="opacity-80">Modalità Selezione</span>
              <button
                type="button"
                onClick={() => onToggleCreate?.(!createMode)}
                aria-pressed={createMode}
                className={cn("relative h-6 w-11 rounded-full transition", createMode ? "bg-primary" : "bg-black/70")}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
                    createMode ? "left-5" : "left-0.5",
                  )}
                />
              </button>
            </label>
          )}
        </div>
      </div>

      {/* MOBILE GRID */}
      <div className="px-2 pb-2 md:hidden">
        <div className="grid grid-cols-3 gap-2">
          {monthDaysOnly.map((day) => {
            const evs = mapEventsByDay.get(day.iso) ?? [];
            const visible = evs.slice(0, 3);
            const more = evs.length - visible.length;
            const sel = inSelection(day.iso);

            return (
              <div
                key={day.iso}
                onClick={(e) => primaryAction(e, day.iso)}
                onContextMenu={(e) => primaryAction(e, day.iso)}
                className={cn(
                  "relative h-36 rounded-[10px] border p-2 transition",
                  "border-stroke dark:border-dark-3",
                  createMode && sel ? "bg-primary/20 ring-2 ring-primary border-primary" : "hover:bg-gray-2 dark:hover:bg-dark-2",
                )}
              >
                <div className="flex justify-between">
                  <span className="font-medium text-gray-7 dark:text-white">{day.dayNum}</span>

                  {more > 0 && (
                    <MoreEventsPopover
                      isoDay={day.iso}
                      events={evs.slice(3)}
                      getEventColor={getEventColor}
                      onEventMenu={onEventMenu}
                      label={
                        <button
                          type="button"
                          className="rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[10px] text-primary
                                     dark:bg-primary/30 dark:text-white"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          +{more}
                        </button>
                      }
                    />
                  )}
                </div>

                <div className="mt-2 space-y-1.5">
                  {visible.map((ev, idx) => {
                    const { isStart, isEnd, isMiddle } = segmentKindForDay(day.iso, ev);
                    const scheme = getEventColor(ev);

                    return (
                      <EventLabelHover key={`${ev.id}-m-${idx}`} event={ev} placement="bottom">
                        <div
                          className="relative"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEventMenu?.(e, day.iso, ev);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEventMenu?.(e, day.iso, ev);
                          }}
                        >
                          <div
                            className={cn(
                              "truncate rounded-md border px-2 py-1 text-xs",
                              isMiddle ? scheme.pillMiddle : scheme.pillSolid,
                              !isStart && "rounded-l-none",
                              !isEnd && "rounded-r-none",
                            )}
                          >
                            {ev.title}
                          </div>
                        </div>
                      </EventLabelHover>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP GRID */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
          <tr
            className="grid grid-cols-7 rounded-t-[10px]
                           bg-slate-50 text-slate-700
                           dark:bg-sky-600 dark:text-white
                           dark:shadow-[0_0_18px_rgba(37,99,235,0.5)]"
          >
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d, i) => (
              <th
                key={i}
                className={cn(
                  "flex h-12 items-center justify_center p-1 text-xs font-medium sm:text-base xl:p-5",
                  i === 0 && "rounded-tl-[10px]",
                  i === 6 && "rounded-tr-[10px]",
                )}
              >
                {d}
              </th>
            ))}
          </tr>
          </thead>

          <tbody>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <tr key={row} className="grid grid-cols-7">
              {days.slice(row * 7, row * 7 + 7).map((day) => {
                const evs = mapEventsByDay.get(day.iso) ?? [];
                const visible = evs.slice(0, 3);
                const more = evs.length - visible.length;

                const sel = inSelection(day.iso);
                const isSelStart = currentSel?.s === day.iso;
                const isSelEnd = currentSel?.e === day.iso;

                return (
                  <td
                    key={day.iso}
                    onClick={(e) => primaryAction(e, day.iso)}
                    onContextMenu={(e) => primaryAction(e, day.iso)}
                    onMouseEnter={() => handleMouseEnter(day.iso)}
                    className={cn(
                      "relative h-32 cursor-pointer border border-stroke p-2 transition md:h-36 md:p-3",
                      "hover:bg-gray-2 dark:hover:bg-dark-2 dark:border-dark-3",
                      !day.inMonth && "opacity-50",
                      createMode && sel && "bg-primary/20 ring-2 ring-primary border-primary",
                      createMode && sel && isSelStart && "rounded-s-[10px]",
                      createMode && sel && isSelEnd && "rounded-e-[10px]",
                    )}
                  >
                    <span className="font-medium text-gray-7 dark:text-white">{day.dayNum}</span>

                    {more > 0 && (
                      <div className="absolute right-2 top-2">
                        <MoreEventsPopover
                          isoDay={day.iso}
                          events={evs.slice(3)}
                          getEventColor={getEventColor}
                          onEventMenu={onEventMenu}
                          label={
                            <button
                              type="button"
                              className="rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[10px]
                                           text-primary dark:bg-primary/30 dark:text-white"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              +{more}
                            </button>
                          }
                        />
                      </div>
                    )}

                    <div className="mt-2 space-y-1.5">
                      {visible.map((ev, idx) => {
                        const { isStart, isEnd, isMiddle } = segmentKindForDay(day.iso, ev);
                        const scheme = getEventColor(ev);

                        return (
                          <EventLabelHover key={`${ev.id}-d-${idx}`} event={ev} placement="bottom">
                            <div
                              className="relative"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEventMenu?.(e, day.iso, ev);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEventMenu?.(e, day.iso, ev);
                              }}
                            >
                              <div
                                className={cn(
                                  "truncate rounded-md border px-2 py-1 text-xs",
                                  isMiddle ? scheme.pillMiddle : scheme.pillSolid,
                                  !isStart && "rounded-l-none",
                                  !isEnd && "rounded-r-none",
                                )}
                              >
                                {ev.title}
                              </div>
                            </div>
                          </EventLabelHover>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {status === "loading" && <div className="p-3 text-center text-sm opacity-70">Caricamento eventi…</div>}
    </div>
  );
}
