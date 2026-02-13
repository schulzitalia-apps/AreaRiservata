import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  FinancialsEntry,
  SpeseAnalyticsResponse,
  RicaviAnalyticsResponse,
} from "../models/financials";
import { financialsService } from "../services/financialsService";

/**
 * Key cache:
 * - modulo: financials
 * - report: <...>
 * - monthsBack
 */
function makeSpeseAnalyticsKey(args: { monthsBack: number }) {
  return `financials|speseAnalytics|monthsBack=${args.monthsBack}`;
}

function makeRicaviAnalyticsKey(args: { monthsBack: number }) {
  return `financials|ricaviAnalytics|monthsBack=${args.monthsBack}`;
}

export type FinancialsState = {
  byKey: Record<string, FinancialsEntry<any>>;

  /**
   * ✅ anti-flash cross-key:
   * quando cambi monthsBack (key nuova ancora vuota/loading),
   * possiamo usare l'ultimo payload "succeeded" invece di tornare a mock/0.
   */
  lastGood: {
    speseAnalytics: SpeseAnalyticsResponse | null;
    ricaviAnalytics: RicaviAnalyticsResponse | null;
  };
};

const initialState: FinancialsState = {
  byKey: {},
  lastGood: {
    speseAnalytics: null,
    ricaviAnalytics: null,
  },
};

/* ------------------------------- THUNKS ---------------------------------- */

export const fetchSpeseAnalytics = createAsyncThunk<
  { key: string; data: SpeseAnalyticsResponse },
  { monthsBack?: number }
>("financials/fetchSpeseAnalytics", async (args) => {
  const monthsBack =
    typeof args?.monthsBack === "number" && args.monthsBack > 0
      ? args.monthsBack
      : 24;

  const data = await financialsService.speseAnalytics({ monthsBack });

  return {
    key: makeSpeseAnalyticsKey({ monthsBack }),
    data,
  };
});

export const fetchRicaviAnalytics = createAsyncThunk<
  { key: string; data: RicaviAnalyticsResponse },
  { monthsBack?: number }
>("financials/fetchRicaviAnalytics", async (args) => {
  const monthsBack =
    typeof args?.monthsBack === "number" && args.monthsBack > 0
      ? args.monthsBack
      : 24;

  const data = await financialsService.ricaviAnalytics({ monthsBack });

  return {
    key: makeRicaviAnalyticsKey({ monthsBack }),
    data,
  };
});

/* -------------------------------- SLICE ---------------------------------- */

const financialsSlice = createSlice({
  name: "financials",
  initialState,
  reducers: {
    clearFinancialKey(s, a: { payload: { key: string } }) {
      delete s.byKey[a.payload.key];
    },
    clearFinancialPrefix(s, a: { payload: { prefix: string } }) {
      const prefix = a.payload.prefix;
      for (const k of Object.keys(s.byKey)) {
        if (k.startsWith(prefix)) delete s.byKey[k];
      }
    },
  },
  extraReducers: (b) => {
    /* ---------- SPESE ---------- */

    b.addCase(fetchSpeseAnalytics.pending, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeSpeseAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "loading",
        data: prev?.data, // ✅ se stessa key, mantieni prev
        error: null,
        updatedAt: prev?.updatedAt ?? null,
      };
    });

    b.addCase(fetchSpeseAnalytics.fulfilled, (s, a) => {
      s.byKey[a.payload.key] = {
        status: "succeeded",
        data: a.payload.data,
        error: null,
        updatedAt: new Date().toISOString(),
      };

      // ✅ salva ultimo buono (anti-flash cross-key)
      s.lastGood.speseAnalytics = a.payload.data;
    });

    b.addCase(fetchSpeseAnalytics.rejected, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeSpeseAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "failed",
        data: prev?.data,
        error: a.error.message || "Errore",
        updatedAt: prev?.updatedAt ?? null,
      };
      // (non tocchiamo lastGood)
    });

    /* ---------- RICAVI ---------- */

    b.addCase(fetchRicaviAnalytics.pending, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeRicaviAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "loading",
        data: prev?.data,
        error: null,
        updatedAt: prev?.updatedAt ?? null,
      };
    });

    b.addCase(fetchRicaviAnalytics.fulfilled, (s, a) => {
      s.byKey[a.payload.key] = {
        status: "succeeded",
        data: a.payload.data,
        error: null,
        updatedAt: new Date().toISOString(),
      };

      // ✅ salva ultimo buono (anti-flash cross-key)
      s.lastGood.ricaviAnalytics = a.payload.data;
    });

    b.addCase(fetchRicaviAnalytics.rejected, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeRicaviAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "failed",
        data: prev?.data,
        error: a.error.message || "Errore",
        updatedAt: prev?.updatedAt ?? null,
      };
    });
  },
});

export const { clearFinancialKey, clearFinancialPrefix } = financialsSlice.actions;
export default financialsSlice.reducer;

/* ------------------------------ SELECTORS --------------------------------- */

function normMonthsBack(args?: { monthsBack?: number }) {
  return typeof args?.monthsBack === "number" && args.monthsBack > 0 ? args.monthsBack : 24;
}

export function selectSpeseAnalyticsEntry(
  state: any,
  args?: { monthsBack?: number },
): FinancialsEntry<SpeseAnalyticsResponse> | undefined {
  const monthsBack = normMonthsBack(args);
  const key = makeSpeseAnalyticsKey({ monthsBack });
  return state?.financials?.byKey?.[key];
}

export function selectRicaviAnalyticsEntry(
  state: any,
  args?: { monthsBack?: number },
): FinancialsEntry<RicaviAnalyticsResponse> | undefined {
  const monthsBack = normMonthsBack(args);
  const key = makeRicaviAnalyticsKey({ monthsBack });
  return state?.financials?.byKey?.[key];
}

/**
 * ✅ SELECTOR STICKY (consigliato):
 * - se la key corrente non ha ancora data (perché monthsBack è cambiato),
 *   torna lastGood.* così la UI non flasha mai a vuoto/mock.
 */
export function selectSpeseAnalyticsSticky(
  state: any,
  args?: { monthsBack?: number },
): FinancialsEntry<SpeseAnalyticsResponse> | undefined {
  const entry = selectSpeseAnalyticsEntry(state, args);
  if (entry?.data) return entry;

  const last = state?.financials?.lastGood?.speseAnalytics ?? null;
  if (!last) return entry;

  // status lo lasciamo quello della entry se esiste (loading/failed), così puoi mostrare overlay
  return {
    status: entry?.status ?? "idle",
    data: last,
    error: entry?.error ?? null,
    updatedAt: entry?.updatedAt ?? null,
  };
}

export function selectRicaviAnalyticsSticky(
  state: any,
  args?: { monthsBack?: number },
): FinancialsEntry<RicaviAnalyticsResponse> | undefined {
  const entry = selectRicaviAnalyticsEntry(state, args);
  if (entry?.data) return entry;

  const last = state?.financials?.lastGood?.ricaviAnalytics ?? null;
  if (!last) return entry;

  return {
    status: entry?.status ?? "idle",
    data: last,
    error: entry?.error ?? null,
    updatedAt: entry?.updatedAt ?? null,
  };
}
