// src/components/Aule/AulaPartecipantiPanel/cards/AulaAlertsCard.tsx
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";
import type { AulaAlert } from "../types";

interface AulaAlertsCardProps {
  alerts: AulaAlert[];
  ownerName: string;
  onBackToOverview?: () => void;   // 👈 nuovo opzionale
}

export function AulaAlertsCard({
                                 alerts,
                                 ownerName,
                                 onBackToOverview,
                               }: AulaAlertsCardProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <div
      className="
        rounded-2xl border border-amber-300/70 bg-amber-50/70 p-4 text-xs text-dark shadow-sm
        backdrop-blur-sm
        dark:border-amber-400/50 dark:bg-amber-900/40 dark:text-amber-50
      "
    >
      <div className="mb-2 text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-100">
        Avvisi sul corso / aula
      </div>
      <div className="mb-2 text-[12px]">
        Riepilogo degli avvisi per l&apos;aula gestita da{" "}
        <span className="font-semibold">{ownerName}</span>.
      </div>

      {hasAlerts ? (
        <ul className="mt-1 space-y-2 text-[12px]">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-lg bg-white/70 px-3 py-2 text-[12px] shadow-sm dark:bg-amber-950/40"
            >
              <div className="font-semibold">{a.title}</div>
              {a.description && (
                <div className="mt-0.5 text-[11px] opacity-80">
                  {a.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[11px] opacity-80">
          Nessun avviso registrato per questa aula al momento.
        </div>
      )}

      {onBackToOverview && (
        <div className="mt-3 flex justify-end">
          <GlowButton size="sm" color="neutral" onClick={onBackToOverview}>
            Torna a panoramica
          </GlowButton>
        </div>
      )}
    </div>
  );
}
