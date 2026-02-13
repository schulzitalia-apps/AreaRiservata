// src/components/AtlasModuli/common/EditPartecipantiPanel.tsx
"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ReactNode } from "react";

import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { Select } from "@/components/ui/select";

type BasePartecipante = {
  anagraficaId: string;
  anagraficaType?: string | null;
};

export type EditPartecipantiPanelProps<P extends BasePartecipante> = {
  /** Titolo della card (es. "Partecipanti (anagrafiche singole)" / "Partecipanti (Atleti)") */
  title: string;

  /** Tipi di anagrafica selezionabili */
  anagraficaTypes: { slug: string; label: string }[];

  /** Tipo di anagrafica correntemente selezionato (multi-tipo – caso EVENTO) */
  selectedTypeSlug?: string | null;
  onChangeSelectedTypeSlug?: (slug: string | null) => void;

  /** Partecipanti già collegati (aula / evento) */
  partecipanti: P[];
  /** Passa direttamente setState del chiamante */
  onChangePartecipanti: Dispatch<SetStateAction<P[]>>;

  /** Anagrafiche disponibili da cui aggiungere partecipanti */
  availableItems: AnagraficaPreview[];
  availableQuery: string;
  onChangeAvailableQuery: (q: string) => void;

  /** Cache preview per mostrare nome/sottotitolo nei selezionati */
  previewById: Record<string, AnagraficaPreview>;

  /** Come creare un nuovo partecipante a partire da un'Anagrafiche + tipo */
  buildNewPartecipante: (args: {
    anagrafica: AnagraficaPreview;
    selectedTypeSlug: string | null;
  }) => P;

  /** Titolo della colonna destra (lista partecipanti selezionati) */
  selectedListTitle: string;
  emptySelectedMessage?: string;

  /** Se true, raggruppa i partecipanti per anagraficaType (caso EVENTO) */
  groupByType?: boolean;

  /** Render dei dettagli del partecipante (campi extra) */
  renderDetails: (args: {
    partecipante: P;
    patch: (patch: Partial<P>) => void;
  }) => ReactNode;
};

export function EditPartecipantiPanel<P extends BasePartecipante>({
                                                                    title,
                                                                    anagraficaTypes,
                                                                    selectedTypeSlug,
                                                                    onChangeSelectedTypeSlug,
                                                                    partecipanti,
                                                                    onChangePartecipanti,
                                                                    availableItems,
                                                                    availableQuery,
                                                                    onChangeAvailableQuery,
                                                                    previewById,
                                                                    buildNewPartecipante,
                                                                    selectedListTitle,
                                                                    emptySelectedMessage = "Nessun partecipante selezionato.",
                                                                    groupByType = false,
                                                                    renderDetails,
                                                                  }: EditPartecipantiPanelProps<P>) {
  const typeMap = useMemo(
    () =>
      new Map<string, string>(
        anagraficaTypes.map((t) => [t.slug, t.label]),
      ),
    [anagraficaTypes],
  );

  const effectiveSelectedSlug =
    selectedTypeSlug ??
    (anagraficaTypes.length ? anagraficaTypes[0].slug : null);

  const activeTypeLabel =
    (effectiveSelectedSlug && typeMap.get(effectiveSelectedSlug)) ||
    "Anagrafiche";

  // per espandere / chiudere i dettagli del singolo partecipante
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggleRow = (rowKey: string) => {
    setOpenMap((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  const handleAddPartecipante = (anag: AnagraficaPreview) => {
    if (!effectiveSelectedSlug && anagraficaTypes.length > 1) return;

    onChangePartecipanti((prev) => {
      const already = prev.some((p) => {
        if (p.anagraficaId !== anag.id) return false;
        if ("anagraficaType" in p) {
          return (p as any).anagraficaType === effectiveSelectedSlug;
        }
        return true;
      });
      if (already) return prev;

      const nuovo = buildNewPartecipante({
        anagrafica: anag,
        selectedTypeSlug: effectiveSelectedSlug,
      });

      return [...prev, nuovo];
    });
  };

  const handleRemovePartecipante = (rowKey: string, anagId: string) => {
    onChangePartecipanti((prev) =>
      prev.filter((p) => {
        const key = buildRowKey(p);
        return !(key === rowKey && p.anagraficaId === anagId);
      }),
    );
  };

  const buildRowKey = (p: BasePartecipante) =>
    p.anagraficaType ? `${p.anagraficaType}:${p.anagraficaId}` : p.anagraficaId;

  const grouped: Array<{ key: string; label: string; items: P[] }> =
    groupByType
      ? (() => {
        const map = new Map<string, P[]>();
        partecipanti.forEach((p) => {
          const typeKey =
            (p.anagraficaType as string | null) ?? "__default__";
          if (!map.has(typeKey)) map.set(typeKey, []);
          map.get(typeKey)!.push(p);
        });

        return Array.from(map.entries()).map(([typeKey, items]) => {
          const label =
            typeKey === "__default__"
              ? selectedListTitle
              : typeMap.get(typeKey) ?? typeKey;
          return { key: typeKey, label, items };
        });
      })()
      : [
        {
          key: "__all__",
          label: selectedListTitle,
          items: partecipanti,
        },
      ];

  return (
    <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark">
      {/* HEADER CARD */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h3 className="text-base font-semibold text-dark dark:text-white">
          {title}
        </h3>

        {anagraficaTypes.length > 1 && onChangeSelectedTypeSlug && (
          <div className="w-full max-w-xs">
            <Select
              label="Tipo anagrafica"
              value={effectiveSelectedSlug ?? ""}
              options={anagraficaTypes.map((t) => [
                t.slug,
                t.label,
              ])}
              onChange={(v: string) =>
                onChangeSelectedTypeSlug(v || null)
              }
            />
          </div>
        )}
      </div>

      {/* GRID SINISTRA / DESTRA */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* LEFT: ANAGRAFICHE DISPONIBILI */}
        <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-dark dark:text-white">
              {activeTypeLabel} disponibili
            </span>

            <input
              className="w-40 rounded-lg border border-stroke bg-transparent px-2 py-1 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              placeholder="Cerca…"
              value={availableQuery}
              onChange={(e) => onChangeAvailableQuery(e.target.value)}
            />
          </div>

          <div className="h-80 overflow-auto rounded bg-gray-1/40 p-1 dark:bg-dark-2/60">
            {!availableItems.length ? (
              <div className="flex h-full items-center justify-center text-xs text-dark/60 dark:text-white/60">
                Nessun elemento trovato
              </div>
            ) : (
              <div className="space-y-1">
                {availableItems.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded border border-stroke bg-white px-3 py-2 text-xs text-dark shadow-sm hover:bg-gray-2/60 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    onClick={() => handleAddPartecipante(p)}
                  >
                    <span className="truncate">{p.displayName}</span>
                    <span className="ml-2 text-[10px] uppercase text-dark/60 dark:text-white/60">
                      Aggiungi
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: PARTECIPANTI SELEZIONATI */}
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 dark:border-primary/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-dark dark:text-white">
              {selectedListTitle}
            </span>
            <span className="text-xs text-dark/60 dark:text-white/60">
              {partecipanti.length} selezionati
            </span>
          </div>

          <div className="h-80 space-y-3 overflow-auto">
            {!partecipanti.length ? (
              <div className="flex h-full items-center justify-center text-xs text-dark/60 dark:text-white/60">
                {emptySelectedMessage}
              </div>
            ) : (
              grouped.map(({ key: groupKey, label, items }) => (
                <div key={groupKey}>
                  {groupByType && (
                    <div className="mb-1 text-xs font-semibold uppercase text-dark/70 dark:text-white/70">
                      {label}
                    </div>
                  )}

                  <div className="space-y-2">
                    {items.map((p) => {
                      const preview = previewById[p.anagraficaId];
                      const displayName =
                        preview?.displayName ?? p.anagraficaId;
                      const subtitle = preview?.subtitle ?? "";
                      const rowKey = buildRowKey(p);
                      const isOpen = !!openMap[rowKey];

                      return (
                        <div
                          key={rowKey}
                          className="rounded border border-stroke bg-white px-3 py-2 text-xs text-dark shadow-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                        >
                          {/* HEADER RIGA: freccia + nome + rimuovi */}
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              onClick={() => toggleRow(rowKey)}
                            >
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[10px] transition-transform ${
                                  isOpen ? "rotate-90" : ""
                                }`}
                              >
                                <ChevronRightIcon />
                              </span>

                              <span className="min-w-0">
                                <div className="truncate font-semibold">
                                  {displayName}
                                </div>
                                {!!subtitle && (
                                  <div className="truncate text-[11px] text-dark/60 dark:text-white/60">
                                    {subtitle}
                                  </div>
                                )}
                              </span>
                            </button>

                            <button
                              type="button"
                              className="rounded bg-red-500 px-2 py-1 text-[11px] text-white hover:opacity-90"
                              onClick={() =>
                                handleRemovePartecipante(
                                  rowKey,
                                  p.anagraficaId,
                                )
                              }
                            >
                              Rimuovi
                            </button>
                          </div>

                          {/* DETTAGLI IN ACCORDION */}
                          {isOpen && (
                            <div className="mt-2 border-t border-stroke pt-2 dark:border-dark-3">
                              {renderDetails({
                                partecipante: p,
                                patch: (partial) =>
                                  onChangePartecipanti((prev) =>
                                    prev.map((pp) => {
                                      const pk = buildRowKey(pp);
                                      if (
                                        pk !== rowKey ||
                                        pp.anagraficaId !==
                                        p.anagraficaId
                                      ) {
                                        return pp;
                                      }
                                      return {
                                        ...pp,
                                        ...partial,
                                      };
                                    }),
                                  ),
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- ICON ----------------------------------- */

function ChevronRightIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 3.5L10 8l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
