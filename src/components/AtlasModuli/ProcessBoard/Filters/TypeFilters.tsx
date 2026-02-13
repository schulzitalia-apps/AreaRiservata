"use client";

import { cn } from "@/server-utils/lib/utils";
import type { EventoDef } from "@/config/eventi.registry";
import { TYPE_COLOR_PALETTE } from "@/components/AtlasModuli/Calendario/color-palette";

type Props = {
  defs: EventoDef[];
  selected: string[];
  onToggle: (slug: string) => void;
  typeColorMap: Record<string, number>;
};

export default function TypeFilters({ defs, selected, onToggle, typeColorMap }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {defs.map((def) => {
        const Icon = def.icon;
        const checked = selected.includes(def.slug);
        const colorIdx = typeColorMap[def.slug] ?? 0;
        const palette = TYPE_COLOR_PALETTE[colorIdx];

        return (
          <label
            key={def.slug}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition select-none",
              checked ? palette.filterChecked : palette.filterUnchecked,
            )}
          >
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={checked}
              onChange={() => onToggle(def.slug)}
            />
            <Icon className="h-4 w-4 opacity-80" />
            <span className="whitespace-nowrap">{def.label}</span>
          </label>
        );
      })}
    </div>
  );
}
