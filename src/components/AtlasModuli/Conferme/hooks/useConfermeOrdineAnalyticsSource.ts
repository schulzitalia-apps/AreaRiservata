"use client";

import { useEffect, useMemo } from "react";
import type { TimeKey } from "../types";
import { monthsBackFromTimeKey } from "../confermeOrdine.safe";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchConfermeOrdineAnalytics,
  selectConfermeOrdineAnalyticsSticky,
} from "@/components/Store/slices/confermeOrdineAnalyticsSlice";

const STALE_AFTER_MS = 5 * 60 * 1000;

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

  const isStale = useMemo(() => {
    const updatedAt = analyticsEntry?.updatedAt;
    if (!updatedAt) return true;

    const ts = new Date(updatedAt).getTime();
    if (!Number.isFinite(ts)) return true;

    return Date.now() - ts > STALE_AFTER_MS;
  }, [analyticsEntry?.updatedAt]);

  useEffect(() => {
    if (analyticsEntry?.status === "loading") return;

    const shouldFetch =
      !analyticsEntry ||
      analyticsEntry.status === "idle" ||
      (analyticsEntry.status === "succeeded" && isStale);

    if (!shouldFetch) return;

    dispatch(fetchConfermeOrdineAnalytics({ monthsBack }));
  }, [monthsBack, dispatch, analyticsEntry, isStale]);

  return {
    monthsBack,
    analyticsEntry,
    apiData: analyticsEntry?.data,
    apiStatus: analyticsEntry?.status ?? "idle",
    apiError: analyticsEntry?.error ?? null,
  };
}
