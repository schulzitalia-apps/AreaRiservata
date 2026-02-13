"use client";

import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

const ANAGRAFICA_TYPES: { slug: string; label: string }[] =
  PUBLIC_ANAGRAFICA_TYPES.map((t) => ({ slug: t.slug, label: t.label }));

export default function SlugPicker({
                                     value,
                                     onChange,
                                   }: {
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="border-b border-stroke p-4 dark:border-dark-3">
        <h2 className="text-base font-semibold text-dark dark:text-white">
          Seleziona anagrafica
        </h2>
        <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
          Scegli lo slug su cui gestire le varianti di visualizzazione.
        </p>
      </div>

      <div className="p-4">
        <label className="text-sm text-dark dark:text-white">
          Tipo anagrafica
          <select
            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {ANAGRAFICA_TYPES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label} ({t.slug})
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
