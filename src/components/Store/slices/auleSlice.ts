// src/store/slices/auleSlice.ts

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  AulaPreview,
  AulaDetail,
  AulaPartecipanteDetail,
  AuleState,
  AulaBucketState,
  AttachmentView,
} from "../models/aule";
import {
  listAule,
  getAulaDetail,
  saveAulaApi,
  deleteAulaApi,
  uploadAulaAttachmentApi,
  deleteAulaAttachmentApi,
} from "../services/auleService";

/* --------------------------------- STATE ----------------------------------- */

const initialBucket: AulaBucketState = {
  status: "idle",
  items: [],
  total: 0,
  error: null,
};

const initialState: AuleState = {
  byType: {},
  current: null,
  currentStatus: "idle",
  currentError: null,
};

/* ---------------------------------- THUNKS --------------------------------- */

// LISTA
export const fetchAuleByType = createAsyncThunk<
  { type: string; items: AulaPreview[]; total: number; page: number; pageSize: number },
  { type: string; query?: string; docType?: string; visibilityRole?: string; page?: number; pageSize?: number }
>("aule/fetchAuleByType", async ({ type, query, docType, visibilityRole, page = 1, pageSize = 25 }) => {
  const res = await listAule({ type, query, docType, visibilityRole, page, pageSize });
  return {
    type,
    items: res.items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
});

// DETTAGLIO
export const fetchAulaById = createAsyncThunk<
  AulaDetail,
  { type: string; id: string }
>("aule/fetchAulaById", async ({ type, id }) => {
  return await getAulaDetail({ type, id });
});

// CREATE/UPDATE (save)
export type SaveAulaPayload = {
  type: string;
  id?: string;
  campi: Record<string, any>;
  partecipanti?: AulaPartecipanteDetail[];
  visibilityRole?: string | null;
};

export const saveAula = createAsyncThunk<AulaDetail, SaveAulaPayload>(
  "aule/saveAula",
  async ({ type, id, campi, partecipanti, visibilityRole }) => {
    return await saveAulaApi({ type, id, campi, partecipanti, visibilityRole });
  },
);

// DELETE
export const deleteAula = createAsyncThunk<
  { type: string; id: string },
  { type: string; id: string }
>("aule/deleteAula", async ({ type, id }) => {
  await deleteAulaApi({ type, id });
  return { type, id };
});

// UPLOAD ATTACHMENT
export const uploadAulaAttachment = createAsyncThunk<
  { document: ReturnType<typeof Object>; type: string },
  { type: string; id: string; form: FormData; attachmentType?: string }
>("aule/uploadAttachment", async ({ type, id, form, attachmentType = "altro" }) => {
  const document = await uploadAulaAttachmentApi({ type, id, form });
  return { document, type: attachmentType };
});

// DELETE ATTACHMENT
export const deleteAulaAttachment = createAsyncThunk<
  { type: string; attachmentId: string; documentId?: string; typeLabel?: string },
  { type: string; id: string; attachmentId: string; removeDocument?: boolean }
>("aule/deleteAttachment", async ({ type, id, attachmentId, removeDocument }) => {
  const res = await deleteAulaAttachmentApi({ type, id, attachmentId, removeDocument });
  return { type, attachmentId: res.attachmentId, documentId: res.documentId, typeLabel: res.typeLabel };
});

/* ----------------------------------- SLICE --------------------------------- */

const auleSlice = createSlice({
  name: "aule",
  initialState,
  reducers: {
    clearAuleByType(state, action: PayloadAction<{ type: string }>) {
      delete state.byType[action.payload.type];
    },
    clearCurrentAula(state) {
      state.current = null;
      state.currentStatus = "idle";
      state.currentError = null;
    },
  },
  extraReducers: (b) => {
    // LISTA
    b.addCase(fetchAuleByType.pending, (s, a) => {
      const type = a.meta.arg.type;
      const bucket = (s.byType[type] ||= { ...initialBucket });
      bucket.status = "loading";
      bucket.error = null;
    })
      .addCase(fetchAuleByType.fulfilled, (s, a) => {
        const { type, items, total } = a.payload;
        const bucket = (s.byType[type] ||= { ...initialBucket });
        bucket.status = "succeeded";
        bucket.items = items;
        bucket.total = total;
      })
      .addCase(fetchAuleByType.rejected, (s, a) => {
        const type = a.meta.arg.type;
        const bucket = (s.byType[type] ||= { ...initialBucket });
        bucket.status = "failed";
        bucket.error =
          a.error.message || "Errore caricamento aule";
      });

    // DETTAGLIO
    b.addCase(fetchAulaById.pending, (s) => {
      s.currentStatus = "loading";
      s.currentError = null;
    })
      .addCase(fetchAulaById.fulfilled, (s, a) => {
        s.currentStatus = "succeeded";
        s.current = a.payload;
      })
      .addCase(fetchAulaById.rejected, (s, a) => {
        s.currentStatus = "failed";
        s.currentError =
          a.error.message || "Errore caricamento aula";
      });

    // SAVE
    b.addCase(saveAula.pending, (s) => {
      s.currentStatus = "loading";
      s.currentError = null;
    })
      .addCase(saveAula.fulfilled, (s, a) => {
        const aula = a.payload;
        s.currentStatus = "succeeded";
        s.current = aula;

        const type = aula.tipo;
        const bucket = (s.byType[type] ||= { ...initialBucket });

        const idx = bucket.items.findIndex((x) => x.id === aula.id);
        const preview: AulaPreview = {
          id: aula.id,
          tipo: aula.tipo,
          label: aula.label,
          anagraficaType: aula.anagraficaType,
          numeroPartecipanti:
            aula.numeroPartecipanti ??
            aula.partecipanti?.length ??
            0,
          ownerName: aula.ownerName,
          visibilityRole: aula.visibilityRole ?? null,
        };

        if (idx >= 0) bucket.items[idx] = preview;
        else bucket.items.unshift(preview);
      })
      .addCase(saveAula.rejected, (s, a) => {
        s.currentStatus = "failed";
        s.currentError =
          a.error.message || "Errore salvataggio aula";
      });

    // DELETE
    b.addCase(deleteAula.fulfilled, (s, a) => {
      const { type, id } = a.payload;
      const bucket = s.byType[type];
      if (!bucket) return;
      bucket.items = bucket.items.filter((x) => x.id !== id);
      if (s.current?.id === id) s.current = null;
    });

    // UPLOAD ATTACHMENT
    b.addCase(uploadAulaAttachment.fulfilled, (s, a) => {
      const aula = s.current;
      if (!aula) return;

      const { document, type } = a.payload as { document: any; type: string };
      const nowIso = new Date().toISOString();

      const newAtt: AttachmentView = {
        _id: `temp:${document.id}`,
        type: type || "altro",
        uploadedAt: nowIso,
        documentId: document.id,
        document,
      };

      const prev = Array.isArray(aula.attachments)
        ? aula.attachments
        : [];
      aula.attachments = [newAtt, ...prev];
    });

    // DELETE ATTACHMENT
    b.addCase(deleteAulaAttachment.fulfilled, (s, a) => {
      const aula = s.current;
      if (!aula) return;
      const { attachmentId, documentId } = a.payload;
      const prev = Array.isArray(aula.attachments)
        ? aula.attachments
        : [];
      aula.attachments = prev.filter(
        (x) =>
          x._id !== attachmentId && x.documentId !== documentId,
      );
    });
  },
});

export const { clearAuleByType, clearCurrentAula } = auleSlice.actions;
export default auleSlice.reducer;
