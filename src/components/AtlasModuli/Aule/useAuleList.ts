// src/app/...?/useAuleList.ts
"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAuleByType } from "@/components/Store/slices/auleSlice";
import type { AulaPreview } from "@/components/Store/models/aule";

export type AuleFilters = {
  query?: string;
  docType?: string;
  visibilityRole?: string;
};

type Status = "idle" | "loading" | "succeeded" | "failed";

export function useAuleList(
  type: string,
  filters: AuleFilters,
  page: number,
  pageSize: number,
): {
  items: AulaPreview[];
  status: Status;
  total: number;
  totalPages: number;
} {
  const dispatch = useAppDispatch();
  const bucket = useAppSelector((s) => s.aule.byType[type]);

  const items = bucket?.items ?? [];
  const status = (bucket?.status as Status) ?? "idle";
  const total = bucket?.total ?? 0;

  useEffect(() => {
    dispatch(
      fetchAuleByType({
        type,
        query: filters.query,
        docType: filters.docType,
        visibilityRole: filters.visibilityRole,
        page,
        pageSize,
      }) as any,
    );
  }, [
    dispatch,
    type,
    filters.query,
    filters.docType,
    filters.visibilityRole,
    page,
    pageSize,
  ]);

  const totalPages = useMemo(
    () => (pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1),
    [total, pageSize],
  );

  return {
    items,
    status,
    total,
    totalPages,
  };
}
