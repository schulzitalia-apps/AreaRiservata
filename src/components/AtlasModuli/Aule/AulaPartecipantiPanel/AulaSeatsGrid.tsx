import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import type { PartecipanteView } from "./types";

interface AulaSeatsGridProps {
  partecipanti: PartecipanteView[];
  anagraficaItems: AnagraficaPreview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  ownerName: string;
}

export function AulaSeatsGrid({
                                partecipanti,
                                anagraficaItems,
                                selectedId,
                                onSelect,
                                onDeselect,
                                ownerName,
                              }: AulaSeatsGridProps) {
  const enriched = partecipanti.map((p) => {
    const preview = anagraficaItems.find((a) => a.id === p.anagraficaId);
    return { p, preview };
  });

  return (
    <div
      className="
        rounded-2xl border border-slate-200/60 bg-gradient-to-b
        from-slate-50/80 to-slate-100/70
        p-4 shadow-sm
        dark:border-white/10 dark:from-slate-900/70 dark:to-slate-950/80
      "
    >
      {/* Cattedra con owner */}
      <div className="mb-5 flex justify-center">
        <div
          className="
            inline-flex min-w-[200px] flex-col items-center justify-center rounded-2xl
            border border-slate-300 bg-white/80 px-6 py-2 text-xs font-semibold tracking-wide
            text-slate-700 shadow-sm backdrop-blur-sm
            dark:border-white/20 dark:bg-white/10 dark:text-white
          "
        >
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-300">
            Docente / Owner
          </span>
          <span className="mt-0.5 max-w-[180px] truncate text-sm font-semibold">
            {ownerName}
          </span>
        </div>
      </div>

      {/* Sedie */}
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
        {enriched.map(({ p, preview }, index) => {
          const name = preview?.displayName || p.anagraficaId || "Senza nome";
          const isSelected = selectedId === p.anagraficaId;

          return (
            <button
              key={p.anagraficaId + index}
              type="button"
              onClick={() => onSelect(p.anagraficaId)}
              onDoubleClick={() => {
                if (selectedId === p.anagraficaId) {
                  onDeselect();
                }
              }}
              title={name}
              className="
                group flex flex-col items-center gap-1
                text-[11px] text-slate-700 dark:text-slate-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
              "
            >
              {/* Avatar omino con glow morbido */}
              <div
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full border
                  bg-white/90 shadow-[0_0_6px_rgba(15,23,42,0.45)] backdrop-blur-sm
                  border-slate-300 text-slate-700
                  dark:bg-slate-900/85 dark:border-slate-500 dark:text-slate-100
                  transition-all duration-200
                  group-hover:shadow-[0_0_18px_rgba(59,130,246,0.55)]
                  group-hover:border-primary/70 group-hover:text-primary
                  ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-[0_0_24px_rgba(59,130,246,0.85)]"
                    : ""
                }
                `}
              >
                <UserAvatarIcon />
              </div>

              {/* Nome in pill sotto il posto */}
              <InfoPill
                tone={isSelected ? "success" : "sky"}
                className="max-w-[140px] truncate text-[10px]"
              >
                {name}
              </InfoPill>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ ICON ------------------------------------ */

function UserAvatarIcon() {
  // omino stilizzato (segue currentColor)
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="8"
        r="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6.5 18.2C7.4 15.8 9.5 14.2 12 14.2s4.6 1.6 5.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
