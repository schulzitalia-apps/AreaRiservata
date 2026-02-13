// Store/slices/azioniSlice.ts

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  AzioniState,
  AzioneBucket,
  AzionePreview,
} from "../models/azioni";
import { azioniService } from "../services/azioniService";

const initialState: AzioniState = { byType: {} };

const ensure = (s: AzioniState, type: string): AzioneBucket =>
  (s.byType[type] ||= {
    status: "idle",
    items: [],
    error: null,
  });

/* ------------------------------- THUNK LIST ------------------------------- */

export const fetchAzioni = createAsyncThunk<
  { type: string; items: AzionePreview[] },
  {
    type: string;
    query?: string;
    visibilityRole?: string;
    timeFrom?: string;
    timeTo?: string;
    anagraficaType?: string;
    anagraficaId?: string;
    gruppoType?: string;
    gruppoId?: string;
  }
>("azioni/fetchAll", async (args) => {
  const json = await azioniService.list(args);
  return { type: args.type, items: json.items };
});

/* --------------------------------- SLICE ---------------------------------- */

const azioniSlice = createSlice({
  name: "azioni",
  initialState,
  reducers: {
    clearAzioni(state, action: { payload: { type: string } }) {
      const bucket = ensure(state, action.payload.type);
      bucket.items = [];
      bucket.status = "idle";
      bucket.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAzioni.pending, (state, action) => {
        const t = action.meta.arg.type;
        const bucket = ensure(state, t);
        bucket.status = "loading";
        bucket.error = null;
      })
      .addCase(fetchAzioni.fulfilled, (state, action) => {
        const { type, items } = action.payload;
        const bucket = ensure(state, type);
        bucket.status = "succeeded";
        bucket.items = items;
      })
      .addCase(fetchAzioni.rejected, (state, action) => {
        const t = action.meta.arg.type;
        const bucket = ensure(state, t);
        bucket.status = "failed";
        bucket.error = action.error.message || "Errore";
      });
  },
});

export const { clearAzioni } = azioniSlice.actions;
export default azioniSlice.reducer;
