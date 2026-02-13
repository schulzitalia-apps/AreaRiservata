"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchRicaviAnalytics,
  selectRicaviAnalyticsSticky,
} from "@/components/Store/slices/financialsSlice";
import { monthsBackFromTimeKey } from "../ricaviOverview.safe";
import type { TimeKey } from "../types";

export function useRicaviAnalyticsSource(timeKey: TimeKey) {
  const dispatch = useAppDispatch();

  // Toggle mock/api (API di default)
  const [useMock, setUseMock] = useState(false);

  /**
   * monthsBack:
   * - mock: base
   * - API: base*2 (prev+current)
   * - anno_fiscale: 12 mesi anno precedente + mesi da gennaio a oggi
   */
  const monthsBack = useMemo(() => {
    const base = monthsBackFromTimeKey(timeKey);

    // mock: base
    if (useMock) return base;

    // ✅ anno_fiscale: (12 mesi anno precedente) + (mesi da gennaio a oggi)
    // (se TimeKey non include anno_fiscale, aggiungilo al type oppure cast)
    if ((timeKey as any) === "anno_fiscale") {
      const now = new Date();
      const monthsSinceJanThisYear = now.getMonth() + 1; // 1..12
      return Math.min(12 + monthsSinceJanThisYear, 60);
    }

    // api: prev+current
    return Math.min(base * 2, 60);
  }, [timeKey, useMock]);

  const analyticsEntry = useAppSelector((state) =>
    selectRicaviAnalyticsSticky(state, { monthsBack }),
  );

  // ✅ tiene in memoria l’ultimo dato API valido
  const lastGoodApiDataRef = useRef<any>(null);

  useEffect(() => {
    if (!useMock && analyticsEntry?.status === "succeeded" && analyticsEntry?.data) {
      lastGoodApiDataRef.current = analyticsEntry.data;
    }
  }, [useMock, analyticsEntry?.status, analyticsEntry?.data]);

  // fetch analytics quando switchi su API
  useEffect(() => {
    if (useMock) return;
    if (analyticsEntry?.status === "loading") return;
    if (analyticsEntry?.status === "succeeded") return;

    dispatch(fetchRicaviAnalytics({ monthsBack }));
  }, [useMock, monthsBack, dispatch]); // no analyticsEntry per evitare loop

  // ✅ in API mode: se la nuova key non ha ancora data, usa l’ultima buona
  const apiData = !useMock
    ? ((analyticsEntry?.data ?? lastGoodApiDataRef.current) as any)
    : undefined;

  const apiStatus = !useMock ? analyticsEntry?.status : "idle";
  const apiError = !useMock ? analyticsEntry?.error : null;

  return {
    useMock,
    setUseMock,
    monthsBack,
    analyticsEntry,
    apiData,
    apiStatus,
    apiError,
  };
}
