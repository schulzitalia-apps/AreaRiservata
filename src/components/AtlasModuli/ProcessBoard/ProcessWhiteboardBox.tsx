"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchEventi } from "@/components/Store/slices/eventiSlice";

import { getEventiList, type EventoDef } from "@/config/eventi.registry";
import { TYPE_COLOR_PALETTE } from "@/components/AtlasModuli/Calendario/color-palette";

import { buildWindowRange, cmpIso } from "./utils/dateRange";
import {
  normalizeEventoPreviewToWhiteboardVM,
  extractParticipantsFromEventoFull,
} from "./mappers";

import type { WhiteboardEventVM, WhiteboardParticipant } from "./types";
import TypeFilters from "./Filters/TypeFilters";
import ParticipantFilters from "./Filters/ParticipantFilters";
import ParticipantLane from "./Lanes/ParticipantLane";

import { useWhiteboardEventDetails } from "./hooks/useWhiteboardEventDetails";
import { useParticipantNameCache } from "./hooks/useParticipantNameCache";

// ✅ nuovo componente: dropdown intervallo giorni (logica separata)
import WindowDaysDropdown from "./Filters/WindowDaysDropdown";

type Props = {
  windowDays?: number;
};

export default function ProcessWhiteboardBox({ windowDays = 120 }: Props) {
  const dispatch = useAppDispatch();
  const eventiByType = useAppSelector((s) => s.eventi.byType);

  /* ----------------------------- EVENT DEFINITIONS ----------------------------- */

  const allEventDefs: EventoDef[] = useMemo(() => getEventiList(), []);

  const typeColorMap = useMemo(() => {
    const paletteLen = TYPE_COLOR_PALETTE.length;
    const out: Record<string, number> = {};
    allEventDefs.forEach((d, i) => (out[d.slug] = i % paletteLen));
    return out;
  }, [allEventDefs]);

  // ✅ di default: NESSUN tipo selezionato
  const [selectedTypeSlugs, setSelectedTypeSlugs] = useState<string[]>([]);

  const toggleType = (slug: string) => {
    setSelectedTypeSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  /* ------------------------------ RANGE SELECTOR ------------------------------ */

  const [selectedWindowDays, setSelectedWindowDays] =
    useState<number>(windowDays);

  /* ---------------------------------- FETCH ---------------------------------- */

  const { timeFrom, timeTo } = useMemo(
    () => buildWindowRange(selectedWindowDays),
    [selectedWindowDays],
  );

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
        }) as any,
      );
    });
  }, [dispatch, allEventDefs, selectedTypeSlugs, timeFrom, timeTo]);

  /* ----------------------------- NORMALIZZA EVENTS ---------------------------- */

  const allEvents: WhiteboardEventVM[] = useMemo(() => {
    if (selectedTypeSlugs.length === 0) return [];
    const active = new Set(selectedTypeSlugs);

    const out: WhiteboardEventVM[] = [];

    allEventDefs.forEach((def) => {
      if (!active.has(def.slug)) return;

      const bucket = eventiByType[def.slug];
      const items = bucket?.items ?? [];

      items.forEach((p: any) => {
        const vm = normalizeEventoPreviewToWhiteboardVM(p, def);
        if (vm) out.push(vm);
      });
    });

    out.sort((a, b) => cmpIso(a.start, b.start));
    return out;
  }, [allEventDefs, eventiByType, selectedTypeSlugs]);

  /* ---------------------- FETCH DETTAGLI (EventoFull) ------------------------- */

  const detailTargets = useMemo(
    () => allEvents.map((e) => ({ typeSlug: e.typeSlug, id: e.id })),
    [allEvents],
  );

  const { detailsByKey, loading: detailsLoading } = useWhiteboardEventDetails(
    detailTargets,
    true,
  );

  const enrichedEvents: WhiteboardEventVM[] = useMemo(() => {
    return allEvents.map((ev) => {
      const k = `${ev.typeSlug}:${ev.id}`;
      const full = detailsByKey[k];
      if (!full) return ev;

      const participants = extractParticipantsFromEventoFull(full);
      return { ...ev, participants };
    });
  }, [allEvents, detailsByKey]);

  /* ----------------------------- PARTECIPANT LIST ----------------------------- */

  const participantsRaw: WhiteboardParticipant[] = useMemo(() => {
    const map = new Map<string, WhiteboardParticipant>();

    enrichedEvents.forEach((ev) => {
      (ev.participants || []).forEach((p) => {
        if (!map.has(p.key)) map.set(p.key, p);
      });
    });

    return [...map.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [enrichedEvents]);

  const { participants: participantsResolved, loading: namesLoading } =
    useParticipantNameCache(participantsRaw);

  /* ----------------------------- SELEZIONE PARTECIPANTI ----------------------------- */

  const [selectedParticipantKeys, setSelectedParticipantKeys] = useState<
    string[]
  >([]);

  const toggleParticipant = (key: string) => {
    setSelectedParticipantKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectedParticipants = useMemo(() => {
    const set = new Set(selectedParticipantKeys);
    return participantsResolved.filter((p) => set.has(p.key));
  }, [participantsResolved, selectedParticipantKeys]);

  /* ---------------------------- EVENTS PER PARTECIPANTE ---------------------------- */

  const eventsByParticipant = useMemo(() => {
    const map = new Map<string, WhiteboardEventVM[]>();
    selectedParticipants.forEach((p) => map.set(p.key, []));

    enrichedEvents.forEach((ev) => {
      const keys = new Set((ev.participants || []).map((p) => p.key));
      selectedParticipants.forEach((sp) => {
        if (keys.has(sp.key)) map.get(sp.key)!.push(ev);
      });
    });

    for (const [, arr] of map) arr.sort((a, b) => cmpIso(a.start, b.start));
    return map;
  }, [enrichedEvents, selectedParticipants]);

  /* ---------------------------------- STATUS ---------------------------------- */

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

  /* ----------------------------------- RENDER ----------------------------------- */

  return (
    // ✅ niente overflow-hidden (clipperebbe dropdown)
    <div className="relative rounded-[10px] bg-transparent">
      <div className="rounded-[14px] bg-white p-3 shadow-1 dark:bg-gray-dark dark:shadow-card">
        {/* HEADER */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-slate-900 px-4 py-1 text-sm font-semibold text-slate-50 dark:bg-sky-500 dark:text-slate-950">
            Whiteboard Processi
          </div>

          {/* ✅ testo esplicito: in light non eredita bianco */}
          <div className="text-[12px] text-dark opacity-70 dark:text-white">
            Range: {timeFrom.slice(0, 10)} → {timeTo.slice(0, 10)}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* ✅ Dropdown intervallo (ora separato + scroll interno + righe) */}
            <WindowDaysDropdown
              value={selectedWindowDays}
              onChange={setSelectedWindowDays}
            />

            {/* ✅ pill "eventi in memoria" con bg+text espliciti */}
            <div
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold",
                "border-stroke bg-white text-dark",
                "dark:border-dark-3 dark:bg-dark-4 dark:text-white",
              )}
            >
              {allEvents.length} eventi in memoria
            </div>
          </div>
        </div>

        {/* FILTRI TIPO */}
        <div className="mb-3">
          <TypeFilters
            defs={allEventDefs}
            selected={selectedTypeSlugs}
            onToggle={toggleType}
            typeColorMap={typeColorMap}
          />
        </div>

        {/* FILTRI PARTECIPANTI */}
        <div className="mb-3">
          <ParticipantFilters
            participants={participantsResolved}
            selectedKeys={selectedParticipantKeys}
            onToggle={toggleParticipant}
            onSelectAll={() =>
              setSelectedParticipantKeys(participantsResolved.map((p) => p.key))
            }
            onSelectNone={() => setSelectedParticipantKeys([])}
          />
        </div>

        {/* STATUS */}
        {status === "loading" ? (
          <div className="mb-3 rounded-xl border border-stroke bg-gray-2/50 p-3 text-sm opacity-80 dark:border-dark-3 dark:bg-dark-2/30">
            Caricamento eventi…
          </div>
        ) : null}

        {status === "failed" ? (
          <div className="mb-3 rounded-xl border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-100">
            Errore durante il caricamento eventi (almeno un tipo ha fallito).
          </div>
        ) : null}

        {detailsLoading ? (
          <div className="mb-3 rounded-xl border border-stroke bg-gray-2/50 p-3 text-sm opacity-80 dark:border-dark-3 dark:bg-dark-2/30">
            Caricamento partecipanti…
          </div>
        ) : null}

        {namesLoading ? (
          <div className="mb-3 rounded-xl border border-stroke bg-gray-2/50 p-3 text-sm opacity-80 dark:border-dark-3 dark:bg-dark-2/30">
            Risoluzione nomi partecipanti…
          </div>
        ) : null}

        {/* LANES */}
        <div
          className={cn(
            "grid gap-3",
            "grid-cols-1",
            "sm:grid-cols-2",
            "md:grid-cols-3",
            "lg:grid-cols-4",
            "xl:grid-cols-5",
          )}
        >
          {selectedParticipants.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-stroke bg-white p-6 text-center text-sm opacity-70 dark:border-dark-3 dark:bg-gray-dark">
              Seleziona uno o più partecipanti per vedere i processi.
            </div>
          ) : (
            selectedParticipants.map((p) => (
              <ParticipantLane
                key={p.key}
                participant={p}
                events={eventsByParticipant.get(p.key) ?? []}
                typeColorMap={typeColorMap}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
