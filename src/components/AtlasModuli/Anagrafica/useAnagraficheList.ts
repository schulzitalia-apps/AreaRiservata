// src/components/AtlasModuli/anagrafiche/AnagraficheList/useAnagraficheList.ts
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAnagrafiche } from "@/components/Store/slices/anagraficheSlice";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

export type AnagraficaFilters = {
  query?: string;
  docType?: string;
  visibilityRole?: string;

  sortKey?: string;
  sortDir?: "asc" | "desc";
  fields?: string[];
};

function stableFieldsKey(fields?: string[]) {
  // NON sortare: l'ordine dei fields può essere importante
  return (fields ?? []).join("|");
}

export function useAnagraficheList(
  type: string,
  filters: AnagraficaFilters,
  page: number,
  pageSize: number,
): {
  items: AnagraficaPreview[];
  status: "idle" | "loading" | "succeeded" | "failed";
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
} {
  const dispatch = useAppDispatch();

  const bucket = useAppSelector((s) => s.anagrafiche.byType[type]);
  const status = bucket?.status ?? "idle";
  const items = bucket?.items ?? [];
  const total = bucket?.total ?? 0;

  const totalPages = useMemo(() => {
    const ps = pageSize || 25;
    const pages = Math.ceil((total || 0) / ps);
    return Math.max(1, pages || 1);
  }, [total, pageSize]);

  const safePage = useMemo(() => {
    if (!Number.isFinite(page) || page < 1) return 1;
    if (page > totalPages) return totalPages;
    return page;
  }, [page, totalPages]);

  const fieldsKey = useMemo(() => stableFieldsKey(filters.fields), [filters.fields]);

  const requestKey = useMemo(() => {
    return [
      type,
      filters.query ?? "",
      filters.docType ?? "",
      filters.visibilityRole ?? "",
      filters.sortKey ?? "",
      filters.sortDir ?? "",
      safePage,
      pageSize,
      fieldsKey,
    ].join("::");
  }, [
    type,
    filters.query,
    filters.docType,
    filters.visibilityRole,
    filters.sortKey,
    filters.sortDir,
    safePage,
    pageSize,
    fieldsKey,
  ]);

  const last = useRef<string>("");

  useEffect(() => {
    if (!type) return;
    if (last.current === requestKey) return;
    last.current = requestKey;

    dispatch(
      fetchAnagrafiche({
        type,
        query: filters.query || undefined,
        docType: filters.docType || undefined,
        visibilityRole: filters.visibilityRole || undefined,
        page: safePage,
        pageSize,
        sortKey: filters.sortKey || undefined,
        sortDir: filters.sortKey ? (filters.sortDir ?? "desc") : undefined,
        fields: filters.fields && filters.fields.length ? filters.fields : undefined,
      }),
    );
  }, [dispatch, type, requestKey, safePage, pageSize, filters.query, filters.docType, filters.visibilityRole, filters.sortKey, filters.sortDir, fieldsKey]);

  return { items, status, total, totalPages, page: safePage, pageSize };
}
