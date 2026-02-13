"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "@/components/Store/hooks";

import { fetchEvento, updateEvento } from "@/components/Store/slices/eventiSlice";

import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import type { EventoFull } from "@/components/Store/models/eventi";

import { Modal } from "@/components/ui/Modal";

type Props = {
  aulaType: string; // es. "aule-agenti" (gruppoType lato eventi)
  aulaId: string;
  aulaLabel: string;
  partecipantiAula: AnagraficaPreview[];
  partecipanteAnagraficaType: string; // es. "agenti" -> EventoPartecipanteView.anagraficaType
  eventId: string;
  typeSlug: string;
  onClose: () => void;
};

export default function PresenzeFormModalAula({
                                                aulaType,
                                                aulaId,
                                                aulaLabel,
                                                partecipantiAula,
                                                partecipanteAnagraficaType,
                                                eventId,
                                                typeSlug,
                                                onClose,
                                              }: Props) {
  const dispatch = useAppDispatch();

  const [evento, setEvento] = useState<EventoFull | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingEvento, setLoadingEvento] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /* ----------------------------- LOAD EVENTO FRESCO ----------------------- */

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoadingEvento(true);
        setErr(null);
        setSelectedIds([]);
        setEvento(null);

        const res = await dispatch(
          fetchEvento({ type: typeSlug, id: eventId }) as any,
        ).unwrap(); // { type, data }

        if (!alive) return;

        const full: EventoFull = res.data;
        setEvento(full);

        // ------------ MATCHING: evento.partecipanti + fallback su data.partecipantiCollegati ------------
        let fromEventoIds: string[] = [];

        // 1) root: EventoFull.partecipanti
        const rootParts = full.partecipanti ?? [];
        if (rootParts.length > 0) {
          fromEventoIds = rootParts
            .filter(
              (p) =>
                !partecipanteAnagraficaType ||
                p.anagraficaType === partecipanteAnagraficaType,
            )
            .map((p) => String(p.anagraficaId));
        }

        // 2) fallback: data.partecipantiCollegati (come usato in create/update)
        if (fromEventoIds.length === 0) {
          const col = (full.data as any)?.partecipantiCollegati ?? [];
          if (Array.isArray(col)) {
            fromEventoIds = col
              .filter((p: any) => {
                if (!partecipanteAnagraficaType) return true;
                // alcuni backend usano `type`, altri `anagraficaType`
                const t = p.type || p.anagraficaType || null;
                return !t || t === partecipanteAnagraficaType;
              })
              .map((p: any) => String(p.anagraficaId));
          }
        }

        // 3) tieni solo quelli che esistono nella lista dell'aula
        const validIds = fromEventoIds.filter((id) =>
          partecipantiAula.some((p) => String(p.id) === id),
        );

        setSelectedIds(validIds);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Errore nel caricamento dell'evento");
      } finally {
        if (alive) setLoadingEvento(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [dispatch, typeSlug, eventId, partecipanteAnagraficaType, partecipantiAula]);

  /* ------------------------ LISTA PARTECIPANTI AULA ---------------------- */

  const partecipantiSorted = useMemo(
    () =>
      [...partecipantiAula].sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || ""),
      ),
    [partecipantiAula],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /* ----------------------------- SUBMIT ----------------------------------- */

  async function submit() {
    try {
      setBusy(true);
      setErr(null);

      if (!evento) {
        throw new Error("Evento non caricato, impossibile salvare le presenze");
      }

      // 1) lista “leggera” per data.partecipantiCollegati (come nel create)
      const partecipantiCollegati = selectedIds.map((id) => {
        const found = partecipantiAula.find((p) => String(p.id) === String(id));
        return {
          type: partecipanteAnagraficaType, // slug anagrafica (es. "agenti")
          anagraficaId: id,
          displayName: found?.displayName ?? "",
        };
      });

      // 2) lista “vera” per EventoFull.partecipanti:
      //    - manteniamo TUTTI i partecipanti di altre anagrafiche
      const prevParts = evento.partecipanti ?? [];
      const otherParts = prevParts.filter(
        (p) => p.anagraficaType !== partecipanteAnagraficaType,
      );

      const aulaParts = selectedIds.map((id) => ({
        anagraficaType: partecipanteAnagraficaType,
        anagraficaId: id,
        role: null,
        status: null,
        quantity: null,
        note: null,
      }));

      const partecipanti = [...otherParts, ...aulaParts];

      const payload: any = {
        // NON perdiamo nulla: portiamo avanti tutti i dati già esistenti
        data: {
          ...(evento.data || {}),
          partecipantiCollegati,
        },

        timeKind: evento.timeKind,
        startAt: evento.startAt,
        endAt: evento.endAt,
        allDay: evento.allDay ?? false,

        visibilityRole: evento.visibilityRole ?? null,
        gruppo: evento.gruppo ?? {
          gruppoType: aulaType,
          gruppoId: aulaId,
        },
        recurrence: evento.recurrence ?? null,

        // campo root che il backend usa per le anagrafiche collegate
        partecipanti,
      };

      await dispatch(
        updateEvento({
          type: typeSlug,
          id: eventId,
          data: payload,
        }) as any,
      );

      onClose();
    } catch (e: any) {
      setErr(e?.message || "Errore salvataggio presenze");
    } finally {
      setBusy(false);
    }
  }

  /* ----------------------------- RENDER ----------------------------------- */

  return (
    <Modal
      open={true}
      onClose={onClose}
      zIndexClassName="z-[210]"
      maxWidthClassName="max-w-2xl"
      className="border border-stroke bg-gray-950/95 text-gray-100 shadow-2xl backdrop-blur-md dark:border-dark-3"
      title={<span>Presenze aula: {aulaLabel}</span>}
      subtitle={
        <span>
          Evento: <b>{(evento?.data as any)?.titolo ?? eventId}</b>
        </span>
      }
      footer={
        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-full border border-stroke px-4 py-1.5 text-sm sm:min-w-[110px] dark:border-dark-3"
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={busy || loadingEvento}
            className="rounded-full bg-primary px-5 py-1.5 text-sm text-white disabled:opacity-50 sm:min-w-[140px]"
          >
            {busy ? "Salvo…" : "Salva presenze"}
          </button>
        </div>
      }
    >
      {loadingEvento ? (
        <div className="flex items-center justify-center py-10 text-xs opacity-70">
          Caricamento evento…
        </div>
      ) : (
        <>
          {/* LISTA PARTECIPANTI */}
          <div className="rounded-xl border border-stroke/60 bg-black/40 p-3 text-xs dark:border-dark-3">
            {partecipantiSorted.length === 0 ? (
              <div className="py-6 text-center text-[12px] opacity-60">
                Nessun partecipante configurato per questa aula.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {partecipantiSorted.map((p) => {
                  const active = selectedIds.includes(String(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(String(p.id))}
                      className={[
                        "flex min-h-[36px] items-center justify-between rounded-lg px-3 py-1.5 text-[12px]",
                        "transition hover:bg-gray-800/80",
                        active
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-gray-900/60 text-gray-100",
                      ].join(" ")}
                    >
                      <span className="truncate">{p.displayName}</span>
                      {active && <span className="ml-2 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {err && (
            <div className="mt-3 rounded border border-red-500 bg-red-950/70 p-2 text-xs text-red-200">
              {err}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
