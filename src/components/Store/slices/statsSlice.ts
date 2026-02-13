import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { StatsEntry, AnagraficheFieldStatsResponse } from "../models/stats";
import { statsService } from "../services/statsService";

/**
 * Key cache:
 * - modulo: anagrafiche
 * - type: slug anagrafica
 * - fieldKey
 * - pivot
 *
 * NB: pivot lo serializziamo in stringa in modo stabile.
 */
function makeAnagraficheFieldKey(args: {
  type: string;
  fieldKey: string;
  pivot: string | number;
}) {
  return `anagrafiche|${args.type}|${args.fieldKey}|${String(args.pivot)}`;
}

export type StatsState = {
  byKey: Record<string, StatsEntry<any>>;
};

const initialState: StatsState = {
  byKey: {},
};

/* ------------------------------- THUNKS ---------------------------------- */

export const fetchAnagraficheFieldStats = createAsyncThunk<
  { key: string; data: AnagraficheFieldStatsResponse },
  { type: string; fieldKey: string; pivot: string | number }
>("stats/fetchAnagraficheFieldStats", async (args) => {
  const data = await statsService.anagraficheField(args);
  return { key: makeAnagraficheFieldKey(args), data };
});

/* -------------------------------- SLICE ---------------------------------- */

const statsSlice = createSlice({
  name: "stats",
  initialState,
  reducers: {
    clearStatKey(s, a: { payload: { key: string } }) {
      delete s.byKey[a.payload.key];
    },
    clearStatPrefix(s, a: { payload: { prefix: string } }) {
      const prefix = a.payload.prefix;
      for (const k of Object.keys(s.byKey)) {
        if (k.startsWith(prefix)) delete s.byKey[k];
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchAnagraficheFieldStats.pending, (s, a) => {
      const key = makeAnagraficheFieldKey(a.meta.arg);
      const prev = s.byKey[key];

      s.byKey[key] = {
        status: "loading",
        data: prev?.data,
        error: null,
        updatedAt: prev?.updatedAt ?? null,
      };
    });

    b.addCase(fetchAnagraficheFieldStats.fulfilled, (s, a) => {
      s.byKey[a.payload.key] = {
        status: "succeeded",
        data: a.payload.data,
        error: null,
        updatedAt: new Date().toISOString(),
      };
    });

    b.addCase(fetchAnagraficheFieldStats.rejected, (s, a) => {
      const key = makeAnagraficheFieldKey(a.meta.arg);
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

export const { clearStatKey, clearStatPrefix } = statsSlice.actions;
export default statsSlice.reducer;

/* ------------------------------ SELECTORS --------------------------------- */

export function selectAnagraficheFieldStatsEntry(
  state: any,
  args: { type: string; fieldKey: string; pivot: string | number },
): StatsEntry<AnagraficheFieldStatsResponse> | undefined {
  const key = makeAnagraficheFieldKey(args);
  return state?.stats?.byKey?.[key];
}
