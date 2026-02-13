// src/app/(admin)/admin/documents/_components/documents-debug.tsx
"use client";

import { useEffect, useState } from "react";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchDocumentsAdmin,
  deleteDocument,
  uploadDocument,
} from "@/components/Store/slices/documentsSlice";
import {type UploadDocumentPayload} from "@/components/Store/models/documents";
import { inferCategoryFromName } from "@/utils/doc-utils";
import { platformConfig, type DocumentCategory } from "@/config/platform.config";

type SimpleUser = { id: string; name: string; email?: string };
type AdminScope = "all" | "public" | "byOwner";

// Categoria usata nella UI: "auto" (scelta automatica) oppure una delle categorie reali da platformConfig
type UiDocumentCategory = "auto" | DocumentCategory;

export function DocumentsDebug() {
  const dispatch = useAppDispatch();
  const { items, status, uploading, error } = useAppSelector((s) => s.documents);

  const [scope, setScope] = useState<AdminScope>("all");
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [summary, setSummary] = useState("");

  const [category, setCategory] = useState<UiDocumentCategory>("auto");

  useEffect(() => {
    if (status === "idle") dispatch(fetchDocumentsAdmin({ scope }));
  }, [status, dispatch, scope]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/admin/users/list", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const list = (json.items as SimpleUser[]) || [];
        setUsers(list);
        if (list.length && !ownerId) setOwnerId(list[0].id);
      } catch (e) {
        console.error("[users/list] error", e);
      }
    };
    loadUsers();
  }, [ownerId]);

  const visibility: "public" | "personal" = isPublic ? "public" : "personal";
  const suggested = inferCategoryFromName(title || file?.name || "");

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const payload: UploadDocumentPayload = {
      file,
      title: title || file.name,
      visibility,
      summary: summary || null,
      ownerId: !isPublic && ownerId ? ownerId : null,
      // Se "auto" → lasciamo undefined (o null, in base a come è tipato UploadDocumentPayload)
      category: category === "auto" ? undefined : (category as DocumentCategory),
    };

    await dispatch(uploadDocument(payload));
    setFile(null);
    setTitle("");
    setSummary("");
    setCategory("auto");

    await dispatch(
      fetchDocumentsAdmin({
        scope,
        ownerId: scope === "byOwner" ? ownerId : undefined,
      }),
    );
  };

  return (
    <ShowcaseSection title="Documents Debug (Admin)" className="!p-7">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className="rounded border p-2"
          value={scope}
          onChange={(e) => setScope(e.target.value as AdminScope)}
        >
          <option value="all">All</option>
          <option value="public">Public</option>
          <option value="byOwner">By owner</option>
        </select>

        {scope === "byOwner" && (
          <select
            className="rounded border p-2"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.email ? `(${u.email})` : ""}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={() =>
            dispatch(
              fetchDocumentsAdmin({
                scope,
                ownerId: scope === "byOwner" ? ownerId : undefined,
              }),
            )
          }
        >
          Refresh
        </button>
      </div>

      <form onSubmit={onUpload} className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Public</label>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="text-xs opacity-70">{isPublic ? "public" : "personal"}</span>
        </div>

        {!isPublic && (
          <div className="flex gap-3 items-center">
            <label className="text-sm w-28">Owner</label>
            <select
              className="rounded border p-2 flex-1"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <input
          className="rounded border p-2"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="rounded border p-2"
          placeholder="Summary (2 righe)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />

        <div className="flex gap-3 items-center">
          <label className="text-sm w-28">Categoria</label>
          <select
            className="rounded border p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value as UiDocumentCategory)}
          >
            <option value="auto">Auto (consigliato) — suggerito: {suggested || "n/d"}</option>

            {platformConfig.documentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded border px-4 py-2"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch(
                fetchDocumentsAdmin({
                  scope,
                  ownerId: scope === "byOwner" ? ownerId : undefined,
                }),
              )
            }
            className="rounded border px-4 py-2"
          >
            Refresh
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      <div className="space-y-3">
        {status === "loading" && <p>Loading...</p>}
        {items.map((d) => (
          <div
            key={d.id}
            className="rounded border p-3 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{d.title}</div>
              <div className="text-xs opacity-70">
                {d.type} • {d.visibility} • {d.sizeKB} KB •{" "}
                {new Date(d.updatedAt).toLocaleString()} • cat:{" "}
                <strong>{d.category}</strong>{" "}
                {d.owner?.name ? (
                  <>
                    • owner: <strong>{d.owner.name}</strong>
                  </>
                ) : null}
              </div>
              {d.summary && <div className="text-sm mt-1">{d.summary}</div>}
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/documents/${d.id}/view`}
                target="_blank"
                className="underline"
              >
                View
              </a>
              <button
                onClick={async () => {
                  await dispatch(deleteDocument({ id: d.id }));
                  await dispatch(
                    fetchDocumentsAdmin({
                      scope,
                      ownerId: scope === "byOwner" ? ownerId : undefined,
                    }),
                  );
                }}
                className="text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </ShowcaseSection>
  );
}
