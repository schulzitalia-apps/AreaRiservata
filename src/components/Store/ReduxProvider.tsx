// src/store/ReduxProvider.tsx (dove hai già SyncSessionToRedux)
"use client";

import { Provider } from "react-redux";
import { makeStore } from "./index";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { setSession } from "@/components/Store/slices/sessionSlice";
import { useAppDispatch, useAppSelector } from "./hooks";
import { fetchMyProfile, clearProfile } from "@/components/Store/slices/profileSlice";
import GlobalLoadingOverlay from "@/components/ui/GlobalLoadingOverlay";


const store = makeStore();

function SyncSessionToRedux() {
  const { data, status } = useSession();
  useEffect(() => {
    store.dispatch(
      setSession({
        status: status as any,
        user: data?.user
          ? {
            id: (data.user as any).id,
            email: data.user.email,
            role: (data.user as any).role,
            name: data.user.name,
            image: data.user.image,
          }
          : null,
      })
    );
  }, [data, status]);
  return null;
}

// ✅ nuovo: appena autenticato, carica il profilo se ancora non caricato
function SyncProfileToRedux() {
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((s) => s.session.status);
  const profileStatus = useAppSelector((s) => s.profile.status);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "idle") {
      dispatch(fetchMyProfile());
    }
    if (authStatus === "unauthenticated") {
      dispatch(clearProfile());
    }
  }, [authStatus, profileStatus, dispatch]);


  return null;
}

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        <SyncSessionToRedux />
        <SyncProfileToRedux />
        <GlobalLoadingOverlay />
        {children}
      </Provider>
    </SessionProvider>
  );
}
