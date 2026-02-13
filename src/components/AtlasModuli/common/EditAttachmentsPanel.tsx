// src/components/common/EditAttachmentsPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";

export type EditAttachment = {
  _id: string;
  type: string;
  uploadedAt: string | null;
  documentId: string;
  document?: { id: string; title?: string; category?: string } | null;
};

type UploadArgs = {
  file: File;
  attachmentType: string;
  title: string;
};

type Props = {
  /** Es: ["documento", "nota", "altro"] */
  documentTypes: readonly string[];
  /** Allegati già presenti */
  attachments: EditAttachment[];
  /** Se false → mostra messaggio "salva prima..." e disabilita upload */
  canUpload: boolean;
  /** Callback upload (si occupa di fare il dispatch giusto) */
  onUpload: (args: UploadArgs) => Promise<void> | void;
  /** Callback delete (dispatch + removeDocument true/false lo decidi fuori) */
  onDelete: (attachmentId: string) => Promise<void> | void;
};

export function EditAttachmentsPanel({
                                       documentTypes,
                                       attachments,
                                       canUpload,
                                       onUpload,
                                       onDelete,
                                     }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<string>(
    documentTypes[0] ?? "altro",
  );
  const [uploadTitle, setUploadTitle] = useState<string>("");

  const docTypeOptions = useMemo(
    () => documentTypes.map((t) => [t, t] as const),
    [documentTypes],
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload({
        file,
        attachmentType: uploadType,
        title: uploadTitle.trim() || file.name,
      });
      setUploadTitle("");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(
      "Eliminare questo allegato? Verrà rimosso anche il documento caricato.",
    );
    if (!ok) return;
    await onDelete(id);
  };

  /* -------------------- BOX 1: AGGIUNGI ALLEGATO (STILE ANAGRAFICA) -------------------- */

  return (
    <div className="space-y-4">
      <div className="rounded bg-white p-4 shadow dark:bg-gray-dark">
        <h3 className="mb-3 font-semibold">Aggiungi allegato</h3>

        {canUpload ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="text-sm">
                <Select
                  label="Tipo documento"
                  value={uploadType}
                  onChange={setUploadType}
                  options={docTypeOptions}
                  disabled={uploading}
                />
              </div>

              <label className="text-sm md:col-span-2">
                <div className="mb-1">Titolo documento</div>
                <input
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm dark:border-dark-3"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Es. Documento 2026"
                  disabled={uploading}
                />
              </label>

              <label className={`text-sm ${uploading ? "opacity-70" : ""}`}>
                <div className="mb-1">File</div>
                <span className="inline-flex cursor-pointer items-center gap-2 rounded border border-stroke px-3 py-2 text-sm dark:border-dark-3">
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void handleFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  {uploading ? "Caricamento…" : "Seleziona file…"}
                </span>
              </label>
            </div>

            {uploading && (
              <div className="mt-2 text-xs text-dark/70 dark:text-white/70">
                Sto caricando il documento…
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-dark/70 dark:text-white/70">
            Nessun allegato: salva prima l&apos;elemento per poter aggiungere
            documenti collegati.
          </div>
        )}
      </div>

      {/* -------------------- BOX 2: ALLEGATI ESISTENTI (STILE ANAGRAFICA) -------------------- */}
      <div className="rounded bg-white p-4 shadow dark:bg-gray-dark">
        <h3 className="mb-3 font-semibold">Allegati esistenti</h3>
        {attachments.length === 0 ? (
          <div className="text-sm text-dark/70 dark:text-white/70">
            Nessun allegato
          </div>
        ) : (
          <div className="rounded-lg border border-stroke dark:border-dark-3">
            <div className="grid grid-cols-12 gap-3 border-b border-stroke px-4 py-2 text-xs text-dark/70 dark:border-dark-3 dark:text-white/70">
              <div className="col-span-4">Titolo</div>
              <div className="col-span-3">Categoria</div>
              <div className="col-span-3">Tipo allegato</div>
              <div className="col-span-2 text-right">Azioni</div>
            </div>

            {attachments.map((a) => {
              const title = a.document?.title ?? `(doc ${a.documentId})`;
              const cat = a.document?.category ?? "altro";
              const href = `/api/documents/${a.documentId}/view`;

              return (
                <div
                  key={a._id}
                  className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-gray-2/60 dark:hover:bg-dark-2/60"
                >
                  <div className="col-span-4 truncate">
                    <a
                      className="text-primary underline"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {title}
                    </a>
                  </div>
                  <div className="col-span-3 truncate text-sm">{cat}</div>
                  <div className="col-span-3 truncate text-sm">{a.type}</div>
                  <div className="col-span-2 flex justify-end gap-3">
                    <a
                      className="text-primary underline"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                    <button
                      className="text-red-500 underline"
                      onClick={() => void handleDelete(a._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
