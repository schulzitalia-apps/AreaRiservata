"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "@/components/Store/hooks";
import { createEvento, fetchEventi } from "@/components/Store/slices/eventiSlice";
import { buildLocalDateTime, monthBounds } from "../../utils";

import type { EventoDef } from "@/config/eventi.registry";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

const inputClass =
  "w-full rounded border px-2 py-1 text-sm bg-white text-gray-900 " +
  "dark:border-dark-3 dark:bg-black dark:text-white";

type Props = {
  aulaType: string;
  aulaId: string;
  aulaLabel: string;

  partecipantiAula?: AnagraficaPreview[];

  availableTypes: EventoDef[];
  typeSlug: string; // initial

  range: { dateStart: string; dateEnd: string };

  initialTimeStart?: string;
  initialTimeEnd?: string;
  forceUseTime?: boolean;

  partecipanteAnagraficaType: string;

  onClose: () => void;
};

export default function EventFormModalAula({
                                             aulaType,
                                             aulaId,
                                             aulaLabel,
                                             partecipantiAula,
                                             availableTypes,
                                             typeSlug: initialTypeSlug,
                                             range,
                                             initialTimeStart,
                                             initialTimeEnd,
                                             forceUseTime,
                                             partecipanteAnagraficaType,
                                             onClose,
                                           }: Props) {
  const dispatch = useAppDispatch();

  const listaPartecipanti: AnagraficaPreview[] = useMemo(
    () => partecipantiAula ?? [],
    [partecipantiAula],
  );

  /* -------------------------- TIPO EVENTO (SWITCH) -------------------------- */

  const typeOptions = useMemo(
    () => (availableTypes || []).map((d) => [d.slug, d.label] as const),
    [availableTypes],
  );

  const [typeSlug, setTypeSlug] = useState<string>(
    initialTypeSlug || availableTypes[0]?.slug || "",
  );

  useEffect(() => {
    setTypeSlug(initialTypeSlug || availableTypes[0]?.slug || "");
  }, [initialTypeSlug, availableTypes]);

  const selectedDef: EventoDef = useMemo(
    () => availableTypes.find((d) => d.slug === typeSlug) ?? availableTypes[0],
    [availableTypes, typeSlug],
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  /* VISIBILITÀ */
  const rawVis = selectedDef.visibilityOptions ?? [["", "Solo proprietario"]];
  const [visibilityRole, setVisibilityRole] = useState(rawVis[0]?.[0] ?? "");

  useEffect(() => {
    setVisibilityRole(rawVis[0]?.[0] ?? "");
  }, [rawVis]);

  /* ORARI */
  const [useTime, setUseTime] = useState<boolean>(!!forceUseTime);
  const [timeStart, setTimeStart] = useState(initialTimeStart ?? "09:00");
  const [timeEnd, setTimeEnd] = useState(initialTimeEnd ?? "10:00");

  useEffect(() => {
    if (initialTimeStart) setTimeStart(initialTimeStart);
    if (initialTimeEnd) setTimeEnd(initialTimeEnd);
    if (forceUseTime) setUseTime(true);
  }, [initialTimeStart, initialTimeEnd, forceUseTime]);

  /* Partecipanti */
  const [selezionati, setSelezionati] = useState<string[]>([]);
  const toggle = (id: string) => {
    setSelezionati((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* SALVA */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try {
      setBusy(true);
      setErr(null);

      if (!title.trim()) throw new Error("Titolo obbligatorio");

      const dateStart = range.dateStart;
      const dateEnd = range.dateEnd;

      let startAt: string;
      let endAt: string;
      const allDay = !useTime;

      if (useTime) {
        if (timeStart === timeEnd) throw new Error("L'ora di fine deve essere successiva all'ora di inizio");
        if (timeEnd < timeStart) throw new Error("Intervallo orario non valido");

        startAt = buildLocalDateTime(dateStart, timeStart);
        endAt = buildLocalDateTime(dateEnd, timeEnd);
      } else {
        startAt = buildLocalDateTime(dateStart, "00:00");
        endAt = buildLocalDateTime(dateEnd, "23:59");
      }

      const partecipantiCollegati = selezionati.map((id) => {
        const found = listaPartecipanti.find((p) => p.id === id);
        return {
          type: partecipanteAnagraficaType,
          anagraficaId: id,
          displayName: found?.displayName ?? "",
        };
      });

      const payload: any = {
        data: {
          titolo: title,
          descrizione: notes,
          aulaCollegata: { type: aulaType, anagraficaId: aulaId, displayName: aulaLabel },
          partecipantiCollegati,
        },
        gruppo: { gruppoType: aulaType, gruppoId: aulaId },
        timeKind: useTime ? "interval" : "point",
        startAt,
        endAt,
        allDay,
        visibilityRole: visibilityRole || null,
      };

      const type = selectedDef.slug;

      await dispatch(createEvento({ type, payload }) as any);

      const monthStr = dateStart.slice(0, 7);
      const { timeFrom, timeTo } = monthBounds(monthStr);

      await dispatch(
        fetchEventi({ type, timeFrom, timeTo, gruppoType: aulaType, gruppoId: aulaId }) as any,
      );

      onClose();
    } catch (e: any) {
      setErr(e?.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={() => {
        if (!busy) onClose();
      }}
      disableClose={busy}
      zIndexClassName="z-[200]"
      maxWidthClassName="max-w-3xl"
      topOffset="var(--app-header-h, 72px)"
      title={
        <span className="truncate">
          Nuovo evento per: <span className="font-semibold">{aulaLabel}</span>
        </span>
      }
      subtitle={
        <span className="text-xs">
          Tipo evento: <span className="font-semibold">{selectedDef?.label ?? typeSlug}</span>
        </span>
      }
      footer={
        <div className="flex items-center gap-2">
          {err && (
            <div className="mr-auto rounded-md border border-red-500 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-[#400] dark:text-red-200">
              {err}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Salvo…" : "Crea evento"}
          </button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
        {/* COLONNA SX */}
        <div className="space-y-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-dark/60 dark:text-white/60">Dal</label>
              <input className={inputClass} value={range.dateStart} readOnly />
            </div>
            <div>
              <label className="text-xs text-dark/60 dark:text-white/60">Al</label>
              <input className={inputClass} value={range.dateEnd} readOnly />
            </div>
          </div>

          <div>
            <label className="text-xs text-dark/60 dark:text-white/60">Titolo *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              maxLength={200}
              placeholder="Es. Lezione / Riunione / Evento…"
            />
          </div>

          <div>
            <label className="text-xs text-dark/60 dark:text-white/60">Visibilità</label>
            <select
              value={visibilityRole}
              onChange={(e) => setVisibilityRole(e.target.value)}
              className={inputClass}
            >
              {rawVis.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
            <input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} />
            Specifica orari
          </label>

          {useTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark/60 dark:text-white/60">Ora inizio</label>
                <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-dark/60 dark:text-white/60">Ora fine</label>
                <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-dark/60 dark:text-white/60">Note</label>
            <textarea
              rows={4}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opzionale…"
            />
          </div>
        </div>

        {/* COLONNA DX — PARTECIPANTI */}
        <div className="space-y-2 rounded-2xl border border-stroke/60 bg-gray-50 p-3 dark:border-dark-3 dark:bg-black/20">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-dark/70 dark:text-white/70">
            Partecipanti aula
          </div>

          <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
            {listaPartecipanti.length === 0 ? (
              <div className="py-2 text-[11px] text-dark/60 dark:text-white/60">
                Nessun partecipante configurato per questa aula.
              </div>
            ) : (
              listaPartecipanti.map((p) => {
                const active = selezionati.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={[
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                      "border-stroke dark:border-dark-3",
                      active ? "bg-primary text-white hover:opacity-90" : "hover:bg-gray-2 dark:hover:bg-dark-2",
                    ].join(" ")}
                  >
                    <span className="min-w-0 truncate">{p.displayName}</span>
                    {active && <span className="ml-2">✓</span>}
                  </button>
                );
              })
            )}
          </div>

          {listaPartecipanti.length > 0 && (
            <div className="pt-1 text-[11px] text-dark/60 dark:text-white/60">
              Selezionati: <span className="font-semibold text-dark dark:text-white">{selezionati.length}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
