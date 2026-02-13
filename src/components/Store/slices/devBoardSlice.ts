// src/components/Store/Slices/devBoardSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  DevBoardItem,
  DevItemCategory,
  DevItemStatus,
} from "../models/devBoard";
import { devBoardService } from "../services/devBoardService";

export type DevBoardState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: DevBoardItem[];
  error?: string | null;
};

const initialState: DevBoardState = {
  status: "idle",
  items: [],
  error: null,
};

/* ----------------------------------- THUNKS --------------------------------- */

/** LIST */
export const fetchDevItems = createAsyncThunk<
  DevBoardItem[],
  { category?: DevItemCategory; status?: DevItemStatus } | undefined
>("devBoard/fetchAll", async (arg) => {
  const json = await devBoardService.list(arg ?? {});
  return (json.items || []) as DevBoardItem[];
});

/** CREATE */
export const createDevItem = createAsyncThunk<
  DevBoardItem,
  {
    category: DevItemCategory;
    title: string;
    description: string;
    versionTag?: string | null;
  }
>("devBoard/create", async (payload) => {
  const item = await devBoardService.create(payload);
  return item;
});

/** UPDATE */
export const updateDevItem = createAsyncThunk<
  { id: string; data: Partial<DevBoardItem> },
  { id: string; data: Partial<DevBoardItem> }
>("devBoard/update", async ({ id, data }) => {
  await devBoardService.update({ id, data });
  // non ci serve la risposta, usiamo i dati che abbiamo già
  return { id, data };
});

/** DELETE */
export const deleteDevItem = createAsyncThunk<{ id: string }, { id: string }>(
  "devBoard/delete",
  async ({ id }) => {
    await devBoardService.remove(id);
    return { id };
  }
);

/* ------------------------------------ SLICE --------------------------------- */

const devBoardSlice = createSlice({
  name: "devBoard",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchDevItems.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchDevItems.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload;
      })
      .addCase(fetchDevItems.rejected, (s, a) => {
        s.status = "failed";
        s.error =
          a.error.message || "Errore nel caricamento della dev board";
      });

    b.addCase(createDevItem.fulfilled, (s, a) => {
      s.items = [a.payload, ...s.items];
    });

    b.addCase(updateDevItem.fulfilled, (s, a) => {
      s.items = s.items.map((it) =>
        it.id === a.payload.id ? { ...it, ...a.payload.data } : it
      );
    });

    b.addCase(deleteDevItem.fulfilled, (s, a) => {
      s.items = s.items.filter((it) => it.id !== a.payload.id);
    });
  },
});

export default devBoardSlice.reducer;
