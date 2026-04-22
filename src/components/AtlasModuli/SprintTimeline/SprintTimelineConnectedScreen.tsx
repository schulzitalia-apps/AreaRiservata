"use client";

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchSprintTimelineBoard,
  replaceSprintTimelineBoardLocal,
  selectSprintTimelineBucket,
} from "@/components/Store/slices/sprintTimelineSlice";
import { SprintTimelineScreen } from "@/components/AtlasModuli/SprintTimeline/SprintTimelineScreen";

export function SprintTimelineConnectedScreen({
                                                sprintId,
                                                currentUserName,
                                                currentUserId,
                                              }: {
  sprintId: string;
  currentUserName?: string;
  currentUserId?: string;
}) {
  const dispatch = useAppDispatch();
  const bucket = useAppSelector((state) =>
    selectSprintTimelineBucket(state, sprintId),
  );

  useEffect(() => {
    dispatch(fetchSprintTimelineBoard({ sprintId }));
  }, [dispatch, sprintId]);

  if (bucket.status === "loading" && !bucket.board) {
    return <div>Caricamento timeline...</div>;
  }

  if (bucket.status === "failed") {
    return <div>Errore: {bucket.error || "Errore sconosciuto"}</div>;
  }

  if (!bucket.board) {
    return <div>Nessuna board disponibile.</div>;
  }

  return (
    <SprintTimelineScreen
      data={bucket.board}
      currentUserName={currentUserName}
      currentUserId={currentUserId}
      onDataChange={(next) =>
        dispatch(replaceSprintTimelineBoardLocal({ sprintId, board: next }))
      }
    />
  );
}
