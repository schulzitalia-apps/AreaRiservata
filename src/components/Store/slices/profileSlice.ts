// src/store/slices/profileSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ProfileData } from "../models/profile";
import { profileService } from "../services/profileService";

type ProfileState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  data: ProfileData | null;
  error?: string | null;
};

const initialState: ProfileState = {
  status: "idle",
  data: null,
  error: null,
};

/* ----------------------------------- THUNKS --------------------------------- */

export const fetchMyProfile = createAsyncThunk<ProfileData>(
  "profile/fetchMyProfile",
  async () => {
    return profileService.fetchMyProfile();
  }
);

// PATCH profilo
export const updateMyProfile = createAsyncThunk<
  ProfileData,
  { fullName?: string; phone?: string; bio?: string }
>("profile/updateMyProfile", async (payload) => {
  return profileService.updateMyProfile(payload);
});

/* ------------------------------------ SLICE --------------------------------- */

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    clearProfile(state) {
      state.status = "idle";
      state.data = null;
      state.error = null;
    },
    setProfile(state, action: PayloadAction<ProfileData>) {
      state.data = { ...(state.data ?? {}), ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // GET
      .addCase(fetchMyProfile.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchMyProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.data = action.payload;
      })
      .addCase(fetchMyProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Errore profilo";
      })

      // PATCH
      .addCase(updateMyProfile.pending, (state) => {
        state.error = null;
      })
      .addCase(updateMyProfile.fulfilled, (state, action) => {
        state.data = { ...(state.data ?? {}), ...action.payload };
      })
      .addCase(updateMyProfile.rejected, (state, action) => {
        state.error =
          action.error.message || "Errore aggiornamento profilo";
      });
  },
});

export const { clearProfile, setProfile } = profileSlice.actions;
export default profileSlice.reducer;
