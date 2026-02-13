"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BilancioTimeKey, BilancioTotals } from "../types";
import type { TimeKey as SpeseTimeKey } from "@/components/AtlasModuli/Spese/types";
import type { TimeKey as RicaviTimeKey } from "@/components/AtlasModuli/Ricavi/types";
import { BILANCIO_TOTALS_MOCK } from "../mock";

/**
 * Mapping: bilancio timeKey -> moduli timeKey (spese/ricavi).
 */
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

  /** switch unico del bilancio */
  bilancioUseMock: boolean;

  /** source states (NON cambiamo i loro hook, li leggiamo soltanto) */
  ricaviSourceUseMock: boolean;
  speseSourceUseMock: boolean;

  ricaviApiStatus?: Status;
  speseApiStatus?: Status;

  /** computed */
  speseCurrentLordo: number;
  ricaviCurrentLordo: number;
}): BilancioTotals {
  // ✅ cache ultimo LIVE buono (anti-flash del mock)
  const lastGoodLiveRef = useRef<BilancioTotals | null>(null);

  const sourcesAreApi = !args.ricaviSourceUseMock && !args.speseSourceUseMock;

  const ricaviReady =
    args.ricaviApiStatus === "succeeded" || hasUsableNumber(args.ricaviCurrentLordo);
  const speseReady =
    args.speseApiStatus === "succeeded" || hasUsableNumber(args.speseCurrentLordo);

  const liveReady = sourcesAreApi && ricaviReady && speseReady;

  // ✅ aggiorna cache solo quando LIVE è davvero pronto
  useEffect(() => {
    if (args.bilancioUseMock) return;
    if (!liveReady) return;

    lastGoodLiveRef.current = {
      ricavi: Math.round(Number(args.ricaviCurrentLordo) || 0),
      spese: Math.round(Number(args.speseCurrentLordo) || 0),
    };
  }, [
    args.bilancioUseMock,
    liveReady,
    args.ricaviCurrentLordo,
    args.speseCurrentLordo,
  ]);

  return useMemo(() => {
    // 1) se bilancio è in mock -> mock bilancio “hard”
    if (args.bilancioUseMock) return BILANCIO_TOTALS_MOCK[args.bilancioTimeKey];

    // 2) LIVE pronto -> LIVE
    if (liveReady) {
      return {
        ricavi: Math.round(Number(args.ricaviCurrentLordo) || 0),
        spese: Math.round(Number(args.speseCurrentLordo) || 0),
      };
    }

    // 3) LIVE non pronto -> NON mock!
    //    Mantieni ultimo live buono (se esiste), così la UI non “spara mock” per 1 frame.
    if (lastGoodLiveRef.current) return lastGoodLiveRef.current;

    // 4) primissima render senza niente ancora: torna 0 (e ci metti overlay/spinner)
    return { ricavi: 0, spese: 0 };
  }, [
    args.bilancioTimeKey,
    args.bilancioUseMock,
    liveReady,
    args.ricaviCurrentLordo,
    args.speseCurrentLordo,
  ]);
}
