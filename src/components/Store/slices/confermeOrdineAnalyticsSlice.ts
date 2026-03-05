import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  ConfermeOrdineAnalyticsEntry,
  ConfermeOrdineAnalyticsResponse,
} from "../models/confermeOrdineAnalytics";
import { confermeOrdineAnalyticsService } from "../services/confermeOrdineAnalyticsService";

/**
 * Key cache:
 * - modulo: confermeOrdineAnalytics
 * - report: analytics
 * - monthsBack
 */
function makeConfermeOrdineAnalyticsKey(args: { monthsBack: number }) {
  return `confermeOrdineAnalytics|analytics|monthsBack=${args.monthsBack}`;
}

export type ConfermeOrdineAnalyticsState = {
  byKey: Record<string, ConfermeOrdineAnalyticsEntry<any>>;

  /**
   * ✅ anti-flash cross-key:
   * quando cambi monthsBack (key nuova ancora vuota/loading),
   * usa l'ultimo payload "succeeded" invece di tornare a vuoto.
   */
  lastGood: {
    analytics: ConfermeOrdineAnalyticsResponse | null;
  };
};

const initialState: ConfermeOrdineAnalyticsState = {
  byKey: {},
  lastGood: {
    analytics: null,
  },
};

/* ------------------------------- THUNK ----------------------------------- */

export const fetchConfermeOrdineAnalytics = createAsyncThunk<
  { key: string; data: ConfermeOrdineAnalyticsResponse },
  { monthsBack?: number }
>("confermeOrdineAnalytics/fetchAnalytics", async (args) => {
  const monthsBack =
    typeof args?.monthsBack === "number" && args.monthsBack > 0
      ? args.monthsBack
      : 24;

  const data = await confermeOrdineAnalyticsService.analytics({ monthsBack });

  return {
    key: makeConfermeOrdineAnalyticsKey({ monthsBack }),
    data,
  };
});

/* -------------------------------- SLICE ---------------------------------- */

const confermeOrdineAnalyticsSlice = createSlice({
  name: "confermeOrdineAnalytics",
  initialState,
  reducers: {
    clearKey(s, a: { payload: { key: string } }) {
      delete s.byKey[a.payload.key];
    },
    clearPrefix(s, a: { payload: { prefix: string } }) {
      const prefix = a.payload.prefix;
      for (const k of Object.keys(s.byKey)) {
        if (k.startsWith(prefix)) delete s.byKey[k];
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchConfermeOrdineAnalytics.pending, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeConfermeOrdineAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "loading",
        data: prev?.data, // ✅ se stessa key, mantieni prev
        error: null,
        updatedAt: prev?.updatedAt ?? null,
      };
    });

    b.addCase(fetchConfermeOrdineAnalytics.fulfilled, (s, a) => {
      s.byKey[a.payload.key] = {
        status: "succeeded",
        data: a.payload.data,
        error: null,
        updatedAt: new Date().toISOString(),
      };

      s.lastGood.analytics = a.payload.data;
    });

    b.addCase(fetchConfermeOrdineAnalytics.rejected, (s, a) => {
      const monthsBack =
        typeof a.meta.arg?.monthsBack === "number" && a.meta.arg.monthsBack > 0
          ? a.meta.arg.monthsBack
          : 24;

      const key = makeConfermeOrdineAnalyticsKey({ monthsBack });
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "failed",
        data: prev?.data,
        error: a.error.message || "Errore",
        updatedAt: prev?.updatedAt ?? null,
      };
      // lastGood non si tocca
    });
  },
});

export const { clearKey, clearPrefix } = confermeOrdineAnalyticsSlice.actions;
export default confermeOrdineAnalyticsSlice.reducer;

/* ------------------------------ SELECTORS --------------------------------- */

function normMonthsBack(args?: { monthsBack?: number }) {
  return typeof args?.monthsBack === "number" && args.monthsBack > 0 ? args.monthsBack : 24;
}

export function selectConfermeOrdineAnalyticsEntry(
  state: any,
  args?: { monthsBack?: number },
): ConfermeOrdineAnalyticsEntry<ConfermeOrdineAnalyticsResponse> | undefined {
  const monthsBack = normMonthsBack(args);
  const key = makeConfermeOrdineAnalyticsKey({ monthsBack });
  return state?.confermeOrdineAnalytics?.byKey?.[key];
}

/**
 * ✅ SELECTOR STICKY:
 * - se la key corrente non ha data (perché monthsBack è cambiato),
 *   torna lastGood.analytics così la UI non flasha a vuoto.
 */
export function selectConfermeOrdineAnalyticsSticky(
  state: any,
  args?: { monthsBack?: number },
): ConfermeOrdineAnalyticsEntry<ConfermeOrdineAnalyticsResponse> | undefined {
  const entry = selectConfermeOrdineAnalyticsEntry(state, args);
  if (entry?.data) return entry;

  const last = state?.confermeOrdineAnalytics?.lastGood?.analytics ?? null;
  if (!last) return entry;

  return {
    status: entry?.status ?? "idle",
    data: last,
    error: entry?.error ?? null,
    updatedAt: entry?.updatedAt ?? null,
  };
}