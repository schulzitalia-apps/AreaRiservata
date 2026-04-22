"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BilancioTimeKey, BilancioTotals } from "../types";
import type { TimeKey as SpeseTimeKey } from "@/components/AtlasModuli/Spese/types";
import type { TimeKey as RicaviTimeKey } from "@/components/AtlasModuli/Ricavi/types";

export function mapBilancioToModuleTimeKey(t: BilancioTimeKey): SpeseTimeKey & RicaviTimeKey {
  switch (t) {
    case "mese":
      return "mese";
    case "trimestre":
      return "trimestre";
    case "semestre":
      return "semestre";
    case "anno_fiscale":
      return "anno_fiscale";
    case "anno":
    case "tutto":
    default:
      return "anno";
  }
}

type Status = "idle" | "loading" | "succeeded" | "failed" | undefined;

function hasUsableNumber(n: unknown) {
  return Number.isFinite(Number(n)) && Number(n) !== 0;
}

export function useBilancioTotals(args: {
  bilancioTimeKey: BilancioTimeKey;
  ricaviApiStatus?: Status;
  speseApiStatus?: Status;
  speseCurrentLordo: number;
  ricaviCurrentLordo: number;
}): BilancioTotals {
  const lastGoodLiveRef = useRef<BilancioTotals | null>(null);

  const ricaviReady =
    args.ricaviApiStatus === "succeeded" || hasUsableNumber(args.ricaviCurrentLordo);
  const speseReady =
    args.speseApiStatus === "succeeded" || hasUsableNumber(args.speseCurrentLordo);

  const liveReady = ricaviReady && speseReady;

  useEffect(() => {
    if (!liveReady) return;

    lastGoodLiveRef.current = {
      ricavi: Number(args.ricaviCurrentLordo) || 0,
      spese: Number(args.speseCurrentLordo) || 0,
    };
  }, [liveReady, args.ricaviCurrentLordo, args.speseCurrentLordo]);

  return useMemo(() => {
    if (liveReady) {
      return {
        ricavi: Number(args.ricaviCurrentLordo) || 0,
        spese: Number(args.speseCurrentLordo) || 0,
      };
    }

    if (lastGoodLiveRef.current) return lastGoodLiveRef.current;
    return { ricavi: 0, spese: 0 };
  }, [liveReady, args.ricaviCurrentLordo, args.speseCurrentLordo]);
}

