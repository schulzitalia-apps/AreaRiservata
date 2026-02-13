// src/components/Store/store.ts (o dove ce l'hai)

import { configureStore } from "@reduxjs/toolkit";

import sessionReducer from "@/components/Store/slices/sessionSlice";
import profileReducer from "@/components/Store/slices/profileSlice";
import calendarSlice from "@/components/Store/slices/calendarSlice";
import documentsReducer from "@/components/Store/slices/documentsSlice";
import anagraficheReducer from "@/components/Store/slices/anagraficheSlice";
import devBoardReducer from "@/components/Store/slices/devBoardSlice";
import auleReducer from "@/components/Store/slices/auleSlice";
import eventiReducer from "@/components/Store/slices/eventiSlice";
import azioniReducer from "@/components/Store/slices/azioniSlice";
import notificheReducer from "@/components/Store/slices/notificheSlice";
import statsReducer from "./slices/statsSlice";
import financialsReducer from "@/components/Store/slices/financialsSlice";

// ✅ NEW: ui slice
import uiReducer, { pendingInc, pendingDec } from "@/components/Store/slices/uiSlice";

/**
 * ✅ Middleware globale:
 * conta tutte le RTK thunk (createAsyncThunk) in pending/fulfilled/rejected
 */
const loadingMiddleware =
  (storeAPI: any) => (next: any) => (action: any) => {
    const type = action?.type as string | undefined;

    if (type?.endsWith("/pending")) {
      storeAPI.dispatch(pendingInc());
    } else if (type?.endsWith("/fulfilled") || type?.endsWith("/rejected")) {
      storeAPI.dispatch(pendingDec());
    }

    return next(action);
  };

export const makeStore = () =>
  configureStore({
    reducer: {
      session: sessionReducer,
      profile: profileReducer,
      calendar: calendarSlice,
      documents: documentsReducer,
      anagrafiche: anagraficheReducer,
      devBoard: devBoardReducer,
      aule: auleReducer,
      eventi: eventiReducer,
      azioni: azioniReducer,
      notifiche: notificheReducer,
      stats: statsReducer,
      financials: financialsReducer,

      // ✅ NEW
      ui: uiReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(loadingMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
