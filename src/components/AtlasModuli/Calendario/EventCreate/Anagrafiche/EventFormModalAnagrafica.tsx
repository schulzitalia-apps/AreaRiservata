"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "@/components/Store/hooks";
import { createEvento, fetchEventi } from "@/components/Store/slices/eventiSlice";
import { monthBounds } from "../../utils";
import type { EventoDef } from "@/config/eventi.registry";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

const inputClass =
  "w-full rounded border px-2 py-1 text-sm bg-white text-gray-900 " +
  "dark:border-dark-3 dark:bg-black dark:text-white";

type Props = {
  anagraficaType: string;
  anagraficaId: string;
  anagraficaLabel: string;

  availableTypes: EventoDef[];
  typeSlug: string; // initial

  range: { dateStart: string; dateEnd: string };

  initialTimeStart?: string;
  initialTimeEnd?: string;
  forceUseTime?: boolean;

  onClose: () => void;
};

type OptionTuple = [value: string, label: string];

export default function EventFormModalAnagrafica({
                                                   anagraficaType,
                                                   anagraficaId,
                                                   anagraficaLabel,
                                                   availableTypes,
                                                   typeSlug: initialTypeSlug,
                                                   range,
                                                   initialTimeStart,
                                                   initialTimeEnd,
                                                   forceUseTime,
                                                   onClose,
                                                 }: Props) {
  const dispatch = useAppDispatch();

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
  const visibilityOptions = useMemo<OptionTuple[]>(
    () => (rawVis || []).map(([v, l]) => [String(v ?? ""), String(l ?? "")]),
    [rawVis],
  );

  const [visibilityRole, setVisibilityRole] = useState<string>(
    visibilityOptions[0]?.[0] ?? "",
  );

  useEffect(() => {
    setVisibilityRole(visibilityOptions[0]?.[0] ?? "");
  }, [visibilityOptions]);

  /* ORARI */
  const [useTime, setUseTime] = useState<boolean>(!!forceUseTime);
  const [timeStart, setTimeStart] = useState(initialTimeStart ?? "09:00");
  const [timeEnd, setTimeEnd] = useState(initialTimeEnd ?? "10:00");

  useEffect(() => {
    if (initialTimeStart) setTimeStart(initialTimeStart);
    if (initialTimeEnd) setTimeEnd(initialTimeEnd);
    if (forceUseTime) setUseTime(true);
  }, [initialTimeStart, initialTimeEnd, forceUseTime]);

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

      let startAt: string | null = null;
      let endAt: string | null = null;
      let timeKind: "interval" | "deadline";
      let allDay = false;

      if (useTime) {
        if (timeStart === timeEnd) throw new Error("L'ora di fine deve essere successiva all'ora di inizio");
        if (timeEnd < timeStart) throw new Error("Intervallo orario non valido");

        timeKind = "interval";
        startAt = `${dateStart}T${timeStart}:00`;
        endAt = `${dateEnd}T${timeEnd}:00`;
        allDay = false;
      } else {
        timeKind = "deadline";
        endAt = `${dateStart}T23:59:59`;
        startAt = null;
        allDay = true;
      }

      const payload: any = {
        data: {
          titolo: title,
          descrizione: notes,
        },
        timeKind,
        startAt,
        endAt,
        allDay,
        visibilityRole: visibilityRole || null,
        partecipanti: [
          { anagraficaType, anagraficaId, role: null, status: null, quantity: null, note: null },
        ],
      };

      const type = selectedDef.slug;

      await dispatch(createEvento({ type, payload }) as any);

      const monthStr = dateStart.slice(0, 7);
      const { timeFrom, timeTo } = monthBounds(monthStr);

      await dispatch(
        fetchEventi({ type, timeFrom, timeTo, anagraficaType, anagraficaId }) as any,
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
      title={`Nuovo evento per: ${anagraficaLabel}`}
      subtitle={`Tipo evento: ${selectedDef?.label ?? typeSlug}`}
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
            placeholder="Es. Appuntamento…"
          />
        </div>

        <div className="text-sm">
          <Select
            label="Visibilità"
            value={visibilityRole}
            onChange={setVisibilityRole as any}
            options={visibilityOptions}
            disabled={busy}
          />
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
    </Modal>
  );
}
