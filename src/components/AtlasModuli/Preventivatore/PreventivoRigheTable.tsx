"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import { safeNumber, clampPct, calcTotale } from "./PreventiviUtils";

export type ArticoloOption = {
  id: string;
  label: string;
  prezzoUnitario: number; // NON più affidabile se arriva da preview: può stare 0 e va bene
  descrizione?: string;
};

export type RigaPreventivoState = {
  id?: string;
  articoloId: string | null;
  articoloLabel: string;

  descrizione: string;
  descrizioneManuale?: boolean; // ✅ se true, non sovrascrivere la descrizione quando cambi articolo

  quantita: number;
  prezzoUnitario: number;
  scontoPercentuale: number;
  totale: number;
};

type Props = {
  righe: RigaPreventivoState[];
  setRighe: React.Dispatch<React.SetStateAction<RigaPreventivoState[]>>;
  articoli: ArticoloOption[];
  loadingArticoli?: boolean;
  loadingRighe?: boolean;
};

const ARTICOLI_TYPE = "articoli";
const DEBUG_RIGHE = true;

export default function PreventivoRigheTable({
                                               righe,
                                               setRighe,
                                               articoli,
                                               loadingArticoli = false,
                                               loadingRighe = false,
                                             }: Props) {
  const lastRowRef = useRef<HTMLDivElement | null>(null);

  // evita race: se clicchi due articoli di fila velocissimo, applica solo l’ultimo
  const reqSeqByRow = useRef<Record<number, number>>({});
  const [hydratingRowIdx, setHydratingRowIdx] = useState<number | null>(null);

  const articoloById = useMemo(() => {
    const m = new Map<string, ArticoloOption>();
    for (const a of articoli) m.set(String(a.id), a);
    return m;
  }, [articoli]);

  // quando arrivano gli articoli: aggiorna SOLO label mancanti
  useEffect(() => {
    if (!articoli?.length) return;

    setRighe((prev) =>
      prev.map((r) => {
        if (!r.articoloId) return r;
        const a = articoloById.get(String(r.articoloId));
        if (!a) return r;

        return {
          ...r,
          articoloLabel: r.articoloLabel || a.label,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articoli]);

  const addRow = () => {
    setRighe((prev) => [
      ...prev,
      {
        articoloId: null,
        articoloLabel: "",
        descrizione: "",
        descrizioneManuale: false,
        quantita: 1,
        prezzoUnitario: 0,
        scontoPercentuale: 0,
        totale: 0,
      },
    ]);

    setTimeout(() => {
      lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const removeRow = (idx: number) => {
    setRighe((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<RigaPreventivoState>) => {
    setRighe((prev) => {
      const next = [...prev];
      const cur = next[idx];
      if (!cur) return prev;

      const merged = { ...cur, ...patch };

      const quantita = safeNumber(merged.quantita);
      const prezzoUnitario = safeNumber(merged.prezzoUnitario);
      const scontoPercentuale = clampPct(merged.scontoPercentuale);
      const totale = calcTotale(quantita, prezzoUnitario, scontoPercentuale);

      next[idx] = {
        ...merged,
        quantita,
        prezzoUnitario,
        scontoPercentuale,
        totale,
      };

      if (DEBUG_RIGHE) console.log("[Righe] updateRow", { idx, patch, next: next[idx] });

      return next;
    });
  };

  const hydrateArticoloFull = async (idx: number, articoloId: string) => {
    const nextSeq = (reqSeqByRow.current[idx] ?? 0) + 1;
    reqSeqByRow.current[idx] = nextSeq;

    setHydratingRowIdx(idx);

    // usa preview subito (UX reattiva) + reset descrizione manuale
    const preview = articoloById.get(String(articoloId));
    if (preview) {
      updateRow(idx, {
        articoloId: String(articoloId),
        articoloLabel: preview.label,
        descrizione: preview.descrizione ?? "",
        descrizioneManuale: false,
      });
    } else {
      updateRow(idx, {
        articoloId: String(articoloId),
        articoloLabel: "",
        descrizione: "",
        descrizioneManuale: false,
      });
    }

    try {
      const full = await anagraficheService.getOne({ type: ARTICOLI_TYPE, id: articoloId });

      // se nel frattempo l’utente ha selezionato un altro articolo: ignora
      if (reqSeqByRow.current[idx] !== nextSeq) return;

      const d: any = (full as any)?.data ?? {};

      const label = String(d.nomeArticolo ?? preview?.label ?? (full as any)?.displayName ?? articoloId);
      const prezzo = safeNumber(d.prezzoUnitario ?? d.costoUnitario ?? 0);
      const descr = String(d.descrizioneArticolo ?? "");

      setRighe((prev) => {
        const next = [...prev];
        const cur = next[idx];
        if (!cur) return prev;

        // ✅ se l’utente ha editato a mano, non sovrascrivere
        const shouldOverwriteDesc = !cur.descrizioneManuale;
        const nextDesc = shouldOverwriteDesc ? descr : cur.descrizione;

        const quantita = safeNumber(cur.quantita);
        const sconto = clampPct(cur.scontoPercentuale);
        const totale = calcTotale(quantita, prezzo, sconto);

        next[idx] = {
          ...cur,
          articoloId: String(articoloId),
          articoloLabel: label,
          prezzoUnitario: prezzo,
          descrizione: nextDesc,
          quantita,
          scontoPercentuale: sconto,
          totale,
        };

        if (DEBUG_RIGHE) {
          console.log("[Righe] hydrate articolo FULL", {
            idx,
            articoloId,
            label,
            prezzo,
            descr,
            row: next[idx],
          });
        }

        return next;
      });
    } finally {
      // evita flicker se l’utente cambia riga
      setHydratingRowIdx((cur) => (cur === idx ? null : cur));
    }
  };

  const handleSelectArticolo = (idx: number, articoloId: string) => {
    const val = (articoloId ?? "").trim();

    if (!val) {
      updateRow(idx, {
        articoloId: null,
        articoloLabel: "",
        prezzoUnitario: 0,
        descrizione: "",
        descrizioneManuale: false,
      });
      return;
    }

    void hydrateArticoloFull(idx, val);
  };

  const articoloSelectOptions = useMemo(() => {
    return [
      ["", "Seleziona articolo"],
      ...articoli.map((a) => [String(a.id), a.label] as const),
    ] as ReadonlyArray<readonly [string, string]>;
  }, [articoli]);

  return (
    <div className="rounded-xl border border-stroke p-4 dark:border-dark-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-dark dark:text-white">Righe preventivo</div>

        <button
          type="button"
          onClick={addRow}
          className="rounded-full border border-primary px-4 py-2 text-xs text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          + Aggiungi riga
        </button>
      </div>

      {(loadingRighe || loadingArticoli) && (
        <div className="mb-4 text-xs text-dark/60 dark:text-white/60">Caricamento…</div>
      )}

      <div className="space-y-4 pb-32">
        {righe.length === 0 && (
          <div className="rounded-lg border border-dashed border-stroke p-4 text-xs text-dark/60 dark:border-dark-3 dark:text-white/60">
            Nessuna riga. Premi “Aggiungi riga”.
          </div>
        )}

        {righe.map((r, idx) => {
          const isLast = idx === righe.length - 1;
          const hydrating = hydratingRowIdx === idx;

          return (
            <div
              key={r.id ?? `new-${idx}`}
              ref={isLast ? lastRowRef : undefined}
              className="rounded-2xl border border-stroke bg-transparent p-4 dark:border-dark-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-dark/70 dark:text-white/70">
                  Riga {idx + 1}
                  {hydrating ? (
                    <span className="ml-2 text-[10px] text-dark/50 dark:text-white/50">
                      (carico articolo…)
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="rounded-full border border-stroke px-3 py-1 text-[11px] text-dark/70 hover:bg-gray-2 dark:border-dark-3 dark:text-white/70 dark:hover:bg-dark-2"
                >
                  Rimuovi
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="text-sm text-dark dark:text-white">
                  <div className="mb-1 text-xs text-dark/60 dark:text-white/60">Articolo</div>
                  <Select
                    value={r.articoloId ?? ""}
                    onChange={(v) => handleSelectArticolo(idx, v)}
                    options={articoloSelectOptions as any}
                    placeholder="Seleziona articolo"
                  />
                </div>

                <label className="block text-sm text-dark dark:text-white">
                  <div className="mb-1 text-xs text-dark/60 dark:text-white/60">Descrizione</div>
                  <textarea
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                    rows={4}
                    value={r.descrizione ?? ""}
                    onChange={(e) =>
                      updateRow(idx, { descrizione: e.target.value, descrizioneManuale: true })
                    }
                    placeholder="Descrizione riga…"
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <NumInput
                  label="Q.tà"
                  value={r.quantita}
                  onChange={(v) => updateRow(idx, { quantita: v })}
                />
                <NumInput
                  label="Prezzo"
                  value={r.prezzoUnitario}
                  onChange={(v) => updateRow(idx, { prezzoUnitario: v })}
                />
                <NumInput
                  label="Sconto %"
                  value={r.scontoPercentuale}
                  onChange={(v) => updateRow(idx, { scontoPercentuale: v })}
                />

                <div className="rounded-lg border border-stroke px-3 py-2 dark:border-dark-3">
                  <div className="text-[11px] text-dark/60 dark:text-white/60">Totale</div>
                  <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
                    {safeNumber(r.totale).toFixed(2)} €
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-10" />
    </div>
  );
}

function NumInput({
                    label,
                    value,
                    onChange,
                  }: {
  label: string;
  value: any;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm text-dark dark:text-white">
      <div className="mb-1 text-xs text-dark/60 dark:text-white/60">{label}</div>
      <input
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
        inputMode="decimal"
        value={String(value ?? "")}
        onChange={(e) => onChange(safeNumber(e.target.value))}
      />
    </label>
  );
}
