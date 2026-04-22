"use client";

import {
  createAsyncThunk,
  createSlice,
  isAnyOf,
  type PayloadAction,
} from "@reduxjs/toolkit";

import {
  listAule,
} from "@/components/Store/services/auleService";

import type { RootState } from "@/components/Store";
import type { SprintTimelineBoardData } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import { SPRINT_AULA_TYPE } from "@/components/AtlasModuli/SprintTimeline/constants";
import { loadSingleSprintBoard } from "@/components/AtlasModuli/SprintTimeline/joins/loadBoard";
import {
  createSprintTimelineEvent,
  createSprintTimelineQuickTask,
  createSprintTimelineSprint,
  createSprintTimelineTask,
  blockSprintTimelineCheckpoint,
  completeSprintTimelineCheckpoint,
  configureSprintTimelineValidation,
  decideSprintTimelineValidation,
  deleteSprintTimelineEvent,
  manualReopenSprintTimelineTask,
  promoteSprintTimelineTask,
  resolveSprintTimelineCheckpointBlock,
  resolveSprintTimelineTaskBlock,
  startSprintTimelineTask,
  toggleSprintTimelineChecklistItem,
  updateSprintTimelineTask,
  deleteSprintTimelineTask,
  completeCheckpointAndRequestValidationThunk,
} from "@/components/AtlasModuli/SprintTimeline/mutations/writeThunks";

/* -------------------------------------------------------------------------- */
/* Stato                                                                      */
/* -------------------------------------------------------------------------- */

export type SprintTimelineBucket = {
  status: "idle" | "loading" | "succeeded" | "failed";
  saveStatus: "idle" | "saving" | "succeeded" | "failed";
  board: SprintTimelineBoardData | null;
  error: string | null;
  dirty: boolean;
  lastLoadedAt?: string | null;
  lastSavedAt?: string | null;
};

export type SprintTimelineState = {
  bySprintId: Record<string, SprintTimelineBucket>;
  sprintIds: string[];
  allStatus: "idle" | "loading" | "succeeded" | "failed";
  allError: string | null;
};

const EMPTY_BUCKET: SprintTimelineBucket = {
  status: "idle",
  saveStatus: "idle",
  board: null,
  error: null,
  dirty: false,
  lastLoadedAt: null,
  lastSavedAt: null,
};

const createEmptyBucket = (): SprintTimelineBucket => ({
  status: "idle",
  saveStatus: "idle",
  board: null,
  error: null,
  dirty: false,
  lastLoadedAt: null,
  lastSavedAt: null,
});

const initialState: SprintTimelineState = {
  bySprintId: {},
  sprintIds: [],
  allStatus: "idle",
  allError: null,
};

function ensureBucket(
  state: SprintTimelineState,
  sprintId: string,
): SprintTimelineBucket {
  if (!state.bySprintId[sprintId]) {
    state.bySprintId[sprintId] = createEmptyBucket();
  }
  return state.bySprintId[sprintId];
}

/* -------------------------------------------------------------------------- */
/* Thunks fetch                                                               */
/* -------------------------------------------------------------------------- */

export const fetchSprintTimelineBoard = createAsyncThunk<
  { sprintId: string; board: SprintTimelineBoardData },
  { sprintId: string }
>("sprintTimeline/fetchBoard", async ({ sprintId }) => {
  const board = await loadSingleSprintBoard(sprintId);
  return { sprintId, board };
});

export const fetchAllSprintTimelineBoards = createAsyncThunk<
  {
    items: { sprintId: string; board: SprintTimelineBoardData }[];
    failures: { sprintId: string; error: string }[];
  },
  void
>("sprintTimeline/fetchAllBoards", async () => {
  const res = await listAule({
    type: SPRINT_AULA_TYPE,
    page: 1,
    pageSize: 200,
  });

  const settled = await Promise.all(
    (res.items ?? []).map(async (item) => {
      try {
        const board = await loadSingleSprintBoard(item.id);
        return {
          ok: true as const,
          sprintId: item.id,
          board,
        };
      } catch (error: any) {
        return {
          ok: false as const,
          sprintId: item.id,
          error: error?.message || "Errore caricando la sprint",
        };
      }
    }),
  );

  const items: { sprintId: string; board: SprintTimelineBoardData }[] = [];
  const failures: { sprintId: string; error: string }[] = [];

  for (const entry of settled) {
    if (entry.ok) {
      items.push({
        sprintId: entry.sprintId,
        board: entry.board,
      });
    } else {
      failures.push({
        sprintId: entry.sprintId,
        error: entry.error,
      });
    }
  }

  return { items, failures };
});

/* -------------------------------------------------------------------------- */
/* Slice                                                                      */
/* -------------------------------------------------------------------------- */

const sprintTimelineSlice = createSlice({
  name: "sprintTimeline",
  initialState,
  reducers: {
    replaceSprintTimelineBoardLocal(
      state,
      action: PayloadAction<{ sprintId: string; board: SprintTimelineBoardData }>,
    ) {
      const bucket = ensureBucket(state, action.payload.sprintId);
      bucket.board = action.payload.board;
      bucket.dirty = true;
      bucket.error = null;
      bucket.status = "succeeded";

      if (!state.sprintIds.includes(action.payload.sprintId)) {
        state.sprintIds.push(action.payload.sprintId);
      }
    },

    markSprintTimelineSaving(
      state,
      action: PayloadAction<{ sprintId: string }>,
    ) {
      const bucket = ensureBucket(state, action.payload.sprintId);
      bucket.saveStatus = "saving";
      bucket.error = null;
    },

    markSprintTimelineSaved(
      state,
      action: PayloadAction<{ sprintId: string }>,
    ) {
      const bucket = ensureBucket(state, action.payload.sprintId);
      bucket.saveStatus = "succeeded";
      bucket.dirty = false;
      bucket.lastSavedAt = new Date().toISOString();
    },

    markSprintTimelineSaveFailed(
      state,
      action: PayloadAction<{ sprintId: string; error: string }>,
    ) {
      const bucket = ensureBucket(state, action.payload.sprintId);
      bucket.saveStatus = "failed";
      bucket.error = action.payload.error;
    },

    clearSprintTimelineError(
      state,
      action: PayloadAction<{ sprintId: string }>,
    ) {
      const bucket = ensureBucket(state, action.payload.sprintId);
      bucket.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSprintTimelineBoard.pending, (state, action) => {
        const bucket = ensureBucket(state, action.meta.arg.sprintId);
        bucket.status = "loading";
        bucket.error = null;
      })
      .addCase(fetchSprintTimelineBoard.fulfilled, (state, action) => {
        const bucket = ensureBucket(state, action.payload.sprintId);
        bucket.status = "succeeded";
        bucket.board = action.payload.board;
        bucket.error = null;
        bucket.dirty = false;
        bucket.lastLoadedAt = new Date().toISOString();

        if (!state.sprintIds.includes(action.payload.sprintId)) {
          state.sprintIds.push(action.payload.sprintId);
        }
      })
      .addCase(fetchSprintTimelineBoard.rejected, (state, action) => {
        const bucket = ensureBucket(state, action.meta.arg.sprintId);
        bucket.status = "failed";
        bucket.error =
          action.error.message || "Errore nel caricamento della sprint timeline";
      })

      .addCase(fetchAllSprintTimelineBoards.pending, (state) => {
        state.allStatus = "loading";
        state.allError = null;
      })
      .addCase(fetchAllSprintTimelineBoards.fulfilled, (state, action) => {
        state.allStatus = "succeeded";
        state.allError =
          action.payload.failures.length > 0
            ? `${action.payload.failures.length} sprint non caricate`
            : null;

        state.sprintIds = action.payload.items.map((item) => item.sprintId);

        for (const item of action.payload.items) {
          const bucket = ensureBucket(state, item.sprintId);
          bucket.status = "succeeded";
          bucket.board = item.board;
          bucket.error = null;
          bucket.dirty = false;
          bucket.lastLoadedAt = new Date().toISOString();
        }
      })
      .addCase(fetchAllSprintTimelineBoards.rejected, (state, action) => {
        state.allStatus = "failed";
        state.allError =
          action.error.message || "Errore nel caricamento delle sprint timeline";
      })

      .addCase(createSprintTimelineSprint.pending, (state) => {
        state.allStatus = "loading";
        state.allError = null;
      })
      .addCase(createSprintTimelineSprint.rejected, (state, action) => {
        state.allStatus = "failed";
        state.allError =
          action.error.message || "Errore nella creazione dello sprint";
      })

      .addMatcher(
        isAnyOf(
          createSprintTimelineQuickTask.pending,
          createSprintTimelineTask.pending,
          promoteSprintTimelineTask.pending,
          createSprintTimelineEvent.pending,
          deleteSprintTimelineEvent.pending,
          startSprintTimelineTask.pending,
          toggleSprintTimelineChecklistItem.pending,
          completeSprintTimelineCheckpoint.pending,
          blockSprintTimelineCheckpoint.pending,
          resolveSprintTimelineCheckpointBlock.pending,
          configureSprintTimelineValidation.pending,
          decideSprintTimelineValidation.pending,
          resolveSprintTimelineTaskBlock.pending,
          manualReopenSprintTimelineTask.pending,
          updateSprintTimelineTask.pending,
          deleteSprintTimelineTask.pending,
          completeCheckpointAndRequestValidationThunk.pending,
        ),
        (state, action) => {
          const sprintId = action.meta.arg.sprintId;
          const bucket = ensureBucket(state, sprintId);
          bucket.saveStatus = "saving";
          bucket.error = null;
        },
      )

      .addMatcher(
        isAnyOf(
          createSprintTimelineSprint.fulfilled,
          createSprintTimelineQuickTask.fulfilled,
          createSprintTimelineTask.fulfilled,
          promoteSprintTimelineTask.fulfilled,
          createSprintTimelineEvent.fulfilled,
          deleteSprintTimelineEvent.fulfilled,
          startSprintTimelineTask.fulfilled,
          toggleSprintTimelineChecklistItem.fulfilled,
          completeSprintTimelineCheckpoint.fulfilled,
          blockSprintTimelineCheckpoint.fulfilled,
          resolveSprintTimelineCheckpointBlock.fulfilled,
          configureSprintTimelineValidation.fulfilled,
          decideSprintTimelineValidation.fulfilled,
          resolveSprintTimelineTaskBlock.fulfilled,
          manualReopenSprintTimelineTask.fulfilled,
          updateSprintTimelineTask.fulfilled,
          deleteSprintTimelineTask.fulfilled,
          completeCheckpointAndRequestValidationThunk.fulfilled,
        ),
        (state, action) => {
          const { sprintId, board } = action.payload;
          const bucket = ensureBucket(state, sprintId);

          bucket.status = "succeeded";
          bucket.saveStatus = "succeeded";
          bucket.board = board;
          bucket.error = null;
          bucket.dirty = false;
          bucket.lastSavedAt = new Date().toISOString();
          bucket.lastLoadedAt = new Date().toISOString();

          if (!state.sprintIds.includes(sprintId)) {
            state.sprintIds.push(sprintId);
          }

          state.allStatus = "succeeded";
          state.allError = null;
        },
      )

      .addMatcher(
        isAnyOf(
          createSprintTimelineQuickTask.rejected,
          createSprintTimelineTask.rejected,
          promoteSprintTimelineTask.rejected,
          createSprintTimelineEvent.rejected,
          deleteSprintTimelineEvent.rejected,
          startSprintTimelineTask.rejected,
          toggleSprintTimelineChecklistItem.rejected,
          completeSprintTimelineCheckpoint.rejected,
          blockSprintTimelineCheckpoint.rejected,
          resolveSprintTimelineCheckpointBlock.rejected,
          configureSprintTimelineValidation.rejected,
          decideSprintTimelineValidation.rejected,
          resolveSprintTimelineTaskBlock.rejected,
          manualReopenSprintTimelineTask.rejected,
          updateSprintTimelineTask.rejected,
          deleteSprintTimelineTask.rejected,
          completeCheckpointAndRequestValidationThunk.rejected,
        ),
        (state, action) => {
          const sprintId = action.meta.arg.sprintId;
          const bucket = ensureBucket(state, sprintId);
          bucket.saveStatus = "failed";
          bucket.error = action.error.message || "Errore di salvataggio timeline";
        },
      );
  },
});

export const {
  replaceSprintTimelineBoardLocal,
  markSprintTimelineSaving,
  markSprintTimelineSaved,
  markSprintTimelineSaveFailed,
  clearSprintTimelineError,
} = sprintTimelineSlice.actions;

export default sprintTimelineSlice.reducer;

export {
  blockSprintTimelineCheckpoint,
  completeSprintTimelineCheckpoint,
  configureSprintTimelineValidation,
  createSprintTimelineEvent,
  createSprintTimelineQuickTask,
  createSprintTimelineSprint,
  createSprintTimelineTask,
  decideSprintTimelineValidation,
  deleteSprintTimelineEvent,
  manualReopenSprintTimelineTask,
  promoteSprintTimelineTask,
  resolveSprintTimelineCheckpointBlock,
  resolveSprintTimelineTaskBlock,
  startSprintTimelineTask,
  toggleSprintTimelineChecklistItem,
  updateSprintTimelineTask,
  deleteSprintTimelineTask,
  completeCheckpointAndRequestValidationThunk,
};

export type {
  SprintTimelineBlockCheckpointArgs,
  SprintTimelineCompleteCheckpointArgs,
  SprintTimelineConfigureValidationArgs,
  SprintTimelineCreateEventArgs,
  SprintTimelineCreateQuickTaskArgs,
  SprintTimelineCreateSprintArgs,
  SprintTimelineCreateTaskArgs,
  SprintTimelineDecideValidationArgs,
  SprintTimelineDeleteEventArgs,
  SprintTimelineManualReopenTaskArgs,
  SprintTimelinePromoteTaskArgs,
  SprintTimelineResolveCheckpointBlockArgs,
  SprintTimelineResolveTaskBlockArgs,
  SprintTimelineStartTaskArgs,
  SprintTimelineToggleChecklistArgs,
  SprintTimelineUpdateTaskArgs,
  SprintTimelineDeleteTaskArgs,
  SprintTimelineCompleteCheckpointAndRequestValidationArgs,
} from "@/components/AtlasModuli/SprintTimeline/mutations/types";

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectSprintTimelineBucket = (
  state: RootState,
  sprintId: string,
): SprintTimelineBucket =>
  state.sprintTimeline.bySprintId[sprintId] ?? EMPTY_BUCKET;

export const selectSprintTimelineBoard = (
  state: RootState,
  sprintId: string,
): SprintTimelineBoardData | null =>
  state.sprintTimeline.bySprintId[sprintId]?.board ?? null;

export const selectSprintTimelineDirty = (
  state: RootState,
  sprintId: string,
): boolean => state.sprintTimeline.bySprintId[sprintId]?.dirty ?? false;

export const selectSprintTimelineIds = (state: RootState): string[] =>
  state.sprintTimeline.sprintIds;

export const selectSprintTimelineById = (
  state: RootState,
): Record<string, SprintTimelineBucket> => state.sprintTimeline.bySprintId;

export const selectSprintTimelineAllStatus = (
  state: RootState,
): SprintTimelineState["allStatus"] => state.sprintTimeline.allStatus;

export const selectSprintTimelineAllError = (
  state: RootState,
): string | null => state.sprintTimeline.allError;
