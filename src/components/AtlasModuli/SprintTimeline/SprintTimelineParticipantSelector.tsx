"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  EditPartecipantiPanel,
} from "@/components/AtlasModuli/common/EditPartecipantiPanel";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { getAnagraficheList } from "@/config/anagrafiche.registry";
import type { SprintTimelineParticipantReference } from "./SprintTimeline.types";

function toPreview(item: Partial<AnagraficaPreview> & { id: string }): AnagraficaPreview {
  return {
    id: item.id,
    data: item.data ?? {},
    displayName: item.displayName || item.id,
    subtitle: item.subtitle ?? null,
    updatedAt: item.updatedAt || "",
  };
}

/**
 * Deriviamo i tipi di anagrafica dal registro centrale.
 * Includiamo tutti i tipi che possono partecipare (accettaAule: true).
 */
const SUPPORTED_ANAGRAFICA_TYPES = getAnagraficheList()
  .filter((t) => t.accettaAule)
  .map((t) => ({
    slug: t.slug,
    label: t.label,
  }));

export function SprintTimelineParticipantSelector({
  value,
  onChange,
  title = "Partecipanti",
  selectedListTitle = "Partecipanti selezionati",
}: {
  value: SprintTimelineParticipantReference[];
  onChange: (value: SprintTimelineParticipantReference[]) => void;
  title?: string;
  selectedListTitle?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTypeSlug, setSelectedTypeSlug] = useState<string | null>(
    SUPPORTED_ANAGRAFICA_TYPES[0]?.slug || "evolver",
  );
  const [query, setQuery] = useState("");
  const [availableItems, setAvailableItems] = useState<AnagraficaPreview[]>([]);
  const [previewById, setPreviewById] = useState<Record<string, AnagraficaPreview>>({});

  // Ricerca anagrafiche disponibili
  useEffect(() => {
    if (!isOpen || !selectedTypeSlug) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await anagraficheService.list({
          type: selectedTypeSlug,
          query: query || undefined,
          page: 1,
          pageSize: 20,
        });
        if (cancelled) return;

        const items: AnagraficaPreview[] = (res.items ?? []).map((item: any) =>
          toPreview(item),
        );
        setAvailableItems(items);

        // Aggiorna cache preview
        setPreviewById((prev) => {
          const next = { ...prev };
          items.forEach((it) => {
            next[it.id] = it;
          });
          return next;
        });
      } catch (err) {
        console.error("error fetching anagrafiche", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTypeSlug, query, isOpen]);

  // Risoluzione delle preview per gli elementi già selezionati ma non presenti in cache
  useEffect(() => {
    const missingIdsBySlug: Record<string, string[]> = {};
    value.forEach((p) => {
      if (!previewById[p.anagraficaId]) {
        if (!missingIdsBySlug[p.anagraficaType]) missingIdsBySlug[p.anagraficaType] = [];
        missingIdsBySlug[p.anagraficaType].push(p.anagraficaId);
      }
    });

    Object.entries(missingIdsBySlug).forEach(([slug, ids]) => {
      anagraficheService
        .list({
          type: slug,
          ids,
          pageSize: ids.length,
        })
        .then((res) => {
          setPreviewById((prev) => {
            const next = { ...prev };
            (res.items ?? []).forEach((it) => {
              next[it.id] = toPreview(it);
            });
            return next;
          });
        });
    });
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
          {title}
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold text-primary hover:underline dark:text-red-300"
        >
          {isOpen ? "Chiudi selettore ✕" : `Gestisci partecipanti (${value.length}) ↓`}
        </button>
      </div>

      {!isOpen && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => {
            const preview = previewById[p.anagraficaId];
            return (
              <span
                key={`${p.anagraficaType}:${p.anagraficaId}`}
                className="inline-flex items-center rounded-full border border-stroke bg-white/50 px-2.5 py-1 text-[11px] text-dark shadow-sm dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white"
              >
                {preview?.displayName || p.anagraficaId}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((it) => it.anagraficaId !== p.anagraficaId))}
                  className="ml-1.5 opacity-40 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {isOpen && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-4 shadow-sm dark:border-red-400/20">
          <EditPartecipantiPanel<SprintTimelineParticipantReference>
            title={title}
            anagraficaTypes={SUPPORTED_ANAGRAFICA_TYPES}
            selectedTypeSlug={selectedTypeSlug}
            onChangeSelectedTypeSlug={setSelectedTypeSlug}
            partecipanti={value}
            onChangePartecipanti={(updater) => {
              if (typeof updater === "function") {
                onChange(updater(value));
              } else {
                onChange(updater);
              }
            }}
            availableItems={availableItems}
            availableQuery={query}
            onChangeAvailableQuery={setQuery}
            previewById={previewById}
            selectedListTitle={selectedListTitle}
            groupByType={true}
            buildNewPartecipante={({ anagrafica, selectedTypeSlug: slug }) => ({
              anagraficaId: anagrafica.id,
              anagraficaType: slug || "evolver",
            })}
            renderDetails={() => null}
          />
        </div>
      )}
    </div>
  );
}
