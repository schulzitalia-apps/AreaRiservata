"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchSpeseAnalytics,
  selectSpeseAnalyticsSticky,
} from "@/components/Store/slices/financialsSlice";
import { monthsBackFromTimeKey } from "../speseOverview.safe";
import type { TimeKey } from "../types";

export function useSpeseAnalyticsSource(timeKey: TimeKey) {
  const dispatch = useAppDispatch();

  /**
   * monthsBack:
   * - API: base*2 (prev+current)
   * - anno_fiscale: 12 mesi anno precedente + mesi da gennaio a oggi
   */
  const monthsBack = useMemo(() => {
    const base = monthsBackFromTimeKey(timeKey);

    if (timeKey === "anno_fiscale") {
      const now = new Date();
      const monthsSinceJanThisYear = now.getMonth() + 1;
      return Math.min(12 + monthsSinceJanThisYear, 60);
    }

    return Math.min(base * 2, 60);
  }, [timeKey]);

  const analyticsEntry = useAppSelector((state) =>
    selectSpeseAnalyticsSticky(state, { monthsBack })
  );

  const lastGoodApiDataRef = useRef<any>(null);

  useEffect(() => {
    if (analyticsEntry?.status === "succeeded" && analyticsEntry?.data) {
      lastGoodApiDataRef.current = analyticsEntry.data;
    }
  }, [analyticsEntry?.status, analyticsEntry?.data]);

  useEffect(() => {
    if (analyticsEntry?.status === "loading") return;
    if (analyticsEntry?.status === "succeeded") return;

    dispatch(fetchSpeseAnalytics({ monthsBack }));
  }, [monthsBack, dispatch]);

  const apiData = (analyticsEntry?.data ?? lastGoodApiDataRef.current) as any;
  const apiStatus = analyticsEntry?.status;
  const apiError = analyticsEntry?.error ?? null;

  return {
    monthsBack,
    analyticsEntry,
    apiData,
    apiStatus,
    apiError,
  };
}
