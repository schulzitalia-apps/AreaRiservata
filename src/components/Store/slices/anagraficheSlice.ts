// src/components/Store/slices/anagraficheSlice.ts

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  AnagraficaPreview,
  AnagraficaFull,
  AttachmentView,
  DocumentLight,
} from "../models/anagrafiche";
import { anagraficheService } from "../services/anagraficheService";

/* ------------------------------------ STATE --------------------------------- */

export type Bucket = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: AnagraficaPreview[];
  selected?: AnagraficaFull | null;
  error?: string | null;

  page: number;
  pageSize: number;
  total: number;

  /**
   * referenceValues[fieldKey][id] = previewLabel
   */
  referenceValues: Record<string, Record<string, string | null>>;
};

export type State = { byType: Record<string, Bucket> };

const initialState: State = { byType: {} };

const ensure = (s: State, type: string): Bucket =>
  (s.byType[type] ||= {
    status: "idle",
    items: [],
    selected: null,
    error: null,
    page: 1,
    pageSize: 25,
    total: 0,
    referenceValues: {},
  });

/* ----------------------------------- THUNKS --------------------------------- */

/** LIST */
export const fetchAnagrafiche = createAsyncThunk<
  {
    type: string;
    items: AnagraficaPreview[];
    total: number;
    page: number;
    pageSize: number;
  },
  {
    type: string;
    query?: string;
    docType?: string;
    visibilityRole?: string;
    page?: number;
    pageSize?: number;

    // NEW
    sortKey?: string;
    sortDir?: "asc" | "desc";
    fields?: string[];
  }
>("anagrafiche/fetchAll", async (args) => {
  const json = await anagraficheService.list(args);
  return {
    type: args.type,
    items: json.items,
    total: json.total,
    page: json.page,
    pageSize: json.pageSize,
  };
});

/**
 * Batch dei valori di un reference field.
 * type = tipo di anagrafica del BUCKET di destinazione (es. "clienti")
 */
export const fetchReferenceFieldValues = createAsyncThunk<
  {
    type: string;
    fieldKey: string;
    values: Record<string, string | null>;
  },
  {
    type: string;        // bucket target (es. "clienti")
    fieldKey: string;    // es. "codiceCliente"
    targetSlug: string;  // per la route /api/anagrafiche/<targetSlug>/field-values
    previewField?: string;
    ids: string[];
  }
>("anagrafiche/fetchReferenceFieldValues", async (args) => {
  const values = await anagraficheService.getFieldValues({
    targetSlug: args.targetSlug,
    field: args.previewField ?? "displayName",
    ids: args.ids,
  });

  return {
    type: args.type,
    fieldKey: args.fieldKey,
    values,
  };
});

/** DETAIL */
export const fetchAnagrafica = createAsyncThunk<
  { type: string; data: AnagraficaFull },
  { type: string; id: string }
>("anagrafiche/fetchOne", async (args) => {
  const data = await anagraficheService.getOne(args);
  return { type: args.type, data };
});

/** CREATE */
export const createAnagrafica = createAsyncThunk<
  { type: string; id: string },
  { type: string; payload: any }
>("anagrafiche/create", async (args) => {
  const out = await anagraficheService.create(args);
  return { type: args.type, id: out.id };
});

/** UPDATE */
export const updateAnagrafica = createAsyncThunk<
  { type: string; ok: true },
  { type: string; id: string; data: any }
>("anagrafiche/update", async (args) => {
  await anagraficheService.update(args);
  return { type: args.type, ok: true };
});

/** DELETE */
export const deleteAnagrafica = createAsyncThunk<
  { type: string; id: string },
  { type: string; id: string }
>("anagrafiche/delete", async (args) => {
  await anagraficheService.remove(args);
  return { type: args.type, id: args.id };
});

/** UPLOAD ATTACHMENT */
export const uploadAnagraficaAttachment = createAsyncThunk<
  { type: string; document: DocumentLight },
  { type: string; id: string; form: FormData }
>("anagrafiche/uploadAttachment", async (args) => {
  const out = await anagraficheService.uploadAttachment(args);
  return { type: args.type, document: out.document };
});

/** DELETE ATTACHMENT */
export const deleteAnagraficaAttachment = createAsyncThunk<
  {
    type: string;
    ok: true;
    attachmentId: string;
    documentId?: string;
    typeLabel?: string;
  },
  { type: string; id: string; attachmentId: string; removeDocument?: boolean }
>("anagrafiche/deleteAttachment", async (args) => {
  const out = await anagraficheService.deleteAttachment(args);
  return {
    type: args.type,
    ok: true,
    attachmentId: args.attachmentId,
    documentId: out.removedAttachment?.documentId,
    typeLabel: out.removedAttachment?.type,
  };
});

/* ------------------------------------ SLICE --------------------------------- */

const slice = createSlice({
  name: "anagrafiche",
  initialState,
  reducers: {
    clearSelected(s, a: { payload: { type: string } }) {
      ensure(s, a.payload.type).selected = null;
    },
  },
  extraReducers: (b) => {
    /** LIST */
    b.addCase(fetchAnagrafiche.pending, (s, a) => {
      const bucket = ensure(s, a.meta.arg.type);
      bucket.status = "loading";
      bucket.error = null;
    })
      .addCase(fetchAnagrafiche.fulfilled, (s, a) => {
        const bucket = ensure(s, a.payload.type);
        bucket.status = "succeeded";
        bucket.items = a.payload.items;
        bucket.total = a.payload.total;
        bucket.page = a.payload.page;
        bucket.pageSize = a.payload.pageSize;
      })
      .addCase(fetchAnagrafiche.rejected, (s, a) => {
        const bucket = ensure(s, a.meta.arg.type);
        bucket.status = "failed";
        bucket.error = a.error.message || "Errore";
      });

    /** REFERENCE VALUES */
    b.addCase(fetchReferenceFieldValues.fulfilled, (s, a) => {
      const { type, fieldKey, values } = a.payload;
      const bucket = ensure(s, type);

      if (!bucket.referenceValues[fieldKey]) {
        bucket.referenceValues[fieldKey] = {};
      }

      bucket.referenceValues[fieldKey] = {
        ...bucket.referenceValues[fieldKey],
        ...values,
      };
    });

    /** DETAIL */
    b.addCase(fetchAnagrafica.fulfilled, (s, a) => {
      const bucket = ensure(s, a.payload.type);
      bucket.selected = a.payload.data;
    });

    /** DELETE */
    b.addCase(deleteAnagrafica.fulfilled, (s, a) => {
      const bucket = ensure(s, a.payload.type);
      bucket.items = bucket.items.filter((x) => x.id !== a.payload.id);
      if (bucket.selected?.id === a.payload.id) bucket.selected = null;
    });

    /** UPLOAD ATTACHMENT */
    b.addCase(uploadAnagraficaAttachment.fulfilled, (s, a) => {
      const sel = ensure(s, a.payload.type).selected;
      if (!sel) return;

      const nowIso = new Date().toISOString();
      const newAtt: AttachmentView = {
        _id: `temp:${a.payload.document.id}`,
        type: "altro",
        uploadedAt: nowIso,
        documentId: a.payload.document.id,
        document: a.payload.document,
      };

      sel.attachments = [newAtt, ...(sel.attachments || [])];
    });

    /** DELETE ATTACHMENT */
    b.addCase(deleteAnagraficaAttachment.fulfilled, (s, a) => {
      const sel = ensure(s, a.payload.type).selected;
      if (!sel) return;

      sel.attachments = (sel.attachments || []).filter(
        (x) =>
          x._id !== a.payload.attachmentId &&
          x.documentId !== a.payload.documentId,
      );
    });
  },
});

export const { clearSelected } = slice.actions;
export default slice.reducer;
