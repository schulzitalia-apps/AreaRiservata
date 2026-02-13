import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";
import type { AulaViewMode } from "./types";

interface AulaPartecipantiHeaderProps {
  anagraficaLabel: string;
  viewMode: AulaViewMode;
  onChangeViewMode: (mode: AulaViewMode) => void;
  alertsCount: number;
  urgentCount: number;
}

export function AulaPartecipantiHeader({
                                         anagraficaLabel,
                                         viewMode,
                                         onChangeViewMode,
                                         alertsCount,
                                         urgentCount,
                                       }: AulaPartecipantiHeaderProps) {
  const toggleMode = (mode: AulaViewMode) => {
    // se clicco lo stesso bottone, torno alla panoramica
    if (viewMode === mode) {
      onChangeViewMode("overview");
    } else {
      onChangeViewMode(mode);
    }
  };

  return (
    <div className="mb-3 space-y-1">
      {/* Riga con titolo + pulsanti tutti a sinistra */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-dark dark:text-white">
          Partecipanti
        </h3>

        <GlowButton
          size="sm"
          color={viewMode === "alerts" ? "primary" : "neutral"}
          onClick={() => toggleMode("alerts")}
        >
          <span className="flex items-center gap-2 text-xs">
            <span>Avvisi</span>
            <span
              className="
                inline-flex h-5 min-w-[1.25rem] items-center justify-center
                rounded-full bg-white/90 px-1 text-[10px] font-semibold
                text-primary dark:bg-slate-800 dark:text-primary-100
              "
            >
              {alertsCount}
            </span>
          </span>
        </GlowButton>

        <GlowButton
          size="sm"
          color={viewMode === "urgent" ? "rose" : "neutral"}
          onClick={() => toggleMode("urgent")}
        >
          <span className="flex items-center gap-2 text-xs">
            <span>Urgenze</span>
            <span
              className="
                inline-flex h-5 min-w-[1.25rem] items-center justify-center
                rounded-full bg-white/90 px-1 text-[10px] font-semibold
                text-rose-600 dark:bg-slate-800 dark:text-rose-100
              "
            >
              {urgentCount}
            </span>
          </span>
        </GlowButton>
      </div>

      {/* Sottotitolo sotto, allineato a sinistra */}
      <p className="text-xs text-dark/60 dark:text-white/60">
        {anagraficaLabel} collegati a questa aula.
      </p>
    </div>
  );
}
