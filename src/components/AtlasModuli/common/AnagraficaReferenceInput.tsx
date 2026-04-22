// src/components/AtlasModuli/common/AnagraficaReferenceInput.tsx
// Componenti riusabili per la selezione strutturata di anagrafiche tramite reference.
// Estratti e generalizzati da EditForm.tsx (ReferenceSelectInput / ReferenceMultiSelectInput).
//
// Uso:
//   <AnagraficaReferenceInput
//     label="Proprietario"
//     value={ownerId}
//     onChange={setOwnerId}
//     config={{ targetSlug: "evolver", previewField: "nomeEvolver" }}
//   />
//   <AnagraficaReferenceMultiInput
//     label="Partecipanti"
//     value={participantIds}
//     onChange={setParticipantIds}
//     config={{ targetSlug: "evolver", previewField: "nomeEvolver" }}
//   />
"use client";

import { useEffect, useMemo, useState } from "react";
import { anagraficheService } from "@/components/Store/services/anagraficheService";

// ─────────────────────────────────────────────────────────────
// Tipi
// ─────────────────────────────────────────────────────────────

export type AnagraficaRefConfig = {
  /** Slug del tipo anagrafica target, es. "evolver", "clienti" */
  targetSlug: string;
  /** Campo di preview da mostrare, es. "nomeEvolver", "ragioneSociale" */
  previewField: string;
};

type Option = { id: string; label: string };

// ─────────────────────────────────────────────────────────────
// Utilities interne
// ─────────────────────────────────────────────────────────────

function normalizeStringArrayInput(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// AnagraficaReferenceInput – selezione singola
// ─────────────────────────────────────────────────────────────

/**
 * Selezione singola di un'anagrafica tramite ricerca real-time.
 * Salva l'ID dell'anagrafica selezionata (non il nome).
 * Mostra una pill per l'elemento selezionato con bottone ✕.
 */
export function AnagraficaReferenceInput({
  label,
  value,
  onChange,
  config,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  config: AnagraficaRefConfig;
  placeholder?: string;
  className?: string;
}) {
  const { targetSlug, previewField } = config;

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Risolvi il label dell'ID già salvato
  useEffect(() => {
    if (!value) {
      setSelectedLabel(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await anagraficheService.getFieldValues({
          targetSlug,
          field: previewField,
          ids: [value],
        });
        if (!cancelled) setSelectedLabel(res[value] ?? null);
      } catch {
        if (!cancelled) setSelectedLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, targetSlug, previewField]);

  // Ricerca real-time delle opzioni
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await anagraficheService.list({
          type: targetSlug,
          query: query || undefined,
          page: 1,
          pageSize: 10,
        });

        if (cancelled) return;

        const opts: Option[] =
          res.items?.map((item: any) => {
            const dataLabel =
              previewField && item.data?.[previewField]
                ? item.data[previewField]
                : null;
            return {
              id: String(item.id),
              label: String(dataLabel || item.displayName || item.id),
            };
          }) ?? [];

        setOptions(opts);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetSlug, previewField, query]);

  const current = options.find((o) => o.id === value) || null;
  const shownLabel = current?.label ?? selectedLabel ?? value ?? "";

  return (
    <div className={className}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
        {label}
      </div>

      {/* Pill elemento selezionato */}
      {value && shownLabel && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300">
          <span className="max-w-[220px] truncate font-semibold">{shownLabel}</span>
          <button
            type="button"
            className="ml-1 text-[10px] opacity-60 transition hover:opacity-100"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            aria-label={`Rimuovi ${shownLabel}`}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input ricerca */}
      <input
        type="text"
        className="mb-2 w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
        placeholder={placeholder ?? "Cerca per nome…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Risultati */}
      <div className="custom-scrollbar max-h-48 overflow-y-auto">
        <div className="flex flex-wrap gap-2 pt-1 pb-2">
          {loading && (
            <span className="text-xs text-dark/60 dark:text-white/60">
              Caricamento…
            </span>
          )}

          {!loading &&
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setQuery("");
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                  opt.id === value
                    ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400 font-bold shadow-md scale-105"
                    : "border-primary/20 bg-white/50 text-primary hover:border-primary/60 hover:bg-primary/5 dark:border-red-400/20 dark:bg-gray-dark/30 dark:text-red-300 dark:hover:border-red-400/60"
                }`}
              >
                <span className="max-w-[200px] truncate">{opt.label}</span>
              </button>
            ))}

          {!loading && options.length === 0 && (
            <span className="text-xs text-dark/50 dark:text-white/50 py-2">
              Nessun risultato trovato.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AnagraficaReferenceMultiInput – selezione multipla
// ─────────────────────────────────────────────────────────────

/**
 * Selezione multipla di anagrafiche tramite ricerca real-time.
 * Salva un array di ID anagrafica.
 * Tag removibili per ogni elemento selezionato.
 */
export function AnagraficaReferenceMultiInput({
  label,
  value,
  onChange,
  config,
  placeholder,
  className,
}: {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  config: AnagraficaRefConfig;
  placeholder?: string;
  className?: string;
}) {
  const { targetSlug, previewField } = config;

  const selectedIds = useMemo(() => normalizeStringArrayInput(value), [value]);

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});

  // Risolvi i label degli ID già salvati
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedLabels({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await anagraficheService.getFieldValues({
          targetSlug,
          field: previewField,
          ids: selectedIds,
        });

        if (cancelled) return;

        const next: Record<string, string> = {};
        selectedIds.forEach((id) => {
          next[id] = res[id] ?? id;
        });
        setSelectedLabels(next);
      } catch {
        if (!cancelled) setSelectedLabels({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIds, targetSlug, previewField]);

  // Ricerca real-time
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await anagraficheService.list({
          type: targetSlug,
          query: query || undefined,
          page: 1,
          pageSize: 10,
        });

        if (cancelled) return;

        const opts: Option[] =
          res.items?.map((item: any) => {
            const dataLabel =
              previewField && item.data?.[previewField]
                ? item.data[previewField]
                : null;
            return {
              id: String(item.id),
              label: String(dataLabel || item.displayName || item.id),
            };
          }) ?? [];

        setOptions(opts);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetSlug, previewField, query]);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((existingId) => existingId !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((existingId) => existingId !== id));
  };

  return (
    <div className={className}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
        {label}
      </div>

      {/* Tag elementi selezionati */}
      {selectedIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300"
            >
              <span className="max-w-[160px] truncate font-semibold">
                {selectedLabels[id] ?? id}
              </span>
              <button
                type="button"
                className="ml-0.5 text-[10px] opacity-60 transition hover:opacity-100"
                onClick={() => remove(id)}
                aria-label={`Rimuovi ${selectedLabels[id] ?? id}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input ricerca */}
      <input
        type="text"
        className="mb-2 w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
        placeholder={placeholder ?? "Cerca per nome…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Risultati */}
      <div className="flex flex-wrap gap-1">
        {loading && (
          <span className="text-xs text-dark/60 dark:text-white/60">
            Caricamento…
          </span>
        )}

        {!loading &&
          options.map((opt) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400"
                    : "border-primary/40 text-primary hover:bg-primary/10 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
                }`}
              >
                {isSelected && (
                  <span className="text-[9px] opacity-80">✓</span>
                )}
                <span className="max-w-[180px] truncate">{opt.label}</span>
              </button>
            );
          })}

        {!loading && options.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessun risultato.
          </span>
        )}
      </div>
    </div>
  );
}
