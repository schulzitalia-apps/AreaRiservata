import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppRole } from "@/types/roles";

export type SessionState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: {
    id?: string;
    email?: string | null;
    role?: AppRole;
    name?: string | null;
    image?: string | null;
  } | null;
};

const initialState: SessionState = { status: "loading", user: null };

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ status: SessionState["status"]; user: SessionState["user"] }>
    ) {
      state.status = action.payload.status;
      state.user = action.payload.user;
    },
    clearSession(state) {
      state.status = "unauthenticated";
      state.user = null;
    },
  },
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
