import type { AulaPartecipanteFieldKey } from "@/config/aule.fields.catalog";
import { AULA_PARTECIPANTE_FIELD_CATALOG } from "@/config/aule.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";
import type { PartecipanteView } from "../types";

interface AulaPartecipanteDetailsCardProps {
  partecipante: PartecipanteView;
  preview?: AnagraficaPreview;
  dynamicFields: AulaPartecipanteFieldKey[];
  anagSlug: string;
  onClearSelection: () => void;
}

export function AulaPartecipanteDetailsCard({
                                              partecipante,
                                              preview,
                                              dynamicFields,
                                              anagSlug,
                                              onClearSelection,
                                            }: AulaPartecipanteDetailsCardProps) {
  const name = preview?.displayName || partecipante.anagraficaId;
  const subtitle = preview?.subtitle || "";
  const joined = partecipante.joinedAt
    ? new Date(partecipante.joinedAt).toLocaleDateString()
    : "—";

  const dati = partecipante.dati || {};

  return (
    <div
      className="
        rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-xs text-dark shadow-sm
        backdrop-blur-sm
        dark:border-dark-3 dark:bg-gray-900/80 dark:text-white
      "
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-dark/60 dark:text-white/60">
            Partecipante selezionato
          </div>
          <div className="text-sm font-semibold">{name}</div>
          {subtitle && (
            <div className="text-[12px] text-dark/70 dark:text-white/70">
              {subtitle}
            </div>
          )}
          <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
            Ingresso: {joined}
          </div>
        </div>

        <div className="flex gap-2">
          <GlowButton color="neutral" size="sm" onClick={onClearSelection}>
            Torna a panoramica
          </GlowButton>

          <GlowButton
            href={`/anagrafiche/${anagSlug}/${partecipante.anagraficaId}`}
            color="primary"
            size="sm"
          >
            Anagrafica
          </GlowButton>
        </div>
      </div>

      {dynamicFields.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          {dynamicFields.map((key) => {
            const cfg = AULA_PARTECIPANTE_FIELD_CATALOG[key];
            const value = dati[key] ?? "—";

            return (
              <div key={key}>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-dark/60 dark:text-white/60">
                  {cfg.label}
                </div>
                <div className="whitespace-pre-wrap text-[13px]">
                  {String(value || "—")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
