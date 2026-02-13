"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "@/components/Store/hooks";
import { createEvento, fetchEventi } from "@/components/Store/slices/eventiSlice";
import { monthBounds, buildLocalDateTime } from "../utils";
import type { EventoDef } from "@/config/eventi.registry";

import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/server-utils/lib/utils";

type LinkedItem = {
  id: string;
  displayName: string;
  subtitle: string | null;
};

type Props = {
  availableTypes: EventoDef[];
  typeSlug: string; // initial

  range: { dateStart: string; dateEnd: string };
  onClose: () => void;

  initialTimeStart?: string;
  initialTimeEnd?: string;
  forceUseTime?: boolean;
};

/** Aggiunge giorni a una data ISO (YYYY-MM-DD) in modo deterministico (UTC). */
function addDaysToIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function EventFormModal({
                                         availableTypes,
                                         typeSlug: initialTypeSlug,
                                         range,
                                         onClose,
                                         initialTimeStart,
                                         initialTimeEnd,
                                         forceUseTime,
                                       }: Props) {
  const dispatch = useAppDispatch();

  const inputClass = cn(
    "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none",
    "focus:border-primary",
    "dark:border-dark-3 dark:text-white",
  );

  const smallInputClass = cn(
    "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-[11px] outline-none",
    "focus:border-primary",
    "dark:border-dark-3 dark:text-white",
  );

  /* -------------------------- TIPO EVENTO (SWITCH) -------------------------- */

  const typeOptions = useMemo(
    () => (availableTypes || []).map((d) => [d.slug, d.label] as const),
    [availableTypes],
  );

  const [typeSlug, setTypeSlug] = useState<string>(
    initialTypeSlug || availableTypes[0]?.slug || "",
  );

  // se cambia l'initial (es. apri modale da context diverso) riallineo
  useEffect(() => {
    setTypeSlug(initialTypeSlug || availableTypes[0]?.slug || "");
  }, [initialTypeSlug, availableTypes]);

  const selectedDef = useMemo(
    () => availableTypes.find((d) => d.slug === typeSlug) ?? availableTypes[0],
    [availableTypes, typeSlug],
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  /* -------------------------- VISIBILITY ROLE -------------------------- */

  const rawVisibilityOptions =
    selectedDef?.visibilityOptions ?? ([["", "Solo proprietario"]] as any);

  const visibilityOptions = useMemo(() => {
    const hasPublic = (rawVisibilityOptions || []).some(([val]: any) => val === "Public");
    if (hasPublic) return rawVisibilityOptions;

    return [
      ["Public", "Pubblico (visibile a tutti gli utenti abilitati)"],
      ...rawVisibilityOptions,
    ];
  }, [rawVisibilityOptions]);

  const [visibilityRole, setVisibilityRole] = useState<string>(
    visibilityOptions[0]?.[0] ?? "",
  );

  useEffect(() => {
    setVisibilityRole(visibilityOptions[0]?.[0] ?? "");
  }, [visibilityOptions]);

  const visibilityRoleSelectOptions = useMemo(
    () => (visibilityOptions || []).map(([val, label]: any) => [val, label] as const),
    [visibilityOptions],
  );

  /* -------------------------- TIME / ALL DAY -------------------------- */

  const [useTime, setUseTime] = useState<boolean>(!!forceUseTime);
  const [timeStart, setTimeStart] = useState<string>(initialTimeStart ?? "09:00");
  const [timeEnd, setTimeEnd] = useState<string>(initialTimeEnd ?? "10:00");

  useEffect(() => {
    if (initialTimeStart) setTimeStart(initialTimeStart);
    if (initialTimeEnd) setTimeEnd(initialTimeEnd);
    if (forceUseTime) setUseTime(true);
  }, [initialTimeStart, initialTimeEnd, forceUseTime]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ------------------------ END DATE (SHIFT) ------------------------ */

  const [endDate, setEndDate] = useState<string>(range.dateEnd);

  useEffect(() => {
    setEndDate(range.dateEnd);
  }, [range.dateStart, range.dateEnd]);

  const sameDay = endDate === range.dateStart;
  const canDecreaseEnd = endDate > range.dateStart;

  const shiftEndDate = (delta: number) => {
    setEndDate((prev) => {
      const current = prev || range.dateStart;
      let next = addDaysToIso(current, delta);
      if (next < range.dateStart) next = range.dateStart;
      return next;
    });
  };

  /* ------------------------ LINKS: AULE / ANAGRAFICHE ------------------------ */

  const canAttachAula = (selectedDef?.allowedAulaTypes.length ?? 0) > 0;
  const canAttachAnagrafiche = (selectedDef?.allowedAnagraficaTypes.length ?? 0) > 0;

  // AULA
  const [aulaType, setAulaType] = useState<string>(selectedDef?.allowedAulaTypes[0] ?? "");
  const [aulaSearch, setAulaSearch] = useState("");
  const [aulaResults, setAulaResults] = useState<LinkedItem[]>([]);
  const [aulaLoading, setAulaLoading] = useState(false);
  const [selectedAula, setSelectedAula] = useState<LinkedItem | null>(null);

  // ANAGRAFICHE
  const [anagType, setAnagType] = useState<string>(selectedDef?.allowedAnagraficaTypes[0] ?? "");
  const [anagSearch, setAnagSearch] = useState("");
  const [anagResults, setAnagResults] = useState<LinkedItem[]>([]);
  const [anagLoading, setAnagLoading] = useState(false);
  const [selectedAnagrafiche, setSelectedAnagrafiche] = useState<LinkedItem[]>([]);

  // ✅ quando cambio tipo evento, resetto roba dipendente
  useEffect(() => {
    setAulaType(selectedDef?.allowedAulaTypes[0] ?? "");
    setAulaSearch("");
    setAulaResults([]);
    setSelectedAula(null);

    setAnagType(selectedDef?.allowedAnagraficaTypes[0] ?? "");
    setAnagSearch("");
    setAnagResults([]);
    setSelectedAnagrafiche([]);
  }, [selectedDef?.slug, selectedDef?.allowedAulaTypes, selectedDef?.allowedAnagraficaTypes]);

  const aulaTypeOptions = useMemo(
    () => (selectedDef?.allowedAulaTypes || []).map((t) => [t, t] as const),
    [selectedDef?.allowedAulaTypes],
  );

  const anagTypeOptions = useMemo(
    () => (selectedDef?.allowedAnagraficaTypes || []).map((t) => [t, t] as const),
    [selectedDef?.allowedAnagraficaTypes],
  );

  async function searchAule() {
    if (!aulaType) return;
    setAulaLoading(true);
    try {
      const params = new URLSearchParams();
      if (aulaSearch.trim()) params.set("query", aulaSearch.trim());
      params.set("page", "1");
      params.set("pageSize", "20");

      const res = await fetch(`/api/aule/${encodeURIComponent(aulaType)}?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Errore ricerca aule");

      const items = (json.items || []) as any[];
      setAulaResults(
        items.map((m) => ({
          id: m.id,
          displayName: m.displayName || m.label || "(senza nome)",
          subtitle: m.subtitle ?? null,
        })),
      );
    } catch (e: any) {
      setErr(e?.message || "Errore durante la ricerca aule");
    } finally {
      setAulaLoading(false);
    }
  }

  async function searchAnagrafiche() {
    if (!anagType) return;
    setAnagLoading(true);
    try {
      const params = new URLSearchParams();
      if (anagSearch.trim()) params.set("query", anagSearch.trim());
      params.set("page", "1");
      params.set("pageSize", "20");

      const res = await fetch(`/api/anagrafiche/${encodeURIComponent(anagType)}?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Errore ricerca anagrafiche");

      const items = (json.items || []) as any[];
      setAnagResults(
        items.map((m) => ({
          id: m.id,
          displayName: m.displayName || "(senza nome)",
          subtitle: m.subtitle ?? null,
        })),
      );
    } catch (e: any) {
      setErr(e?.message || "Errore durante la ricerca anagrafiche");
    } finally {
      setAnagLoading(false);
    }
  }

  function toggleAnagrafica(item: LinkedItem) {
    setSelectedAnagrafiche((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      if (exists) return prev.filter((p) => p.id !== item.id);
      return [...prev, item];
    });
  }

  /* --------------------------------- SUBMIT -------------------------------- */

  async function submit() {
    try {
      setBusy(true);
      setErr(null);

      if (!title.trim()) throw new Error("Titolo obbligatorio");

      if (useTime) {
        if (timeStart === timeEnd) throw new Error("L'ora di fine deve essere successiva all'ora di inizio");
        if (timeEnd < timeStart) throw new Error("Intervallo orario non valido");
      }

      const dateStart = range.dateStart;
      const dateEnd = endDate;

      let startAt: string;
      let endAt: string;
      let allDay = false;
      let timeKind: "point" | "interval" = "interval";

      if (useTime) {
        startAt = buildLocalDateTime(dateStart, timeStart);
        endAt = buildLocalDateTime(dateEnd, timeEnd);
      } else {
        allDay = true;
        startAt = buildLocalDateTime(dateStart, "00:00");
        endAt = buildLocalDateTime(dateEnd, "23:59");
      }

      const gruppo =
        selectedAula && aulaType
          ? { gruppoType: aulaType, gruppoId: selectedAula.id }
          : null;

      const partecipanti = selectedAnagrafiche.map((p) => ({
        anagraficaType: anagType,
        anagraficaId: p.id,
        role: null,
        status: null,
        quantity: null,
        note: null,
      }));

      const payload: any = {
        data: {
          titolo: title,
          descrizione: notes,
          aulaCollegata:
            selectedAula && aulaType
              ? { type: aulaType, anagraficaId: selectedAula.id, displayName: selectedAula.displayName }
              : null,
          partecipantiCollegati: selectedAnagrafiche.map((p) => ({
            type: anagType,
            anagraficaId: p.id,
            displayName: p.displayName,
          })),
        },

        timeKind,
        startAt,
        endAt,
        allDay,

        gruppo,
        partecipanti,

        visibilityRole: visibilityRole || null,
      };

      // ✅ usa il tipo selezionato nel dropdown
      const type = selectedDef.slug;

      await dispatch(createEvento({ type, payload }) as any);

      const monthStr = dateStart.slice(0, 7);
      const { timeFrom, timeTo } = monthBounds(monthStr);

      await dispatch(fetchEventi({ type, timeFrom, timeTo }) as any);

      onClose();
    } catch (e: any) {
      setErr(e?.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------------- UI ---------------------------------- */

  return (
    <Modal
      open={true}
      onClose={busy ? () => {} : onClose}
      title="Nuovo evento calendario"
      maxWidthClassName="max-w-4xl"
      zIndexClassName="z-[110]"
      disableClose={busy}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* COLONNA SINISTRA */}
          <div className="space-y-4">
            {/* ✅ SWITCH TIPO EVENTO */}
            <div className="text-sm">
              <Select
                label="Tipo evento"
                value={typeSlug}
                onChange={(v) => setTypeSlug(String(v))}
                options={typeOptions as any}
                disabled={busy}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-dark dark:text-white">
                Dal
                <input className={inputClass} value={range.dateStart} readOnly />
              </label>

              <div>
                <label className="text-xs text-dark dark:text-white">Al</label>
                <div className="mt-1 flex items-center gap-2">
                  <input className={inputClass.replace("mt-1", "")} value={endDate} readOnly />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shiftEndDate(-1)}
                      disabled={!canDecreaseEnd || busy}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-xs text-dark hover:bg-gray-2 disabled:opacity-40 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftEndDate(+1)}
                      disabled={busy}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stroke text-xs text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-1 text-[11px]">
                  {sameDay ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200">
                      Stesso giorno
                    </span>
                  ) : (
                    <span className="text-dark/60 dark:text-white/60">Sposta la data di fine con + / −</span>
                  )}
                </div>
              </div>
            </div>

            <label className="text-xs text-dark dark:text-white">
              Titolo *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                maxLength={200}
                disabled={busy}
                placeholder="Es. Lezione / Riunione / Evento…"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2 md:items-end">
              <div className="text-sm">
                <Select
                  label="Visibilità"
                  value={visibilityRole}
                  onChange={(v) => setVisibilityRole(String(v))}
                  options={visibilityRoleSelectOptions as any}
                  disabled={busy}
                />
              </div>

              <label className="flex select-none items-center gap-2 rounded-xl border border-stroke px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white">
                <input
                  type="checkbox"
                  checked={useTime}
                  onChange={(e) => setUseTime(e.target.checked)}
                  disabled={busy}
                />
                Specifica orari
              </label>
            </div>

            {useTime && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-dark dark:text-white">
                  Ora inizio
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                  />
                </label>

                <label className="text-xs text-dark dark:text-white">
                  Ora fine
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                  />
                </label>
              </div>
            )}

            <label className="text-xs text-dark dark:text-white">
              Note / descrizione
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={cn(inputClass, "resize-none")}
                disabled={busy}
                placeholder="Opzionale…"
              />
            </label>
          </div>

          {/* COLONNA DESTRA */}
          {(canAttachAula || canAttachAnagrafiche) ? (
            <div className="space-y-4 rounded-2xl border border-stroke bg-gray-2/40 p-3 dark:border-dark-3 dark:bg-dark-2/20">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-dark/60 dark:text-white/60">
                Partecipazioni
              </div>

              {/* AULA */}
              {canAttachAula && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-dark/70 dark:text-white/70">
                      Aula partecipante
                    </span>
                    {selectedAula ? (
                      <button
                        type="button"
                        onClick={() => setSelectedAula(null)}
                        disabled={busy}
                        className="text-[11px] font-semibold text-red-500 hover:underline disabled:opacity-60"
                      >
                        Rimuovi
                      </button>
                    ) : null}
                  </div>

                  {(selectedDef?.allowedAulaTypes.length ?? 0) > 1 && (
                    <div className="text-sm">
                      <Select
                        label="Tipo aula"
                        value={aulaType}
                        onChange={(v) => {
                          const next = String(v);
                          setAulaType(next);
                          setAulaResults([]);
                          setSelectedAula(null);
                        }}
                        options={aulaTypeOptions as any}
                        disabled={busy}
                      />
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-[11px] text-dark dark:text-white">
                      Cerca
                      <input
                        className={smallInputClass}
                        placeholder="Cerca aula…"
                        value={aulaSearch}
                        onChange={(e) => setAulaSearch(e.target.value)}
                        disabled={busy}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={searchAule}
                      disabled={aulaLoading || !aulaType || busy}
                      className="h-[38px] rounded-xl bg-primary px-4 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {aulaLoading ? "…" : "Cerca"}
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-xl border border-stroke p-2 dark:border-dark-3">
                    {aulaResults.length === 0 ? (
                      <div className="p-2 text-[11px] text-dark/60 dark:text-white/60">
                        Nessuna aula trovata.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {aulaResults.map((r) => {
                          const active = selectedAula?.id === r.id;
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedAula((prev) => (prev?.id === r.id ? null : r))}
                                disabled={busy}
                                className={cn(
                                  "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                  "border-stroke dark:border-dark-3",
                                  active
                                    ? "bg-primary/15 border-primary dark:bg-primary/20"
                                    : "hover:bg-gray-2 dark:hover:bg-dark-2",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-[12px] font-semibold text-dark dark:text-white">
                                      {r.displayName}
                                    </div>
                                    {r.subtitle ? (
                                      <div className="truncate text-[11px] text-dark/60 dark:text-white/60">
                                        {r.subtitle}
                                      </div>
                                    ) : null}
                                  </div>
                                  {active ? (
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                                      ✓
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* ANAGRAFICHE */}
              {canAttachAnagrafiche && (
                <div className={cn("space-y-2", canAttachAula ? "border-t border-stroke pt-4 dark:border-dark-3" : "")}>
                  <div className="text-[11px] font-semibold text-dark/70 dark:text-white/70">
                    Anagrafiche partecipanti
                  </div>

                  {(selectedDef?.allowedAnagraficaTypes.length ?? 0) > 1 && (
                    <div className="text-sm">
                      <Select
                        label="Tipo anagrafica"
                        value={anagType}
                        onChange={(v) => {
                          const next = String(v);
                          setAnagType(next);
                          setAnagResults([]);
                          setSelectedAnagrafiche([]);
                        }}
                        options={anagTypeOptions as any}
                        disabled={busy}
                      />
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-[11px] text-dark dark:text-white">
                      Cerca
                      <input
                        className={smallInputClass}
                        placeholder="Cerca persona…"
                        value={anagSearch}
                        onChange={(e) => setAnagSearch(e.target.value)}
                        disabled={busy}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={searchAnagrafiche}
                      disabled={anagLoading || !anagType || busy}
                      className="h-[38px] rounded-xl bg-primary px-4 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {anagLoading ? "…" : "Cerca"}
                    </button>
                  </div>

                  {selectedAnagrafiche.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedAnagrafiche.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white"
                        >
                          <span className="max-w-[160px] truncate">{p.displayName}</span>
                          <button
                            type="button"
                            onClick={() => toggleAnagrafica(p)}
                            disabled={busy}
                            className="text-[10px] leading-none opacity-90 hover:opacity-100 disabled:opacity-60"
                            aria-label="Rimuovi"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto rounded-xl border border-stroke p-2 dark:border-dark-3">
                    {anagResults.length === 0 ? (
                      <div className="p-2 text-[11px] text-dark/60 dark:text-white/60">Nessun risultato.</div>
                    ) : (
                      <ul className="space-y-2">
                        {anagResults.map((r) => {
                          const active = selectedAnagrafiche.some((p) => p.id === r.id);
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => toggleAnagrafica(r)}
                                disabled={busy}
                                className={cn(
                                  "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                  "border-stroke dark:border-dark-3",
                                  active
                                    ? "bg-emerald-600/15 border-emerald-600 dark:bg-emerald-600/20"
                                    : "hover:bg-gray-2 dark:hover:bg-dark-2",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-[12px] font-semibold text-dark dark:text-white">
                                      {r.displayName}
                                    </div>
                                    {r.subtitle ? (
                                      <div className="truncate text-[11px] text-dark/60 dark:text-white/60">
                                        {r.subtitle}
                                      </div>
                                    ) : null}
                                  </div>
                                  {active ? (
                                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                      ✓
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {err ? (
          <div className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-100">
            {err}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Annulla
          </button>

          <button
            onClick={submit}
            disabled={busy}
            className="ml-auto rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Salvo…" : "Crea evento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
