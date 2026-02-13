// src/components/Aule/AulaPartecipantiPanel/cards/AulaUrgentCard.tsx
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";
import type { AulaAlert } from "../types";

interface AulaUrgentCardProps {
  alerts: AulaAlert[];
  ownerName: string;
  onBackToOverview?: () => void;   // 👈 nuovo opzionale
}

export function AulaUrgentCard({
                                 alerts,
                                 ownerName,
                                 onBackToOverview,
                               }: AulaUrgentCardProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <div
      className="
        rounded-2xl border border-rose-300/80 bg-rose-50/80 p-4 text-xs text-dark shadow-sm
        backdrop-blur-sm
        dark:border-rose-400/60 dark:bg-rose-950/50 dark:text-rose-50
      "
    >
      <div className="mb-2 text-[11px] uppercase tracking-wide text-rose-700 dark:text-rose-100">
        Urgenze / criticità
      </div>
      <div className="mb-2 text-[12px]">
        Criticità che richiedono attenzione immediata per l&apos;aula gestita
        da <span className="font-semibold">{ownerName}</span>.
      </div>

      {hasAlerts ? (
        <ul className="mt-1 space-y-2 text-[12px]">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-lg bg-white/80 px-3 py-2 text-[12px] shadow-sm dark:bg-rose-950/40"
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
          Nessuna urgenza segnalata al momento.
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
