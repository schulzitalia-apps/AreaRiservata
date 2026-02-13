// src/components/AtlasModuli/common/useReferenceBatchPreview.ts
"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchReferenceFieldValues } from "@/components/Store/slices/anagraficheSlice";
import type { ReferenceConfig } from "@/config/anagrafiche.fields.catalog";

export type ReferenceBatchEntry = {
  fieldKey: string;
  config: ReferenceConfig;
  ids: string[];
};

export function useReferenceBatchPreviewMulti(entries: ReferenceBatchEntry[]) {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.anagrafiche);

  // normalizza + unique
  const normalized = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        ids: Array.from(new Set(e.ids.filter(Boolean))).map(String),
      })),
    [entries],
  );

  // trigger fetch SOLO per i missing
  useEffect(() => {
    normalized.forEach(({ fieldKey, config, ids }) => {
      const { kind, previewField, targetSlug } = config;
      if (kind !== "anagrafica" || !previewField) return;

      const bucket = state.byType[targetSlug];
      const cacheForField =
        bucket?.referenceValues?.[fieldKey] || {};

      const missing = ids.filter((id) => !(id in cacheForField));
      if (missing.length === 0) return;

      dispatch(
        fetchReferenceFieldValues({
          type: targetSlug,   // bucket di destinazione
          fieldKey,
          targetSlug,
          previewField,
          ids: missing,
        }),
      );
    });
  }, [normalized, dispatch]); // niente `state` per evitare loop

  // build output: fieldKey -> (id -> label)
  const out: Record<string, Record<string, string | null>> = {};

  normalized.forEach(({ fieldKey, config }) => {
    const bucket = state.byType[config.targetSlug];
    const cache = bucket?.referenceValues?.[fieldKey];
    if (cache) out[fieldKey] = cache;
  });

  return out;
}
