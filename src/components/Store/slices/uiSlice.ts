import { createSlice } from "@reduxjs/toolkit";

type UiState = {
  pendingCount: number;
};

const initialState: UiState = {
  pendingCount: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    pendingInc(state) {
      state.pendingCount += 1;
    },
    pendingDec(state) {
      state.pendingCount = Math.max(0, state.pendingCount - 1);
    },
    pendingReset(state) {
      state.pendingCount = 0;
    },
  },
});

export const { pendingInc, pendingDec, pendingReset } = uiSlice.actions;

// ✅ Alias “semantici” (così non ti confondi più nei componenti)
export const beginGlobalLoading = pendingInc;
export const endGlobalLoading = pendingDec;
export const resetGlobalLoading = pendingReset;

export default uiSlice.reducer;

// Selector
export const selectGlobalLoading = (s: any) => (s.ui?.pendingCount ?? 0) > 0;
export const selectPendingCount = (s: any) => s.ui?.pendingCount ?? 0;
