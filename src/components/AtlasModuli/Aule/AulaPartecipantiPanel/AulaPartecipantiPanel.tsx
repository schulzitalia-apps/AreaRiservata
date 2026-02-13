// src/components/Aule/AulaPartecipantiPanel/AulaPartecipantiPanel.tsx
"use client";

import { useState } from "react";
import type { AulaPartecipanteFieldKey } from "@/config/aule.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import type { AulaDetail } from "@/components/Store/models/aule";
import { AulaPartecipantiHeader } from "./AulaPartecipantiHeader";
import { AulaRoomView } from "./AulaRoomView";
import type { AulaAlert, AulaViewMode, PartecipanteView } from "./types";

interface AulaPartecipantiPanelProps {
  aula: AulaDetail | null;
  isLoading: boolean;
  anagraficaLabel: string;
  anagSlug: string;
  anagraficaItems: AnagraficaPreview[];
  dynamicFields: AulaPartecipanteFieldKey[];
  alerts?: AulaAlert[];
  urgentAlerts?: AulaAlert[];
}

export function AulaPartecipantiPanel({
                                        aula,
                                        isLoading,
                                        anagraficaLabel,
                                        anagSlug,
                                        anagraficaItems,
                                        dynamicFields,
                                        alerts,
                                        urgentAlerts,
                                      }: AulaPartecipantiPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AulaViewMode>("overview");

  const partecipanti: PartecipanteView[] = aula?.partecipanti ?? [];

  const handleSeatClick = (id: string) => {
    setSelectedId(id);
  };

  const handleSeatDeselect = () => {
    setSelectedId(null);
  };

  const ownerName = aula?.ownerName || "Cattedra";

  const alertsList = alerts ?? [];
  const urgentList = urgentAlerts ?? [];

  const alertsCount = alertsList.length;
  const urgentCount = urgentList.length;

  return (
    <div
      className="
        rounded-[10px] border border-slate-200/70 bg-white/80
        p-4 shadow-1 backdrop-blur-sm
        dark:border-white/10 dark:bg-gray-900/50 dark:shadow-card
      "
    >
      <AulaPartecipantiHeader
        anagraficaLabel={anagraficaLabel}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        alertsCount={alertsCount}
        urgentCount={urgentCount}
      />

      {isLoading ? (
        <SkeletonPartecipanti />
      ) : !partecipanti.length ? (
        <div className="mt-2 text-sm text-dark/60 dark:text-white/60">
          Nessun partecipante.
        </div>
      ) : (
        <AulaRoomView
          partecipanti={partecipanti}
          anagraficaItems={anagraficaItems}
          dynamicFields={dynamicFields}
          anagSlug={anagSlug}
          selectedId={selectedId}
          onSelect={handleSeatClick}
          onDeselect={handleSeatDeselect}
          ownerName={ownerName}
          viewMode={viewMode}
          alerts={alertsList}
          urgentAlerts={urgentList}
          onChangeViewMode={setViewMode}
        />
      )}
    </div>
  );
}

function SkeletonPartecipanti() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded bg-gray-2 dark:bg-dark-2"
        />
      ))}
    </div>
  );
}
