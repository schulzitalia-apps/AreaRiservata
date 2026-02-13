"use client";

import { useMemo } from "react";
import type { VariantConfigDTO } from "@/server-utils/service/variantConfigQuery";
import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";

export function VariantSwitcher({
                                  variants,
                                  value,
                                  onChange,
                                  disabled,
                                }: {
  variants: VariantConfigDTO[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const selectedLabel = useMemo(() => {
    const v = variants.find((x) => x.variantId === value);
    return v?.label || value || "Default";
  }, [variants, value]);

  if (!variants || variants.length <= 1) {
    return <InfoPill tone="info">Variant: {selectedLabel}</InfoPill>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InfoPill tone="info">Variant: {selectedLabel}</InfoPill>

      <select
        className="rounded-full border border-stroke bg-white px-3 py-2 text-xs font-medium text-dark shadow-sm
                   hover:bg-gray-2
                   dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-2/80"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {variants.map((v) => (
          <option key={v.variantId} value={v.variantId}>
            {v.label} ({v.variantId})
          </option>
        ))}
      </select>
    </div>
  );
}
