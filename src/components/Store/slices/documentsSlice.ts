// src/store/slices/documentsSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DocumentItem,
  DocumentCategory,
  UploadDocumentPayload,
} from "../models/documents";
import { documentsService } from "../services/documentsService";

/** Stato slice */
export type DocumentsState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: DocumentItem[];
  error?: string | null;
  uploading: boolean;
};

const initialState: DocumentsState = {
  status: "idle",
  items: [],
  error: null,
  uploading: false,
};

/* ----------------------------------- THUNKS --------------------------------- */

/** SOLO MIE (privati + eventuali pubblici creati da me) con filtro categoria */
export const fetchMyDocuments = createAsyncThunk<
  DocumentItem[],
  { category?: "all" | DocumentCategory } | undefined
>("documents/fetchMyDocuments", async (arg) => {
  const json = await documentsService.listMine(arg?.category);
  return json.items;
});

/** Tutti i PUBBLICI, con filtro categoria */
export const fetchPublicDocuments = createAsyncThunk<
  DocumentItem[],
  { category?: "all" | DocumentCategory } | undefined
>("documents/fetchPublicDocuments", async (arg) => {
  const json = await documentsService.listPublic(arg?.category);
  return json.items;
});

/** “Mostra tutto” = miei + pubblici (merge per id), con filtro categoria */
export const fetchAllForUser = createAsyncThunk<
  DocumentItem[],
  { category?: "all" | DocumentCategory } | undefined
>("documents/fetchAllForUser", async (arg) => {
  const json = await documentsService.listAllForUser(arg?.category);
  return json.items;
});

/** ADMIN: lista custom (debugger admin) */
export const fetchDocumentsAdmin = createAsyncThunk<
  DocumentItem[],
  { scope?: "all" | "public" | "byOwner"; ownerId?: string } | undefined
>("documents/fetchDocumentsAdmin", async (params) => {
  const json = await documentsService.listAdmin(params ?? {});
  return json.items;
});

/** UPLOAD (invia anche la category selezionata) */
export const uploadDocument = createAsyncThunk<
  DocumentItem,
  UploadDocumentPayload
>("documents/uploadDocument", async (payload) => {
  const json = await documentsService.upload(payload);
  return json.document;
});

/** DELETE */
export const deleteDocument = createAsyncThunk<{ id: string }, { id: string }>(
  "documents/deleteDocument",
  async ({ id }) => {
    await documentsService.remove(id);
    return { id };
  }
);

/* ------------------------------------ SLICE --------------------------------- */

const documentsSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    clearDocuments(state) {
      state.status = "idle";
      state.items = [];
      state.error = null;
    },
    upsertOne(state, action: PayloadAction<DocumentItem>) {
      const idx = state.items.findIndex((x) => x.id === action.payload.id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
  },
  extraReducers: (b) => {
    // my
    b.addCase(fetchMyDocuments.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchMyDocuments.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload;
      })
      .addCase(fetchMyDocuments.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Errore";
      });

    // public
    b.addCase(fetchPublicDocuments.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchPublicDocuments.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload;
      })
      .addCase(fetchPublicDocuments.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Errore";
      });

    // all
    b.addCase(fetchAllForUser.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchAllForUser.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload;
      })
      .addCase(fetchAllForUser.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Errore";
      });

    // admin
    b.addCase(fetchDocumentsAdmin.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchDocumentsAdmin.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload;
      })
      .addCase(fetchDocumentsAdmin.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Errore";
      });

    // upload
    b.addCase(uploadDocument.pending, (s) => {
      s.uploading = true;
      s.error = null;
    })
      .addCase(uploadDocument.fulfilled, (s, a) => {
        s.uploading = false;
        s.items.unshift(a.payload);
      })
      .addCase(uploadDocument.rejected, (s, a) => {
        s.uploading = false;
        s.error = a.error.message || "Errore upload";
      });

    // delete
    b.addCase(deleteDocument.fulfilled, (s, a) => {
      s.items = s.items.filter((x) => x.id !== a.payload.id);
    });
  },
});

export const { clearDocuments, upsertOne } = documentsSlice.actions;
export default documentsSlice.reducer;
