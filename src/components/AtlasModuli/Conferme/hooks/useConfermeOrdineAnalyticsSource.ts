"use client";

import { useEffect, useMemo } from "react";
import type { TimeKey } from "../types";
import { monthsBackFromTimeKey } from "../confermeOrdine.safe";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchConfermeOrdineAnalytics,
  selectConfermeOrdineAnalyticsSticky,
} from "@/components/Store/slices/confermeOrdineAnalyticsSlice";

export function useConfermeOrdineAnalyticsSource(timeKey: TimeKey) {
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
      const monthsSinceJanThisYear = now.getMonth() + 1; // Jan=1..Dec=12
      return Math.min(12 + monthsSinceJanThisYear, 60);
    }

    return Math.min(base * 2, 60);
  }, [timeKey]);

  const analyticsEntry = useAppSelector((state) =>
    selectConfermeOrdineAnalyticsSticky(state, { monthsBack }),
  );

  useEffect(() => {
    if (analyticsEntry?.status === "loading") return;
    if (analyticsEntry?.status === "succeeded") return;

    dispatch(fetchConfermeOrdineAnalytics({ monthsBack }));
  }, [monthsBack, dispatch]); // niente analyticsEntry per evitare loop

  return {
    monthsBack,
    analyticsEntry,
    apiData: analyticsEntry?.data,
    apiStatus: analyticsEntry?.status ?? "idle",
    apiError: analyticsEntry?.error ?? null,
  };
}