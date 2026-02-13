// src/components/Aule/AulaPartecipantiPanel/AulaRoomView.tsx
import type { AulaPartecipanteFieldKey } from "@/config/aule.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import {
  AulaOverviewCard,
  AulaAlertsCard,
  AulaUrgentCard,
  AulaPartecipanteDetailsCard,
} from "./cards";
import { AulaSeatsGrid } from "./AulaSeatsGrid";
import type {
  AulaAlert,
  AulaViewMode,
  PartecipanteView,
} from "./types";

interface AulaRoomViewProps {
  partecipanti: PartecipanteView[];
  anagraficaItems: AnagraficaPreview[];
  dynamicFields: AulaPartecipanteFieldKey[];
  anagSlug: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  ownerName: string;
  viewMode: AulaViewMode;
  alerts: AulaAlert[];
  urgentAlerts: AulaAlert[];
  onChangeViewMode: (mode: AulaViewMode) => void;   // 👈 nuovo prop
}

export function AulaRoomView({
                               partecipanti,
                               anagraficaItems,
                               dynamicFields,
                               anagSlug,
                               selectedId,
                               onSelect,
                               onDeselect,
                               ownerName,
                               viewMode,
                               alerts,
                               urgentAlerts,
                               onChangeViewMode,
                             }: AulaRoomViewProps) {
  const enriched = partecipanti.map((p) => {
    const preview = anagraficaItems.find((a) => a.id === p.anagraficaId);
    return { p, preview };
  });

  const selected =
    selectedId != null
      ? enriched.find((e) => e.p.anagraficaId === selectedId)
      : null;

  const selectedPartecipante = selected?.p;
  const selectedPreview = selected?.preview;

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-12">
      {/* Colonna sinistra */}
      <div className="space-y-3 md:col-span-5">
        {selectedPartecipante ? (
          <AulaPartecipanteDetailsCard
            partecipante={selectedPartecipante}
            preview={selectedPreview}
            dynamicFields={dynamicFields}
            anagSlug={anagSlug}
            onClearSelection={onDeselect}
          />
        ) : viewMode === "alerts" ? (
          <AulaAlertsCard
            alerts={alerts}
            ownerName={ownerName}
            onBackToOverview={() => onChangeViewMode("overview")}  // 👈
          />
        ) : viewMode === "urgent" ? (
          <AulaUrgentCard
            alerts={urgentAlerts}
            ownerName={ownerName}
            onBackToOverview={() => onChangeViewMode("overview")}  // 👈
          />
        ) : (
          <AulaOverviewCard
            total={partecipanti.length}
            ownerName={ownerName}
          />
        )}
      </div>

      {/* Colonna destra: aula visiva */}
      <div className="md:col-span-7">
        <AulaSeatsGrid
          partecipanti={partecipanti}
          anagraficaItems={anagraficaItems}
          selectedId={selectedId}
          onSelect={onSelect}
          onDeselect={onDeselect}
          ownerName={ownerName}
        />
      </div>
    </div>
  );
}
