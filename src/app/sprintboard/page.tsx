"use client";

import { useEffect, useMemo, useState } from "react";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { SprintTimelineScreen } from "@/components/AtlasModuli/SprintTimeline";
import type { SprintTimelineBoardData } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { sprintTimelineService } from "@/components/Store/services/sprintTimelineService";
import { fetchMyProfile } from "@/components/Store/slices/profileSlice";

type AggregateLoadState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  board: SprintTimelineBoardData | null;
  error: string | null;
  warnings: string[];
};

export default function SprintTimelinePage() {
  const dispatch = useAppDispatch();
  const [aggregateState, setAggregateState] = useState<AggregateLoadState>({
    status: "idle",
    board: null,
    error: null,
    warnings: [],
  });

  const profileStatus = useAppSelector((state) => state.profile.status);
  const profileFullName = useAppSelector((state) => state.profile.data?.fullName);
  const sessionUserId = useAppSelector((state) => state.session.user?.id);
  const sessionUserName = useAppSelector((state) => state.session.user?.name);
  const sessionStatus = useAppSelector((state) => state.session.status);

  const bySprintId = useAppSelector((state) => state.sprintTimeline.bySprintId);
  const latestSave = useMemo(() => {
    return Object.values(bySprintId)
      .map((b) => b.lastSavedAt)
      .filter(Boolean)
      .sort((a, b) => a!.localeCompare(b!))
      .pop();
  }, [bySprintId]);

  useEffect(() => {
    let active = true;

    setAggregateState((current) => ({
      ...current,
      status: "loading",
      error: null,
      warnings: [],
    }));

    void sprintTimelineService
      .getAggregateBoard()
      .then((result) => {
        if (!active) return;

        setAggregateState({
          status: "succeeded",
          board: result.aggregateBoard,
          error: null,
          warnings: (result.failures ?? []).map((failure) => failure.error),
        });
      })
      .catch(async (error) => {
        if (!active) return;

        setAggregateState({
          status: "failed",
          board: null,
          error:
            error instanceof Error
              ? error.message
              : "Errore caricamento sprint timeline",
          warnings: [],
        });
      });

    return () => {
      active = false;
    };
  }, [latestSave]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && profileStatus === "idle") {
      dispatch(fetchMyProfile());
    }
  }, [dispatch, sessionStatus, profileStatus]);

  const currentUserName = useMemo(() => {
    return profileFullName?.trim() || sessionUserName?.trim() || "";
  }, [profileFullName, sessionUserName]);

  const sessionUserRole = useAppSelector((state) => state.session.user?.role);
  const isSuperUser = sessionUserRole === "Super";

  return (
    <div className="w-full min-w-0 space-y-6 px-4 md:px-6 xl:px-8">
      <Breadcrumb pageName="Sprint timeline" />

      {aggregateState.status === "loading" && !aggregateState.board && (
        <div className="rounded-2xl border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          Caricamento sprint timeline...
        </div>
      )}

      {aggregateState.status === "failed" && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-700 dark:text-rose-300">
          {aggregateState.error || "Errore caricamento sprint timeline"}
        </div>
      )}

      {aggregateState.status === "succeeded" && !aggregateState.board && (
        <div className="rounded-2xl border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          Nessuno sprint disponibile.
        </div>
      )}

      {aggregateState.warnings.length && aggregateState.status === "succeeded" ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
          {aggregateState.warnings[0]}
          {aggregateState.warnings.length > 1
            ? ` (+${aggregateState.warnings.length - 1} altre sprint non caricate)`
            : ""}
        </div>
      ) : null}

      {aggregateState.board ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-stroke bg-white/40 p-2 dark:border-dark-3 dark:bg-gray-dark/20">
          <SprintTimelineScreen
            data={aggregateState.board}
            currentUserName={currentUserName}
            currentUserId={sessionUserId}
            isSuperUser={isSuperUser}
          />
        </div>
      ) : null}
    </div>
  );
}
