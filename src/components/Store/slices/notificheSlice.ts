// src/components/Store/slices/notificheSlice.ts

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  NotifichePreferenzeState,
  NotifichePreferenzeBucket,
  NotificaPreferenzaPreview,
} from "../models/notifiche";
import { notificheService } from "../services/notificheService";

const initialState: NotifichePreferenzeState = { byType: {} };

const ensure = (
  s: NotifichePreferenzeState,
  type: string,
): NotifichePreferenzeBucket =>
  (s.byType[type] ||= {
    status: "idle",
    items: [],
    error: null,
  });

/* ------------------------------- THUNK LIST ------------------------------- */
/**
 * Fetcha tutte le notifiche preferenze (eventi normali) e le raggruppa byType.
 * Nota: l’API già filtra con "motore preferenze" e ACL server-side.
 */
export const fetchNotifichePreferenze = createAsyncThunk<
  { items: NotificaPreferenzaPreview[] },
  { types?: string[]; limit?: number } | undefined
>("notifiche/fetchPreferenze", async (args) => {
  const json = await notificheService.listPreferenze(args);
  return { items: json.items };
});

/* --------------------------------- SLICE ---------------------------------- */

const notificheSlice = createSlice({
  name: "notifiche",
  initialState,
  reducers: {
    clearNotifichePreferenze(state, action: { payload: { type: string } }) {
      const bucket = ensure(state, action.payload.type);
      bucket.items = [];
      bucket.status = "idle";
      bucket.error = null;
    },

    clearAllNotifichePreferenze(state) {
      state.byType = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifichePreferenze.pending, (state) => {
        // setto loading su tutti i bucket "già presenti"
        for (const t of Object.keys(state.byType)) {
          const b = ensure(state, t);
          b.status = "loading";
          b.error = null;
        }
      })
      .addCase(fetchNotifichePreferenze.fulfilled, (state, action) => {
        // reset veloce: ricostruiamo byType dalla risposta
        const nextByType: NotifichePreferenzeState["byType"] = {};

        for (const item of action.payload.items) {
          const type = item.type;
          (nextByType[type] ||= {
            status: "succeeded",
            items: [],
            error: null,
          }).items.push(item);
        }

        // segno succeeded anche per i tipi che esistono ma non hanno items
        // (utile se vuoi mostrare "0" senza stare in loading)
        for (const t of Object.keys(nextByType)) {
          nextByType[t].status = "succeeded";
          nextByType[t].error = null;
        }

        state.byType = nextByType;
      })
      .addCase(fetchNotifichePreferenze.rejected, (state, action) => {
        // se fallisce, metto failed su tutti i bucket già presenti
        const err = action.error.message || "Errore";
        for (const t of Object.keys(state.byType)) {
          const b = ensure(state, t);
          b.status = "failed";
          b.error = err;
        }
      });
  },
});

export const { clearNotifichePreferenze, clearAllNotifichePreferenze } =
  notificheSlice.actions;

export default notificheSlice.reducer;
