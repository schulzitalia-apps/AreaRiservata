"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchEventi } from "@/components/Store/slices/eventiSlice";
import type { EventoPreview } from "@/components/Store/models/eventi";

export type EventiFilters = {
  query?: string;
  visibilityRole?: string;
  timeFrom?: string;
  timeTo?: string;
  anagraficaType?: string;
  anagraficaId?: string;
  gruppoType?: string;
  gruppoId?: string;
};

type Status = "idle" | "loading" | "succeeded" | "failed";

export function useEventiList(
  type: string,
  filters: EventiFilters,
  page: number,
  pageSize: number,
) {
  const dispatch = useAppDispatch();
  const bucket = useAppSelector((s) => s.eventi.byType[type]);
  const items: EventoPreview[] = bucket?.items ?? [];
  const status: Status = (bucket?.status as Status) ?? "idle";
  const total = bucket?.total ?? 0;

  useEffect(() => {
    dispatch(
      fetchEventi({
        type,
        query: filters.query,
        visibilityRole: filters.visibilityRole,
        timeFrom: filters.timeFrom,
        timeTo: filters.timeTo,
        anagraficaType: filters.anagraficaType,
        anagraficaId: filters.anagraficaId,
        gruppoType: filters.gruppoType,
        gruppoId: filters.gruppoId,
        page,
        pageSize,
      }),
    );
  }, [
    dispatch,
    type,
    filters.query,
    filters.visibilityRole,
    filters.timeFrom,
    filters.timeTo,
    filters.anagraficaType,
    filters.anagraficaId,
    filters.gruppoType,
    filters.gruppoId,
    page,
    pageSize,
  ]);

  const totalPages = useMemo(
    () =>
      total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    [total, pageSize],
  );

  return {
    items,
    status,
    total,
    totalPages,
  };
}
