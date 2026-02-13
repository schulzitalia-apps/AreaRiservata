"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import type { CalendarEventVM } from "../types";
import type { EventoDef } from "@/config/eventi.registry";
import EventLabelHover from "../Tools/EventLabelHover";
import { TYPE_COLOR_PALETTE } from "@/components/AtlasModuli/Calendario/color-palette";

type Props = {
  isoDate: string;
  events: CalendarEventVM[];

  availableTypes: EventoDef[];
  selectedTypeSlugs: string[];
  onToggleType: (slug: string) => void;

  typeColorMap: Record<string, number>;

  onClose: () => void;
  anchored?: boolean;
  onStep?: (deltaDays: number) => void;
  onHourContext?: (e: React.MouseEvent, hour: number) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function DayViewModal({
                                       isoDate,
                                       events,
                                       availableTypes,
                                       selectedTypeSlugs,
                                       onToggleType,
                                       typeColorMap,
                                       onClose,
                                       anchored = true,
                                       onStep,
                                       onHourContext,
                                     }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const dayStart = useMemo(() => new Date(isoDate + "T00:00:00"), [isoDate]);
  const dayNextStart = useMemo(() => {
    const d = new Date(isoDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d;
  }, [isoDate]);

  const timedEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (ev.allDay) return false;
        const s = new Date(ev.start);
        const e = new Date(ev.end);
        // overlap “pulito” con il giorno corrente
        return s < dayNextStart && e > dayStart;
      })
      // ordinamento: meglio usare lo start "clippato" nel giorno, così gli overnight non finiscono “in fondo”
      .sort((a, b) => {
        const sa = new Date(a.start);
        const sb = new Date(b.start);
        const aEff = sa < dayStart ? dayStart : sa;
        const bEff = sb < dayStart ? dayStart : sb;
        return +aEff - +bEff;
      });
  }, [events, dayStart, dayNextStart]);

  const allDayEvents = useMemo(() => {
    return events
      .filter((ev) => ev.allDay)
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [events]);

  const hourIdx = (d: Date) => Math.floor(d.getHours() + d.getMinutes() / 60);
  const ceilHourIdx = (d: Date) =>
    Math.max(1, Math.ceil(d.getHours() + d.getMinutes() / 60));

  // ✅ helper: clippa l’evento dentro al giorno corrente e ritorna from/to coerenti 0..24
  const clampToDayHours = (ev: CalendarEventVM) => {
    const s = new Date(ev.start);
    const e = new Date(ev.end);

    const sEff = s < dayStart ? dayStart : s;
    const eEff = e > dayNextStart ? dayNextStart : e;

    const startH = (sEff.getTime() - dayStart.getTime()) / 3600000; // 0..24
    const endH = (eEff.getTime() - dayStart.getTime()) / 3600000; // 0..24

    const from = Math.max(0, Math.min(23, Math.floor(startH)));
    const to = Math.max(from + 1, Math.min(24, Math.ceil(endH)));

    return { from, to };
  };

  const getPalette = (typeSlug: string) => {
    const idx = typeColorMap[typeSlug] ?? 0;
    return (
      TYPE_COLOR_PALETTE[idx % TYPE_COLOR_PALETTE.length] ?? TYPE_COLOR_PALETTE[0]
    );
  };

  const formatTimeRange = (ev: CalendarEventVM) => {
    if (ev.allDay) return "Tutto il giorno";

    // ✅ mostra range relativo al giorno selezionato (clippato), così gli overnight non risultano “strani”
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const sEff = s < dayStart ? dayStart : s;
    const eEff = e > dayNextStart ? dayNextStart : e;

    const sTxt = sEff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const eTxt =
      eEff.getTime() === dayNextStart.getTime()
        ? "24:00"
        : eEff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return `${sTxt} — ${eTxt}`;
  };

  const durationLabel = (ev: CalendarEventVM) => {
    if (ev.allDay) return "24h";

    // ✅ durata relativa al giorno (clippata)
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const sEff = s < dayStart ? dayStart : s;
    const eEff = e > dayNextStart ? dayNextStart : e;

    const ms = +eEff - +sEff;
    const mins = Math.max(0, Math.round(ms / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  // ---------------- GLOBAL LANES ----------------
  const laneByEventId = useMemo(() => {
    type Intv = { id: string; from: number; to: number };

    const list: Intv[] = timedEvents.map((ev) => {
      const { from, to } = clampToDayHours(ev);
      return { id: String(ev.id), from, to };
    });

    list.sort((a, b) => a.from - b.from || a.to - b.to);

    const laneEnds: number[] = [];
    const out = new Map<string, number>();

    list.forEach((it) => {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > it.from) lane++;
      if (lane === laneEnds.length) laneEnds.push(0);
      laneEnds[lane] = it.to;
      out.set(it.id, lane);
    });

    return out;
  }, [timedEvents]); // clamp usa dayStart/dayNextStart ma cambia insieme a timedEvents

  const globalLaneCount = useMemo(() => {
    let max = -1;
    for (const [, lane] of laneByEventId) max = Math.max(max, lane);
    return Math.max(1, max + 1);
  }, [laneByEventId]);

  // ---------------- eventi per ora (badge) ----------------
  const eventsByHour: Record<number, CalendarEventVM[]> = useMemo(() => {
    const map: Record<number, CalendarEventVM[]> = {};
    for (let h = 0; h < 24; h++) map[h] = [];

    timedEvents.forEach((ev) => {
      const { from, to } = clampToDayHours(ev);
      for (let h = from; h < to; h++) map[h].push(ev);
    });

    return map;
  }, [timedEvents]);

  const hourIndicator = (h: number) => {
    const n = eventsByHour[h]?.length ?? 0;
    if (n <= 0) return null;
    if (n === 1) return <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-primary/80" />;
    return (
      <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[12px] font-semibold text-white">
        {n}
      </span>
    );
  };

  // ---------------- ribbons desktop (6 ore a riga) ----------------
  type Seg = {
    ev: CalendarEventVM;
    row: number;
    colStart: number;
    colSpan: number;
    lane: number;
    fromHour: number;
    toHourExcl: number;
    evFrom: number;
    evTo: number;
  };

  const ribbonsByRowDesktop: Seg[][] = useMemo(() => {
    const rows: Seg[][] = [[], [], [], []];

    timedEvents.forEach((ev) => {
      const { from: evFrom, to: evTo } = clampToDayHours(ev);
      const lane = laneByEventId.get(String(ev.id)) ?? 0;

      let h = evFrom;
      while (h < evTo) {
        const blockStart = Math.floor(h / 6) * 6;
        const blockEnd = blockStart + 6;

        const segStart = Math.max(h, blockStart);
        const segEnd = Math.min(evTo, blockEnd);

        rows[Math.floor(segStart / 6)].push({
          ev,
          row: Math.floor(segStart / 6),
          colStart: (segStart % 6) + 1,
          colSpan: Math.max(1, segEnd - segStart),
          lane,
          fromHour: segStart,
          toHourExcl: segEnd,
          evFrom,
          evTo,
        });

        h = segEnd;
      }
    });

    for (let r = 0; r < 4; r++) {
      rows[r].sort(
        (a, b) =>
          a.lane - b.lane ||
          a.fromHour - b.fromHour ||
          a.toHourExcl - b.toHourExcl,
      );
    }

    return rows;
  }, [timedEvents, laneByEventId]);

  // ---------------- ribbons mobile (3 ore a riga) ----------------
  const ribbonsByRowMobile: Seg[][] = useMemo(() => {
    const rows: Seg[][] = Array.from({ length: 8 }, () => []);

    timedEvents.forEach((ev) => {
      const { from: evFrom, to: evTo } = clampToDayHours(ev);
      const lane = laneByEventId.get(String(ev.id)) ?? 0;

      let h = evFrom;
      while (h < evTo) {
        const blockStart = Math.floor(h / 3) * 3;
        const blockEnd = blockStart + 3;

        const segStart = Math.max(h, blockStart);
        const segEnd = Math.min(evTo, blockEnd);

        rows[Math.floor(segStart / 3)].push({
          ev,
          row: Math.floor(segStart / 3),
          colStart: (segStart % 3) + 1,
          colSpan: Math.max(1, segEnd - segStart),
          lane,
          fromHour: segStart,
          toHourExcl: segEnd,
          evFrom,
          evTo,
        });

        h = segEnd;
      }
    });

    for (let r = 0; r < 8; r++) {
      rows[r].sort(
        (a, b) =>
          a.lane - b.lane ||
          a.fromHour - b.fromHour ||
          a.toHourExcl - b.toHourExcl,
      );
    }

    return rows;
  }, [timedEvents, laneByEventId]);

  const selected = selectedId
    ? (timedEvents.find((e) => String(e.id) === String(selectedId)) ??
      events.find((e) => String(e.id) === String(selectedId)) ??
      null)
    : null;

  const sidebarItems = useMemo(() => {
    const all = [
      ...allDayEvents.map((e) => ({ ev: e, sort: 0, key: `a-${e.id}` })),
      ...timedEvents.map((e) => {
        const s = new Date(e.start);
        const sEff = s < dayStart ? dayStart : s;
        return { ev: e, sort: +sEff, key: `t-${e.id}` };
      }),
    ];
    return all.sort((a, b) => a.sort - b.sort);
  }, [allDayEvents, timedEvents, dayStart]);

  const selectedConflicts = useMemo(() => {
    if (!selected || selected.allDay) return { count: 0, items: [] as CalendarEventVM[] };

    // ✅ confronta le finestre “clippate” nel giorno corrente
    const s1 = Math.max(+new Date(selected.start), +dayStart);
    const e1 = Math.min(+new Date(selected.end), +dayNextStart);

    const overlaps = timedEvents.filter((x) => {
      if (String(x.id) === String(selected.id)) return false;
      const s2 = Math.max(+new Date(x.start), +dayStart);
      const e2 = Math.min(+new Date(x.end), +dayNextStart);
      return s2 < e1 && e2 > s1;
    });

    overlaps.sort((a, b) => {
      const sa = Math.max(+new Date(a.start), +dayStart);
      const sb = Math.max(+new Date(b.start), +dayStart);
      return sa - sb;
    });

    return { count: overlaps.length, items: overlaps.slice(0, 3) };
  }, [selected, timedEvents, dayStart, dayNextStart]);

  const hourLabelsDesktop = [
    ["00", "01", "02", "03", "04", "05"],
    ["06", "07", "08", "09", "10", "11"],
    ["12", "13", "14", "15", "16", "17"],
    ["18", "19", "20", "21", "22", "23"],
  ];

  const hourLabelsMobile = [
    ["00", "01", "02"],
    ["03", "04", "05"],
    ["06", "07", "08"],
    ["09", "10", "11"],
    ["12", "13", "14"],
    ["15", "16", "17"],
    ["18", "19", "20"],
    ["21", "22", "23"],
  ];

  const step = (delta: number) => onStep?.(delta);

  const handleHourClick = (e: React.MouseEvent, h: number) => {
    e.preventDefault();
    e.stopPropagation();
    onHourContext?.(e, h);
  };

  // heights
  const ROW_LABEL_H_DESK = 64;
  const ROW_BASE_H_DESK = 260;
  const LANE_H_DESK = 34;
  const RIBBON_H_DESK = 28;

  const ROW_LABEL_H_MOB = 56;
  const ROW_BASE_H_MOB = 210; // “righe lunghe” in mobile
  const LANE_H_MOB = 32;
  const RIBBON_H_MOB = 28;

  const ribbonText = (ev: CalendarEventVM) => `${ev.title ?? ""}  ${formatTimeRange(ev)}`;

  const openEventSheet = (ev: CalendarEventVM) => {
    if (typeof window === "undefined") return;
    const url = `/eventi/${ev.typeSlug}/${ev.id}`;
    const win = window.open(url, "_blank", "noopener,noreferrer,width=420,height=650");
    if (win) win.focus();
  };

  // clip-path "barra tagliata a freccia"
  const clipForArrows = (leftArrow: boolean, rightArrow: boolean) => {
    if (leftArrow && rightArrow) {
      return "polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)";
    }
    if (leftArrow) {
      return "polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%)";
    }
    if (rightArrow) {
      return "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)";
    }
    return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  };

  const dateLabelShort = useMemo(() => {
    return new Date(isoDate).toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [isoDate]);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 bottom-0 top-[var(--shell-top,64px)] z-[40] flex overflow-hidden",
        anchored && "md:absolute md:inset-0 md:z-[80] md:top-0 md:overflow-visible",
      )}
      aria-modal
      role="dialog"
    >
      <div className="absolute inset-0 bg-gray-900/95" onClick={onClose} />

      {/* ✅ FIX MOBILE SCROLL + desktop invariato */}
      <div
        className={cn(
          "relative z-10 m-0 w-full overflow-hidden rounded-[10px] border border-stroke bg-white text-black shadow-2xl dark:border-dark-3 dark:bg-dark dark:text-white",
          "max-h-[calc(100dvh-var(--shell-top,64px))] overflow-y-auto overscroll-contain touch-pan-y",
          "md:max-h-none md:overflow-visible",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-10 border-b border-stroke bg-white/95 px-3 py-2 backdrop-blur dark:border-dark-3 dark:bg-dark/95">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-black dark:text-white">
              {/* Desktop: prev/next in header */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  aria-label="Giorno precedente"
                  onClick={() => step(-1)}
                  className="rounded-full p-2 transition hover:text-red-500 focus:outline-none"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <button
                  aria-label="Giorno successivo"
                  onClick={() => step(+1)}
                  className="rounded-full p-2 transition hover:text-red-500 focus:outline-none"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <h3 className="ml-1 text-sm font-semibold md:text-base">
                {new Date(isoDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
            </div>

            <button onClick={onClose} className="rounded-md bg-primary px-3 py-1 text-white transition hover:bg-red-500">
              Torna al Mese
            </button>
          </div>

          {/* FILTRI IDENTICI AL MONTH */}
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTypes.map((def) => {
              const Icon = def.icon;
              const checked = selectedTypeSlugs.includes(def.slug);
              const palette = getPalette(def.slug);

              return (
                <label
                  key={def.slug}
                  className={cn(
                    "inline-flex items-center gap-2 rounded_full border px-3 py-1 text-xs transition",
                    checked ? palette.filterChecked : palette.filterUnchecked,
                  )}
                >
                  <input type="checkbox" className="h-3 w-3" checked={checked} onChange={() => onToggleType(def.slug)} />
                  <Icon className="h-4 w-4 opacity-80" />
                  <span className="whitespace-nowrap">{def.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* BODY */}
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px]">
            {/* MAIN */}
            <div className="min-w-0">
              {/* MOBILE: 3 ore per riga */}
              <div className="md:hidden">
                <div className="overflow-hidden rounded-[12px] border border-primary/60 dark:border-primary/70">
                  {hourLabelsMobile.map((row, rIdx) => {
                    const ribbons = ribbonsByRowMobile[rIdx] ?? [];
                    const laneArea = globalLaneCount * LANE_H_MOB;
                    const rowH = Math.max(ROW_BASE_H_MOB, ROW_LABEL_H_MOB + laneArea + 18);
                    const laneTop =
                      ROW_LABEL_H_MOB + Math.max(0, Math.floor((rowH - ROW_LABEL_H_MOB - laneArea) / 2));

                    return (
                      <div
                        key={rIdx}
                        className={cn(
                          "relative",
                          rIdx !== 7 && "border-b border-primary/40 dark:border-primary/40",
                        )}
                        style={{ height: rowH }}
                      >
                        <div className="grid grid-cols-3">
                          {row.map((hh, cIdx) => {
                            const h = rIdx * 3 + cIdx;
                            return (
                              <div
                                key={hh}
                                onClick={(e) => handleHourClick(e, h)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  onHourContext?.(e, h);
                                }}
                                className={cn(
                                  "relative bg-white p-4 text-black dark:bg-dark dark:text-white",
                                  cIdx !== 2 && "border-r border-primary/40 dark:border-primary/40",
                                )}
                                style={{ height: rowH }}
                              >
                                <div className="flex items-center">
                                  <span className="text-lg font-extrabold tracking-tight">{hh}:00</span>
                                  {hourIndicator(h)}
                                </div>
                                <div className="mt-1 text-[12px] opacity-60">Tap & hold per azioni</div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pointer-events-none absolute inset-0">
                          {ribbons.map((s) => {
                            const active = selectedId && String(s.ev.id) === String(selectedId);
                            const palette = getPalette(s.ev.typeSlug);

                            const continuesLeft = s.fromHour > s.evFrom;
                            const continuesRight = s.toHourExcl < s.evTo;
                            const continuesDown = continuesRight && s.toHourExcl % 3 === 0;

                            return (
                              <EventLabelHover
                                key={`mrb-${s.ev.id}-${s.row}-${s.colStart}-${s.lane}-${s.fromHour}`}
                                event={s.ev as any}
                                placement="bottom"
                              >
                                <button
                                  className={cn(
                                    "pointer-events-auto absolute border px-3 text-left text-[12px] font-semibold transition",
                                    "rounded-[2px]",
                                    active ? "border-white ring-2 ring-white/30" : "border-white/10 hover:opacity-95",
                                    palette.pillSolid,
                                  )}
                                  style={{
                                    left: `calc((100% / 3) * ${s.colStart - 1})`,
                                    width: `calc((100% / 3) * ${s.colSpan})`,
                                    top: laneTop + s.lane * LANE_H_MOB,
                                    height: RIBBON_H_MOB,
                                    clipPath: clipForArrows(continuesLeft, continuesRight),
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedId(String(s.ev.id));
                                  }}
                                >
                                  <div className="truncate">{ribbonText(s.ev)}</div>

                                  {continuesDown && (
                                    <span
                                      className={cn("absolute left-1/2 -translate-x-1/2", palette.pillSolid)}
                                      style={{
                                        bottom: -8,
                                        width: 18,
                                        height: 10,
                                        clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                                      }}
                                    />
                                  )}
                                </button>
                              </EventLabelHover>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DESKTOP: 6 ore a riga */}
              <div className="hidden md:block">
                <div className="overflow-hidden rounded-[12px] border border-primary/60 dark:border-primary/70">
                  {hourLabelsDesktop.map((row, rIdx) => {
                    const ribbons = ribbonsByRowDesktop[rIdx] ?? [];

                    const laneArea = globalLaneCount * LANE_H_DESK;
                    const rowH = Math.max(ROW_BASE_H_DESK, ROW_LABEL_H_DESK + laneArea + 18);
                    const laneTop =
                      ROW_LABEL_H_DESK + Math.max(0, Math.floor((rowH - ROW_LABEL_H_DESK - laneArea) / 2));

                    return (
                      <div
                        key={rIdx}
                        className={cn(
                          "relative",
                          rIdx !== 3 && "border-b border-primary/40 dark:border-primary/40",
                        )}
                        style={{ height: rowH }}
                      >
                        <div className="grid grid-cols-6">
                          {row.map((hh, cIdx) => {
                            const h = rIdx * 6 + cIdx;
                            return (
                              <div
                                key={hh}
                                onClick={(e) => handleHourClick(e, h)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  onHourContext?.(e, h);
                                }}
                                className={cn(
                                  "relative bg-white p-4 text-black dark:bg-dark dark:text-white",
                                  cIdx !== 5 && "border-r border-primary/40 dark:border-primary/40",
                                )}
                                style={{ height: rowH }}
                              >
                                <div className="flex items-center">
                                  <span className="text-xl font-extrabold tracking-tight">{hh}:00</span>
                                  {hourIndicator(h)}
                                </div>
                                <div className="mt-1 text-[12px] opacity-60">Click destro per azioni</div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pointer-events-none absolute inset-0">
                          {ribbons.map((s) => {
                            const active = selectedId && String(s.ev.id) === String(selectedId);
                            const palette = getPalette(s.ev.typeSlug);

                            const continuesLeft = s.fromHour > s.evFrom;
                            const continuesRight = s.toHourExcl < s.evTo;
                            const continuesDown = continuesRight && s.toHourExcl % 6 === 0;

                            return (
                              <EventLabelHover
                                key={`rb-${s.ev.id}-${s.row}-${s.colStart}-${s.lane}-${s.fromHour}`}
                                event={s.ev as any}
                                placement="bottom"
                              >
                                <button
                                  className={cn(
                                    "pointer-events-auto absolute border px-3 text-left text-[12px] font-semibold transition",
                                    "rounded-[2px]",
                                    active ? "border-white ring-2 ring-white/30" : "border-white/10 hover:opacity-95",
                                    palette.pillSolid,
                                  )}
                                  style={{
                                    left: `calc((100% / 6) * ${s.colStart - 1})`,
                                    width: `calc((100% / 6) * ${s.colSpan})`,
                                    top: laneTop + s.lane * LANE_H_DESK,
                                    height: RIBBON_H_DESK,
                                    clipPath: clipForArrows(continuesLeft, continuesRight),
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedId(String(s.ev.id));
                                  }}
                                >
                                  <div className="truncate">{ribbonText(s.ev)}</div>

                                  {continuesDown && (
                                    <span
                                      className={cn("absolute left-1/2 -translate-x-1/2", palette.pillSolid)}
                                      style={{
                                        bottom: -8,
                                        width: 18,
                                        height: 10,
                                        clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                                      }}
                                    />
                                  )}
                                </button>
                              </EventLabelHover>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SIDEBAR */}
            <aside className="md:sticky md:top-[170px]">
              <div className="rounded-xl border border-stroke/60 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-dark-3/60 dark:bg-white/5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Eventi del giorno</div>
                  <div className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/10">
                    {sidebarItems.length}
                  </div>
                </div>

                {sidebarItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-black/20 p-3 text-[12px] opacity-70 dark:border-white/15">
                    Nessun evento oggi.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sidebarItems.map(({ ev, key }) => {
                      const active = selectedId && String(ev.id) === String(selectedId);
                      const palette = getPalette(ev.typeSlug);

                      return (
                        <button
                          key={key}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                            active
                              ? "border-white bg-white/10 ring-2 ring-white/20"
                              : "border-black/10 bg-white/60 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                          )}
                          onClick={() => setSelectedId(String(ev.id))}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("h-2.5 w-2.5 rounded-full", palette.pillSolid)} />
                                <div className="truncate font-semibold">{ev.title}</div>
                              </div>
                              <div className="mt-0.5 text-[12px] opacity-80">
                                {formatTimeRange(ev)} · {durationLabel(ev)}
                              </div>
                            </div>

                            <div
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                palette.pillMiddle,
                              )}
                            >
                              {ev.typeLabel}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* DETTAGLIO */}
                {selected && (
                  <div ref={detailRef} className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {selected.title}
                          <span className="ml-2 text-[12px] opacity-70">({selected.typeLabel})</span>
                        </div>
                        {selected.subtitle && (
                          <div className="mt-0.5 truncate text-[12px] opacity-80">{selected.subtitle}</div>
                        )}
                        <div className="mt-1 text-[12px] opacity-80">
                          {formatTimeRange(selected)} · {durationLabel(selected)}
                          {selected.timeKind ? <span className="ml-2 opacity-70">· {selected.timeKind}</span> : null}
                        </div>
                      </div>

                      <span className="rounded bg-blue-600/20 px-2 py-0.5 text-[11px] text-blue-200">
                        {selected.visibilityRole && selected.visibilityRole.trim()
                          ? selected.visibilityRole
                          : "Solo proprietario"}
                      </span>
                    </div>

                    {!selected.allDay && (
                      <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] font-semibold">Sovrapposizioni</div>
                          <div className="text-[12px] opacity-80">{selectedConflicts.count}</div>
                        </div>

                        {selectedConflicts.count > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {selectedConflicts.items.map((x) => (
                              <li
                                key={`ov-${x.id}`}
                                className="flex items-center justify-between gap-2 text-[12px] opacity-90"
                              >
                                <span className="truncate">{x.title}</span>
                                <span className="shrink-0 opacity-70">{formatTimeRange(x)}</span>
                              </li>
                            ))}
                            {selectedConflicts.count > 3 && (
                              <li className="text-[12px] opacity-70">+{selectedConflicts.count - 3} altri…</li>
                            )}
                          </ul>
                        ) : (
                          <div className="mt-1 text-[12px] opacity-70">Nessuna.</div>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white transition hover:opacity-90"
                        onClick={() => openEventSheet(selected)}
                      >
                        Apri scheda evento
                      </button>

                      <button
                        className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-semibold transition hover:bg-white/10"
                        onClick={() => setSelectedId(null)}
                      >
                        Deseleziona
                      </button>
                    </div>

                    {selected.notes && (
                      <div className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed opacity-90">{selected.notes}</div>
                    )}
                  </div>
                )}
              </div>

              {allDayEvents.length > 0 && (
                <div className="mt-3 rounded-xl border border-stroke/60 bg-white/70 p-3 text-[12px] shadow-sm backdrop-blur dark:border-dark-3/60 dark:bg-white/5">
                  <div className="mb-2 text-sm font-semibold">Tutto il giorno</div>
                  <div className="flex flex-wrap gap-2">
                    {allDayEvents.map((ev) => {
                      const active = selectedId && String(ev.id) === String(selectedId);
                      const palette = getPalette(ev.typeSlug);
                      return (
                        <button
                          key={`alld-${ev.id}`}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                            active
                              ? "border-white bg-white/10 ring-2 ring-white/20"
                              : "border-black/10 bg-white/60 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                            palette.pillMiddle,
                          )}
                          onClick={() => setSelectedId(String(ev.id))}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* MOBILE: mini selettore giorno in basso */}
        <div className="md:hidden fixed left-0 right-0 bottom-0 z-[95] px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-[920px] rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between">
              <button
                onClick={() => step(-1)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white active:scale-[0.98]"
                aria-label="Giorno precedente"
              >
                ◀
              </button>

              <div className="text-[12px] font-semibold text-white/90">{dateLabelShort}</div>

              <button
                onClick={() => step(+1)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white active:scale-[0.98]"
                aria-label="Giorno successivo"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* spazio per non coprire contenuti sotto col footer mobile */}
        <div className="md:hidden h-16" />
      </div>
    </div>
  );
}
