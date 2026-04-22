"use client";

import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
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

function formatPopoverDayLabel(isoDay: string) {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

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
                             maxWidth = "min(25rem, calc(100vw - 2rem))",
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
  const dayLabel = useMemo(() => formatPopoverDayLabel(isoDay), [isoDay]);

  const openNow = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };

  const closeNow = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(false);
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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <div
        onClick={toggle}
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
        placement="right"
        offset={14}
        shift={16}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        {({ placement: finalPlacement }) => (
          <Popover
            placement={finalPlacement}
            maxWidth={maxWidth}
            withConnector
            className="overflow-hidden border-stroke/80 bg-white/95 p-0 shadow-[0_24px_64px_rgba(18,51,38,0.18)] backdrop-blur-xl dark:border-dark-3/40 dark:bg-[#020814]/94 dark:shadow-[0_24px_72px_rgba(0,255,110,0.14)]"
          >
            <div className="w-[min(25rem,calc(100vw-2rem))]">
              <div className="border-b border-stroke/70 bg-gradient-to-r from-light-surface via-white to-light-surface-alt px-4 py-3 text-light-text dark:border-dark-3/30 dark:bg-gradient-to-r dark:from-[#03130E] dark:via-[#051E18] dark:to-[#020814] dark:text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight">Altri appuntamenti</div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-white/60">{dayLabel}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary dark:bg-dark-3/15 dark:text-dark-3">
                      {events.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Chiudi elenco eventi"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stroke/80 bg-white/80 text-gray-600 transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary dark:border-dark-3/30 dark:bg-white/5 dark:text-white/70 dark:hover:border-dark-3/60 dark:hover:bg-dark-3/10 dark:hover:text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeNow();
                      }}
                    >
                      <span className="text-sm leading-none">×</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="atlas-scrollbar max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain px-3 py-3">
                <ul className="space-y-2">
                  {events.map((ev, i) => {
                    const { isStart, isEnd, isMiddle } = segmentKindForDay(isoDay, ev);
                    const scheme = getEventColor(ev);

                    return (
                      <li key={`${ev.id}-more-${i}`}>
                        <EventLabelHover event={ev} placement="right" maxWidth="22rem">
                          <button
                            type="button"
                            className={cn(
                              "w-full rounded-xl border px-3 py-2.5 text-left text-sm leading-snug transition",
                              "shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:-translate-y-[1px] hover:opacity-95",
                              isMiddle ? scheme.pillMiddle : scheme.pillSolid,
                              !isStart && "rounded-l-md",
                              !isEnd && "rounded-r-md",
                            )}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEventMenu?.(e, isoDay, ev);
                              closeNow();
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEventMenu?.(e, isoDay, ev);
                              closeNow();
                            }}
                          >
                            <span className="line-clamp-2 break-words">{ev.title}</span>
                          </button>
                        </EventLabelHover>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-stroke/60 bg-light-surface/70 px-4 py-2 text-[11px] text-gray-600 dark:border-dark-3/20 dark:bg-white/5 dark:text-white/55">
                Seleziona un evento per aprire il menu rapido. Premi `Esc` per chiudere.
              </div>
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
            closeNow();
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

  useEffect(() => {
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
