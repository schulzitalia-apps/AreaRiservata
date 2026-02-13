interface AulaOverviewCardProps {
  total: number;
  ownerName: string;
}

export function AulaOverviewCard({ total, ownerName }: AulaOverviewCardProps) {
  return (
    <div
      className="
        rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-xs text-dark shadow-sm
        backdrop-blur-sm
        dark:border-dark-3 dark:bg-gray-900/80 dark:text-white
      "
    >
      <div className="mb-2 text-[11px] uppercase tracking-wide text-dark/60 dark:text-white/60">
        Panoramica aula
      </div>
      <div className="text-sm">
        Aula gestita da <span className="font-semibold">{ownerName}</span>.
      </div>
      <div className="mt-2 text-[12px] text-dark/70 dark:text-white/70">
        Partecipanti totali: <span className="font-semibold">{total}</span>
      </div>
      <div className="mt-3 text-[11px] text-dark/60 dark:text-white/60">
        Clicca su un posto in aula per vedere i dettagli del partecipante sul
        lato sinistro. Fai doppio click sullo stesso posto o usa il pulsante
        dedicato per tornare alla panoramica.
      </div>
    </div>
  );
}
