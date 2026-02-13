// src/store/slices/calendarSlice.ts

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CalendarEvent, Scope } from "../models/calendar";
import { calendarService } from "../services/calendarService";

/* ------------------------------------ STATE --------------------------------- */

export type CalendarState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  events: CalendarEvent[];
  scope: Scope;
  month: string;  // YYYY-MM
  error?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

const now = new Date();
const yyyyMm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

const initialState: CalendarState = {
  status: "idle",
  events: [],
  scope: "private",
  month: yyyyMm,
  error: null,
};

/* --------------------------------- HELPERS ---------------------------------- */

function monthRange(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

/* ----------------------------------- THUNKS --------------------------------- */

export const fetchEvents = createAsyncThunk<
  CalendarEvent[],
  { month?: string; scope?: Scope } | undefined
>("calendar/fetchEvents", async (args = {}, thunkApi) => {
  const state = thunkApi.getState() as { calendar: CalendarState };
  const current = state.calendar;

  const mm = args.month || current.month;
  const sc = args.scope || current.scope;

  const r = monthRange(mm);

  const json = await calendarService.list({
    from: r.from,
    to: r.to,
    scope: sc,
  });

  return json.events;
});

export const createEvent = createAsyncThunk<
  CalendarEvent,
  {
    title: string;
    notes?: string;
    visibility: Scope;
    dateStart: string;
    dateEnd?: string;
    timeStart?: string;
    timeEnd?: string;
  }
>("calendar/createEvent", async (payload, thunkApi) => {
  const json = await calendarService.create(payload);
  await thunkApi.dispatch(fetchEvents({}));
  return json.event;
});

export const updateEvent = createAsyncThunk<
  CalendarEvent,
  {
    id: string;
    data: Partial<{
      title: string;
      notes: string;
      visibility: Scope;
      dateStart: string;
      dateEnd: string;
      timeStart: string;
      timeEnd: string;
    }>;
  }
>("calendar/updateEvent", async (payload, thunkApi) => {
  const json = await calendarService.update(payload);
  await thunkApi.dispatch(fetchEvents({}));
  return json.event;
});

export const deleteEvent = createAsyncThunk<string, { id: string }>(
  "calendar/deleteEvent",
  async ({ id }, thunkApi) => {
    await calendarService.remove(id);
    await thunkApi.dispatch(fetchEvents({}));
    return id;
  }
);

/* ------------------------------------ SLICE --------------------------------- */

const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    setMonth(state, action: PayloadAction<string>) {
      state.month = action.payload;
    },
    nextMonth(state) {
      const [y, m] = state.month.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      d.setMonth(d.getMonth() + 1);
      state.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    },
    prevMonth(state) {
      const [y, m] = state.month.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      d.setMonth(d.getMonth() - 1);
      state.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    },
    setScope(state, action: PayloadAction<Scope>) {
      state.scope = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchEvents.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchEvents.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.events = a.payload;
      })
      .addCase(fetchEvents.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Errore calendario";
      });
  },
});

export const { setMonth, nextMonth, prevMonth, setScope } =
  calendarSlice.actions;

export default calendarSlice.reducer;
