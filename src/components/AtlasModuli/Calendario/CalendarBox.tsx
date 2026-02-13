"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchEventi, deleteEvento } from "@/components/Store/slices/eventiSlice";

import CalendarMonthGrid from "./MonthGrid/CalendarMonthGrid";
import DayViewModal from "./ViewModal/DayViewModal";
import EventFormModal from "./EventCreate/EventFormModal";
import EventFormModalAula from "./EventCreate/Aule/EventFormModalAula";
import EventFormModalAnagrafica from "./EventCreate/Anagrafiche/EventFormModalAnagrafica";
import PresenzeFormModalAula from "./EventEdit/Aule/PresenzeFormModalAula";

import { useContextMenu } from "./ContextMenu/useContextMenu";
import CalendarContextMenu from "./ContextMenu/CalendarContextMenu";
import CalendarContextMenuAula from "./ContextMenu/Aule/CalendarContextMenuAula";

import { cn } from "@/server-utils/lib/utils";
import { monthBounds } from "./utils";

import type { CalendarEventVM } from "./types";
import { getEventiList, type EventoDef } from "@/config/eventi.registry";
import type { EventoPreview, TimeKind } from "@/components/Store/models/eventi";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

import { TYPE_COLOR_PALETTE } from "@/components/AtlasModuli/Calendario/color-palette";
import { CALENDAR_CONFIG } from "@/config/calendar.config";

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function getCurrentMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildDayRangeFromDate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return {
    isoDay: `${y}-${m}-${dd}`,
    startIso: `${y}-${m}-${dd}T00:00:00`,
    endIso: `${y}-${m}-${dd}T23:59:59`,
  };
}

function isoDayFromIsoDateTime(iso: string): string {
  return iso.slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*                            NORMALIZZATORE EVENTI                           */
/* -------------------------------------------------------------------------- */

function normalizeEventoPreviewToCalendarVM(
  p: EventoPreview,
  def: EventoDef,
): CalendarEventVM | null {
  const timeKind: TimeKind = p.timeKind;

  let startAt = p.startAt ?? null;
  let endAt = p.endAt ?? null;

  if (!startAt && !endAt) return null;

  const ensureBoth = () => {
    if (!startAt && endAt) startAt = endAt;
    if (!endAt && startAt) endAt = startAt;
  };

  let allDay = false;

  switch (timeKind) {
    case "interval":
      ensureBoth();
      if (!startAt || !endAt) return null;
      break;

    case "point":
      ensureBoth();
      if (!startAt && !endAt) return null;
    {
      const base = startAt ?? endAt!;
      startAt = base;
      endAt = base;
    }
      break;

    case "deadline": {
      const base = endAt ?? startAt;
      if (!base) return null;
      const d = new Date(base);
      const range = buildDayRangeFromDate(d);
      startAt = range.startIso;
      endAt = range.endIso;
      allDay = true;
      break;
    }

    case "recurring_master":
    case "recurring_occurrence":
      ensureBoth();
      if (!startAt || !endAt) return null;
      break;

    default:
      ensureBoth();
      if (!startAt || !endAt) return null;
      break;
  }

  return {
    id: p.id,
    title: p.displayName,
    subtitle: p.subtitle,
    notes: null,
    start: startAt!,
    end: endAt!,
    allDay,
    timeKind,
    visibilityRole: p.visibilityRole ?? null,
    typeSlug: def.slug,
    typeLabel: def.label,
  };
}

/* -------------------------------------------------------------------------- */
/*                              PROPS                                         */
/* -------------------------------------------------------------------------- */

export type AulaScope = {
  gruppoType: string;
  gruppoId: string;
  aulaLabel: string;
  partecipantiAula: AnagraficaPreview[];
  partecipanteAnagraficaType: string;
};

export type AnagraficaScope = {
  anagraficaType: string;
  anagraficaId: string;
  anagraficaLabel: string;
};

type PendingFormState = {
  range: { dateStart: string; dateEnd: string };
  typeSlug: string;
  initialTimeStart?: string;
  initialTimeEnd?: string;
  forceUseTime?: boolean;
  forAula?: boolean;
  forAnagrafica?: boolean;
};

type PresenzeModalState = {
  eventId: string;
  typeSlug: string;
} | null;

type CalendarBoxProps = {
  aulaScope?: AulaScope;
  anagraficaScope?: AnagraficaScope;
};

/* -------------------------------------------------------------------------- */
/*                              COMPONENTE                                    */
/* -------------------------------------------------------------------------- */

export default function CalendarBox({ aulaScope, anagraficaScope }: CalendarBoxProps) {
  const dispatch = useAppDispatch();
  const eventiByType = useAppSelector((s) => s.eventi.byType);

  const isAulaMode = !!aulaScope;
  const isAnagraficaMode = !!anagraficaScope;
  const selectionModeEnabled = CALENDAR_CONFIG.features.selectionMode;

  /* --------------------------------- TIPI ---------------------------------- */

  const allEventDefs: EventoDef[] = useMemo(() => {
    const defs = getEventiList();
    const order = CALENDAR_CONFIG.colorOrder;

    if (!order || order.length === 0) return defs;

    const orderMap = new Map(order.map((slug, i) => [slug, i]));
    return [...defs].sort((a, b) => {
      const ia = orderMap.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderMap.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }, []);

  const typeColorMap = useMemo(() => {
    const palette = TYPE_COLOR_PALETTE.length;
    const out: Record<string, number> = {};

    const ordered =
      CALENDAR_CONFIG.colorOrder && CALENDAR_CONFIG.colorOrder.length
        ? CALENDAR_CONFIG.colorOrder
        : allEventDefs.map((d) => d.slug);

    ordered.forEach((slug, i) => {
      out[slug] = i % palette;
    });

    return out;
  }, [allEventDefs]);

  const [selectedTypeSlugs, setSelectedTypeSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (selectedTypeSlugs.length === 0 && allEventDefs.length > 0) {
      setSelectedTypeSlugs(allEventDefs.map((d) => d.slug));
    }
  }, [allEventDefs, selectedTypeSlugs.length]);

  /* ---------------------------------- FETCH -------------------------------- */

  const [month, setMonth] = useState<string>(getCurrentMonthISO());
  const { timeFrom, timeTo } = useMemo(() => monthBounds(month), [month]);

  useEffect(() => {
    if (selectedTypeSlugs.length === 0) return;

    const active = new Set(selectedTypeSlugs);

    allEventDefs.forEach((def) => {
      if (!active.has(def.slug)) return;

      dispatch(
        fetchEventi({
          type: def.slug,
          timeFrom,
          timeTo,
          ...(isAulaMode && {
            gruppoType: aulaScope!.gruppoType,
            gruppoId: aulaScope!.gruppoId,
          }),
          ...(isAnagraficaMode && {
            anagraficaType: anagraficaScope!.anagraficaType,
            anagraficaId: anagraficaScope!.anagraficaId,
          }),
        }) as any,
      );
    });
  }, [
    dispatch,
    allEventDefs,
    selectedTypeSlugs,
    timeFrom,
    timeTo,
    isAulaMode,
    aulaScope,
    isAnagraficaMode,
    anagraficaScope,
  ]);

  /* ----------------------------- NORMALIZZA EVENTS -------------------------- */

  const calendarEvents: CalendarEventVM[] = useMemo(() => {
    if (selectedTypeSlugs.length === 0) return [];

    const active = new Set(selectedTypeSlugs);
    const out: CalendarEventVM[] = [];

    allEventDefs.forEach((def) => {
      if (!active.has(def.slug)) return;

      const bucket = eventiByType[def.slug];
      const items = bucket?.items ?? [];

      items.forEach((p) => {
        const vm = normalizeEventoPreviewToCalendarVM(p, def);
        if (vm) out.push(vm);
      });
    });

    return out;
  }, [allEventDefs, eventiByType, selectedTypeSlugs]);

  /* ----------------------------- STATUS ------------------------------------- */

  const status = useMemo(() => {
    if (selectedTypeSlugs.length === 0) return "idle";

    const active = new Set(selectedTypeSlugs);

    let loading = false;
    let failed = false;

    allEventDefs.forEach((def) => {
      if (!active.has(def.slug)) return;

      const bucket = eventiByType[def.slug];
      if (!bucket) return;

      if (bucket.status === "loading") loading = true;
      if (bucket.status === "failed") failed = true;
    });

    if (loading) return "loading";
    if (failed) return "failed";
    return "idle";
  }, [allEventDefs, selectedTypeSlugs, eventiByType]);

  /* ------------------------------ UI STATE ---------------------------------- */

  const hostRef = useRef<HTMLDivElement | null>(null);

  const [dayISO, setDayISO] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);

  const [pendingForm, setPendingForm] = useState<PendingFormState | null>(null);
  const [presenzeModal, setPresenzeModal] = useState<PresenzeModalState>(null);

  /* ------------------------------ CONTEXT MENU ------------------------------ */

  const {
    menuVisible,
    menuPos,
    menuCentered,
    ctxPayload,
    openMenuDay,
    openMenuHour,
    openMenuEvent,
    closeMenu,
  } = useContextMenu();

  useEffect(() => {
    if (createMode) setDayISO(null);
  }, [createMode]);

  const defaultTypeSlug = selectedTypeSlugs[0] ?? allEventDefs[0]?.slug ?? "";

  const handleCreateNewFromCtx = () => {
    if (!ctxPayload) return;
    if (!defaultTypeSlug) return;

    const baseRange = {
      dateStart: ctxPayload.isoDate,
      dateEnd: ctxPayload.isoDate,
    };

    const st: PendingFormState = {
      range: baseRange,
      typeSlug: defaultTypeSlug,
      forAula: isAulaMode ? true : false,
      forAnagrafica: isAnagraficaMode ? true : false,
    };

    if (ctxPayload.kind === "hour") {
      const h = ctxPayload.hour!;
      st.initialTimeStart = `${pad2(h)}:00`;
      st.initialTimeEnd = `${pad2((h + 1) % 24)}:00`;
      st.forceUseTime = true;
    }

    setPendingForm(st);
  };

  const handleDeleteFromCtx = async (eventId: string, typeSlug: string) => {
    if (!eventId || !typeSlug) return;

    await dispatch(deleteEvento({ type: typeSlug, id: eventId }) as any);

    const { timeFrom: tf, timeTo: tt } = monthBounds(month);

    await dispatch(
      fetchEventi({
        type: typeSlug,
        timeFrom: tf,
        timeTo: tt,
        ...(isAulaMode && {
          gruppoType: aulaScope!.gruppoType,
          gruppoId: aulaScope!.gruppoId,
        }),
        ...(isAnagraficaMode && {
          anagraficaType: anagraficaScope!.anagraficaType,
          anagraficaId: anagraficaScope!.anagraficaId,
        }),
      }) as any,
    );
  };

  /* ------------------------------- DAY VIEW -------------------------------- */

  const eventsForDayView = useMemo(() => {
    if (!dayISO) return [];

    return calendarEvents.filter((ev) => {
      const d = dayISO;
      const evStart = isoDayFromIsoDateTime(ev.start);
      const evEnd = isoDayFromIsoDateTime(ev.end);
      return evStart <= d && evEnd >= d;
    });
  }, [calendarEvents, dayISO]);

  /* ------------------------------- HANDLERS -------------------------------- */

  const handleSwitchView = () => {
    if (dayISO) {
      setDayISO(null);
    } else if (ctxPayload?.kind === "day") {
      setDayISO(ctxPayload.isoDate);
    }
  };

  const handleHourContext = (e: React.MouseEvent, iso: string, hour: number) => {
    openMenuHour(e, iso, hour);
  };

  const toggleType = (slug: string) => {
    setSelectedTypeSlugs((prev) => {
      if (prev.includes(slug)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug];
    });
  };

  const stepMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  };

  /* ---------------------- COLOR SCHEME PER GRID (month) --------------------- */

  const monthGridColorSchemes = useMemo(
    () =>
      TYPE_COLOR_PALETTE.map((p) => ({
        pillSolid: p.pillSolid,
        pillMiddle: p.pillMiddle,
      })),
    [],
  );

  /* -------------------------------------------------------------------------- */
  /*                             RENDER                                         */
  /* -------------------------------------------------------------------------- */

  return (
    <div ref={hostRef} className={cn("relative overflow-hidden transition-all", "rounded-[10px] bg-transparent")}>
      <div className="relative rounded-[14px] bg-white p-3 shadow-1 dark:bg-gray-dark dark:shadow-card">
        {/* FILTRI TIPI EVENTO */}
        <div className="mb-3 flex flex-wrap gap-2">
          {allEventDefs.map((def) => {
            const Icon = def.icon;
            const checked = selectedTypeSlugs.includes(def.slug);
            const colorIdx = typeColorMap[def.slug] ?? 0;
            const palette = TYPE_COLOR_PALETTE[colorIdx];

            return (
              <label
                key={def.slug}
                className={cn(
                  "inline-flex items-center gap-2 rounded_full border px-3 py-1 text-xs transition",
                  checked ? palette.filterChecked : palette.filterUnchecked,
                )}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={checked}
                  onChange={() => toggleType(def.slug)}
                />
                <Icon className="h-4 w-4 opacity-80" />
                <span className="whitespace-nowrap">{def.label}</span>
              </label>
            );
          })}
        </div>

        <CalendarMonthGrid
          month={month}
          events={calendarEvents}
          status={status}
          onPrevMonth={() => stepMonth(-1)}
          onNextMonth={() => stepMonth(1)}
          createMode={createMode && selectionModeEnabled}
          onToggleCreate={selectionModeEnabled ? setCreateMode : undefined}
          onCreateRange={(r) =>
            setPendingForm({
              range: r,
              typeSlug: defaultTypeSlug,
              forAula: isAulaMode ? true : false,
              forAnagrafica: isAnagraficaMode ? true : false,
            })
          }
          onDayMenu={(e, iso) => openMenuDay(e, iso)}
          onEventMenu={(e, iso, ev) => openMenuEvent(e, iso, ev.id, ev.typeSlug)}
          typeColorMap={typeColorMap}
          colorSchemes={monthGridColorSchemes}
          selectionModeEnabled={selectionModeEnabled}
        />

        {/* VISTA GIORNO */}
        {!createMode && dayISO && (
          <DayViewModal
            isoDate={dayISO}
            events={eventsForDayView}
            availableTypes={allEventDefs}
            selectedTypeSlugs={selectedTypeSlugs}
            onToggleType={toggleType}
            typeColorMap={typeColorMap}
            onClose={() => setDayISO(null)}
            onStep={(delta) => {
              const d = new Date(dayISO);
              d.setDate(d.getDate() + delta);
              setDayISO(d.toISOString().slice(0, 10));
            }}
            onHourContext={(e, hour) => handleHourContext(e, dayISO, hour)}
          />
        )}

        {/* FORM CREAZIONE */}
        {pendingForm &&
          (isAulaMode && pendingForm.forAula ? (
            <EventFormModalAula
              aulaType={aulaScope!.gruppoType}
              aulaId={aulaScope!.gruppoId}
              aulaLabel={aulaScope!.aulaLabel}
              partecipantiAula={aulaScope!.partecipantiAula}
              partecipanteAnagraficaType={aulaScope!.partecipanteAnagraficaType}
              availableTypes={allEventDefs}
              typeSlug={pendingForm.typeSlug}
              range={pendingForm.range}
              initialTimeStart={pendingForm.initialTimeStart}
              initialTimeEnd={pendingForm.initialTimeEnd}
              forceUseTime={pendingForm.forceUseTime}
              onClose={() => setPendingForm(null)}
            />
          ) : isAnagraficaMode && pendingForm.forAnagrafica ? (
            <EventFormModalAnagrafica
              anagraficaType={anagraficaScope!.anagraficaType}
              anagraficaId={anagraficaScope!.anagraficaId}
              anagraficaLabel={anagraficaScope!.anagraficaLabel}
              availableTypes={allEventDefs}
              typeSlug={pendingForm.typeSlug}
              range={pendingForm.range}
              initialTimeStart={pendingForm.initialTimeStart}
              initialTimeEnd={pendingForm.initialTimeEnd}
              forceUseTime={pendingForm.forceUseTime}
              onClose={() => setPendingForm(null)}
            />
          ) : (
            <EventFormModal
              availableTypes={allEventDefs}
              typeSlug={pendingForm.typeSlug}
              range={pendingForm.range}
              onClose={() => setPendingForm(null)}
              initialTimeStart={pendingForm.initialTimeStart}
              initialTimeEnd={pendingForm.initialTimeEnd}
              forceUseTime={pendingForm.forceUseTime}
            />
          ))}

        {/* MODAL PRESENZE AULA */}
        {presenzeModal && isAulaMode && (
          <PresenzeFormModalAula
            aulaType={aulaScope!.gruppoType}
            aulaId={aulaScope!.gruppoId}
            aulaLabel={aulaScope!.aulaLabel}
            partecipantiAula={aulaScope!.partecipantiAula}
            partecipanteAnagraficaType={aulaScope!.partecipanteAnagraficaType}
            eventId={presenzeModal.eventId}
            typeSlug={presenzeModal.typeSlug}
            onClose={() => setPresenzeModal(null)}
          />
        )}

        {/* MENU CONTESTUALE */}
        {menuVisible &&
          (isAulaMode ? (
            <CalendarContextMenuAula
              x={menuPos.x}
              y={menuPos.y}
              centered={menuCentered}
              payload={ctxPayload as any}
              availableTypes={allEventDefs}
              onClose={closeMenu}
              onCreateNewAula={handleCreateNewFromCtx}
              onDeleteEvent={handleDeleteFromCtx}
              onEditPresenze={(eventId, typeSlug) => {
                setPresenzeModal({ eventId, typeSlug });
              }}
            />
          ) : (
            <CalendarContextMenu
              x={menuPos.x}
              y={menuPos.y}
              centered={menuCentered}
              payload={ctxPayload}
              isDayView={!!dayISO}
              onClose={closeMenu}
              onCreateNew={handleCreateNewFromCtx}
              onDeleteEvent={handleDeleteFromCtx}
              onSwitchView={handleSwitchView}
            />
          ))}
      </div>
    </div>
  );
}
