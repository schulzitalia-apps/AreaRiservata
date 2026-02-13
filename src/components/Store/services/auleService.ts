// src/store/services/auleService.ts

import {
  AulaPreview,
  AulaDetail,
  AulaPartecipanteDetail,
  DocumentLight,
} from "../models/aule";

export type ListAuleArgs = {
  type: string;
  query?: string;
  docType?: string;
  visibilityRole?: string;
  page?: number;
  pageSize?: number;
};

export type ListAuleResponse = {
  items: AulaPreview[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listAule({
                                 type,
                                 query,
                                 docType,
                                 visibilityRole,
                                 page,
                                 pageSize,
                               }: ListAuleArgs): Promise<ListAuleResponse> {
  const qs = new URLSearchParams();
  if (query) qs.set("query", query);
  if (docType) qs.set("docType", docType);
  if (visibilityRole) qs.set("visibilityRole", visibilityRole);
  if (page) qs.set("page", String(page));
  if (pageSize) qs.set("pageSize", String(pageSize));

  const res = await fetch(`/api/aule/${type}?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();

  const items = (json.items ?? []) as AulaPreview[];
  const total = Number(json.total ?? items.length);
  const effectivePage = Number(json.page ?? page ?? 1);
  const effectivePageSize = Number(json.pageSize ?? pageSize ?? items.length);

  return {
    items,
    total,
    page: effectivePage,
    pageSize: effectivePageSize,
  };
}

export async function getAulaDetail(args: {
  type: string;
  id: string;
}): Promise<AulaDetail> {
  const { type, id } = args;
  const res = await fetch(`/api/aule/${type}/${id}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.aula as AulaDetail;
}

export type SaveAulaArgs = {
  type: string;
  id?: string;
  campi: Record<string, any>;
  partecipanti?: AulaPartecipanteDetail[];
  visibilityRole?: string | null;
};

export async function saveAulaApi({
                                    type,
                                    id,
                                    campi,
                                    partecipanti = [],
                                    visibilityRole,
                                  }: SaveAulaArgs): Promise<AulaDetail> {
  const body = JSON.stringify({ campi, partecipanti, visibilityRole });

  const url = id ? `/api/aule/${type}/${id}` : `/api/aule/${type}`;
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "include",
  });

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.aula as AulaDetail;
}

export async function deleteAulaApi(args: {
  type: string;
  id: string;
}): Promise<void> {
  const { type, id } = args;
  const res = await fetch(`/api/aule/${type}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function uploadAulaAttachmentApi(args: {
  type: string;
  id: string;
  form: FormData;
}): Promise<DocumentLight> {
  const { type, id, form } = args;
  const res = await fetch(`/api/aule/${type}/${id}/upload`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.document as DocumentLight;
}

export async function deleteAulaAttachmentApi(args: {
  type: string;
  id: string;
  attachmentId: string;
  removeDocument?: boolean;
}): Promise<{ attachmentId: string; documentId?: string; typeLabel?: string }> {
  const { type, id, attachmentId, removeDocument } = args;
  const qs = new URLSearchParams();
  if (removeDocument) qs.set("removeDocument", "1");

  const res = await fetch(
    `/api/aule/${type}/${id}/attachments/${attachmentId}?${qs.toString()}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const removed = json.removedAttachment as {
    id: string;
    documentId?: string;
    type?: string;
  };

  return {
    attachmentId: removed.id,
    documentId: removed.documentId,
    typeLabel: removed.type,
  };
}
