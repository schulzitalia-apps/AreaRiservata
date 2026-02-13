// Store/slices/eventiSlice.ts

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  EventoPreview,
  EventoFull,
  AttachmentView,
  DocumentLight,
} from "../models/eventi";
import { eventiService } from "../services/eventiService";

/* ------------------------------------ STATE --------------------------------- */

export type Bucket = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: EventoPreview[];
  selected?: EventoFull | null;
  error?: string | null;
  total: number;
};

export type State = { byType: Record<string, Bucket> };

const initialState: State = { byType: {} };

const ensure = (s: State, type: string): Bucket =>
  (s.byType[type] ||= {
    status: "idle",
    items: [],
    selected: null,
    error: null,
    total: 0,
  });

/* ----------------------------------- THUNKS --------------------------------- */

/** LIST */
export const fetchEventi = createAsyncThunk<
  {
    type: string;
    items: EventoPreview[];
    total: number;
    page: number;
    pageSize: number;
  },
  {
    type: string;
    query?: string;
    visibilityRole?: string;
    timeFrom?: string;
    timeTo?: string;
    anagraficaType?: string;
    anagraficaId?: string;
    gruppoType?: string;
    gruppoId?: string;
    page?: number;
    pageSize?: number;
  }
>("eventi/fetchAll", async (args) => {
  const res = await eventiService.list(args);
  return {
    type: args.type,
    items: res.items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
});

/** DETAIL */
export const fetchEvento = createAsyncThunk<
  { type: string; data: EventoFull },
  { type: string; id: string }
>("eventi/fetchOne", async (args) => {
  const data = await eventiService.getOne(args);
  return { type: args.type, data };
});

/** CREATE */
export const createEvento = createAsyncThunk<
  { type: string; id: string },
  { type: string; payload: any }
>("eventi/create", async (args) => {
  const out = await eventiService.create(args);
  return { type: args.type, id: out.id };
});

/** UPDATE */
export const updateEvento = createAsyncThunk<
  { type: string; ok: true },
  { type: string; id: string; data: any }
>("eventi/update", async (args) => {
  await eventiService.update(args);
  return { type: args.type, ok: true };
});

/** DELETE */
export const deleteEvento = createAsyncThunk<
  { type: string; id: string },
  { type: string; id: string }
>("eventi/delete", async (args) => {
  await eventiService.remove(args);
  return { type: args.type, id: args.id };
});

/** UPLOAD ATTACHMENT */
export const uploadEventoAttachment = createAsyncThunk<
  { type: string; document: DocumentLight },
  { type: string; id: string; form: FormData }
>("eventi/uploadAttachment", async (args) => {
  const out = await eventiService.uploadAttachment(args);
  return { type: args.type, document: out.document };
});

/** DELETE ATTACHMENT */
export const deleteEventoAttachment = createAsyncThunk<
  {
    type: string;
    ok: true;
    attachmentId: string;
    documentId?: string;
    typeLabel?: string;
  },
  {
    type: string;
    id: string;
    attachmentId: string;
    removeDocument?: boolean;
  }
>("eventi/deleteAttachment", async (args) => {
  const out = await eventiService.deleteAttachment(args);
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
  name: "eventi",
  initialState,
  reducers: {
    clearSelected(s, a: { payload: { type: string } }) {
      ensure(s, a.payload.type).selected = null;
    },
  },
  extraReducers: (b) => {
    /** LIST */
    b.addCase(fetchEventi.pending, (s, a) => {
      const t = a.meta.arg.type;
      const bucket = ensure(s, t);
      bucket.status = "loading";
      bucket.error = null;
    })
      .addCase(fetchEventi.fulfilled, (s, a) => {
        const { type, items, total } = a.payload;
        const bucket = ensure(s, type);
        bucket.status = "succeeded";
        bucket.items = items;
        bucket.total = total;
      })
      .addCase(fetchEventi.rejected, (s, a) => {
        const t = a.meta.arg.type;
        const bucket = ensure(s, t);
        bucket.status = "failed";
        bucket.error = a.error.message || "Errore";
      });

    /** DETAIL */
    b.addCase(fetchEvento.fulfilled, (s, a) => {
      const { type, data } = a.payload;
      const bucket = ensure(s, type);
      bucket.selected = data;
    });

    /** DELETE */
    b.addCase(deleteEvento.fulfilled, (s, a) => {
      const { type, id } = a.payload;
      const bucket = ensure(s, type);
      bucket.items = bucket.items.filter((x) => x.id !== id);
      if (bucket.selected?.id === id) bucket.selected = null;
    });

    /** UPLOAD ATTACHMENT */
    b.addCase(uploadEventoAttachment.fulfilled, (s, a) => {
      const { type, document } = a.payload;
      const bucket = ensure(s, type);
      const sel = bucket.selected;
      if (!sel) return;

      const nowIso = new Date().toISOString();
      const newAtt: AttachmentView = {
        _id: `temp:${document.id}`,
        type: "altro",
        uploadedAt: nowIso,
        documentId: document.id,
        document,
      };

      const prev = Array.isArray(sel.attachments) ? sel.attachments : [];
      sel.attachments = [newAtt, ...prev];
    });

    /** DELETE ATTACHMENT */
    b.addCase(deleteEventoAttachment.fulfilled, (s, a) => {
      const { type, attachmentId, documentId } = a.payload;
      const sel = ensure(s, type).selected;
      if (!sel) return;
      const prev = Array.isArray(sel.attachments) ? sel.attachments : [];
      sel.attachments = prev.filter(
        (x) => x._id !== attachmentId && x.documentId !== documentId,
      );
    });
  },
});

export const { clearSelected } = slice.actions;
export default slice.reducer;
