// src/app/(admin)/admin/documents/_components/documents-debug.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchDocumentsAdmin,
  deleteDocument,
  uploadDocument,
} from "@/components/Store/slices/documentsSlice";
import type { UploadDocumentPayload } from "@/components/Store/models/documents";
import { inferCategoryFromName } from "@/utils/doc-utils";
import { platformConfig, type DocumentCategory } from "@/config/platform.config";
import { cn } from "@/server-utils/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

type SimpleUser = { id: string; name: string; email?: string };
type AdminScope = "all" | "public" | "byOwner";
type UiDocumentCategory = "auto" | DocumentCategory;

function badgeTone(visibility?: string) {
  if (visibility === "public")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100";
  return "bg-slate-100 text-slate-800 dark:bg-dark-2 dark:text-white/90";
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function displayCategoryFromDoc(d: any) {
  const cat = safeText(d?.category);
  if (cat) return cat;

  const fromTitle = inferCategoryFromName(safeText(d?.title));
  if (fromTitle) return fromTitle;

  return "—";
}

export function DocumentsDebug() {
  const dispatch = useAppDispatch();
  const { items, status, uploading, error } = useAppSelector((s) => s.documents);

  const [scope, setScope] = useState<AdminScope>("all");
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");

  // toolbar filters (client)
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<UiDocumentCategory>("auto");

  // initial list
  useEffect(() => {
    if (status === "idle") {
      dispatch(
        fetchDocumentsAdmin({
          scope,
          ownerId: scope === "byOwner" ? ownerId : undefined,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // reload on scope/owner change
  useEffect(() => {
    dispatch(
      fetchDocumentsAdmin({
        scope,
        ownerId: scope === "byOwner" ? ownerId : undefined,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, ownerId]);

  // users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/admin/users/list", {
          cache: "no-store",
          credentials: "include",
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [query]);

  const suggested = useMemo(
    () => inferCategoryFromName(title || file?.name || ""),
    [title, file]
  );

  // ✅ Select "serio" options: tuple [value,label]
  const scopeOptions = useMemo(
    () =>
      [
        ["all", "All"],
        ["public", "Public"],
        ["byOwner", "By owner"],
      ] as const,
    []
  );

  const ownerOptions = useMemo(() => {
    return (users || []).map((u) => {
      const label = u.email ? `${u.name} (${u.email})` : u.name;
      return [u.id, label] as const;
    });
  }, [users]);

  const categoryOptions = useMemo(() => {
    const top: [string, string][] = [
      ["auto", `Auto (consigliato) — suggerito: ${suggested || "n/d"}`],
    ];
    const rest: [string, string][] = platformConfig.documentTypes.map((t) => [t, t]);
    return [...top, ...rest] as any;
  }, [suggested]);

  const visibility: "public" | "personal" = isPublic ? "public" : "personal";

  async function refreshList() {
    await dispatch(
      fetchDocumentsAdmin({
        scope,
        ownerId: scope === "byOwner" ? ownerId : undefined,
      })
    );
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const payload: UploadDocumentPayload = {
      file,
      title: title || file.name,
      visibility,
      summary: summary || null,
      ownerId: !isPublic && ownerId ? ownerId : null,
      category: category === "auto" ? undefined : (category as DocumentCategory),
    };

    await dispatch(uploadDocument(payload));
    setFile(null);
    setTitle("");
    setSummary("");
    setCategory("auto");
    setUploadOpen(false);

    await refreshList();
  }

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = Array.isArray(items) ? items : [];
    const filtered = !q
      ? base
      : base.filter((d: any) => {
        const hay = [
          d.title,
          d.summary ?? "",
          displayCategoryFromDoc(d),
          d.visibility,
          d.type,
          d.owner?.name ?? "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });

    return [...filtered].sort(
      (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [items, query]);

  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage]);

  const loading = status === "loading" || status === "idle";

  return (
    <ShowcaseSection title="Documents Debug (Admin)" className="!p-0">
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-stroke p-4 dark:border-dark-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-dark dark:text-white">
              Documents Debug (Admin)
            </h2>
            <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
              Vista admin per upload/list/delete con filtri scope.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              + Nuovo documento
            </button>

            <button
              type="button"
              onClick={refreshList}
              className="rounded-xl border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b border-stroke p-4 dark:border-dark-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-3 text-sm">
              <Select
                label="Scope"
                value={scope}
                onChange={(v) => setScope(v as AdminScope)}
                options={scopeOptions as any}
              />
            </div>

            <div
              className={cn(
                "md:col-span-4 text-sm",
                scope !== "byOwner" && "opacity-60 pointer-events-none"
              )}
            >
              <Select
                label="Owner"
                value={ownerId}
                onChange={setOwnerId}
                options={ownerOptions as any}
                disabled={scope !== "byOwner"}
                placeholder="Seleziona owner"
              />
            </div>

            <label className="md:col-span-5">
              <div className="mb-1 text-xs text-dark/70 dark:text-white/70">
                Cerca
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="titolo, categoria, owner, summary…"
                className={cn(
                  "w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary",
                  "dark:border-dark-3 dark:text-white"
                )}
              />
            </label>
          </div>

          {/* Pagination (client) */}
          <div className="mt-3 flex items-center justify-between text-xs text-dark/60 dark:text-white/60">
            <span>{loading ? "Caricamento…" : `${total} documenti`}</span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-stroke px-2 py-1 hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:hover:bg-dark-2"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ←
                </button>
                <span className="font-mono">
                  {safePage}/{totalPages}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-stroke px-2 py-1 hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:hover:bg-dark-2"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="p-4">
          {error ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-gray-2 dark:bg-dark-2"
                />
              ))}
            </div>
          ) : pagedItems.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-dark/70 dark:text-white/70">
              Nessun documento
            </div>
          ) : (
            <div className="space-y-3">
              {pagedItems.map((d: any) => {
                const ownerName = safeText(d?.owner?.name);
                const cat = displayCategoryFromDoc(d);

                return (
                  <div
                    key={d.id}
                    className={cn(
                      "rounded-2xl border border-stroke bg-white p-4 shadow-sm",
                      "hover:bg-primary/5",
                      "dark:border-dark-3 dark:bg-gray-dark dark:hover:bg-dark-2/60"
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-dark dark:text-white">
                            {d.title || "(senza titolo)"}
                          </div>

                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              badgeTone(d.visibility)
                            )}
                          >
                            {d.visibility || "—"}
                          </span>

                          <span className="rounded-full bg-gray-1 px-2 py-0.5 text-[11px] font-semibold text-dark/80 dark:bg-dark-2 dark:text-white/80">
                            cat: {cat}
                          </span>

                          {d.type ? (
                            <span className="rounded-full bg-gray-1 px-2 py-0.5 text-[11px] font-semibold text-dark/80 dark:bg-dark-2 dark:text-white/80">
                              {d.type}
                            </span>
                          ) : null}
                        </div>

                        {d.summary ? (
                          <div className="mt-1 line-clamp-2 text-xs text-dark/60 dark:text-white/60">
                            {d.summary}
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dark/60 dark:text-white/60">
                          <span className="font-mono">id: {d.id}</span>
                          {d.sizeKB != null ? <span>{d.sizeKB} KB</span> : null}
                          {d.updatedAt ? (
                            <span>
                              agg: {new Date(d.updatedAt).toLocaleString("it-IT")}
                            </span>
                          ) : null}
                          {ownerName ? <span>owner: {ownerName}</span> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 md:justify-end">
                        <a
                          href={`/api/documents/${d.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-stroke px-3 py-1.5 text-xs font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                        >
                          View
                        </a>

                        <button
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm("Eliminare questo documento?");
                            if (!ok) return;
                            await dispatch(deleteDocument({ id: d.id }));
                            await refreshList();
                          }}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:opacity-90 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => {
          if (!uploading) setUploadOpen(false);
        }}
        disableClose={uploading}
        title="Nuovo documento"
        subtitle="Carica un documento e scegli visibilità, owner e categoria."
        maxWidthClassName="max-w-3xl"
        zIndexClassName="z-[999]"
      >
        <form onSubmit={onUpload} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-dark dark:text-white">
              File
              <input
                type="file"
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className={cn(
                  "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm",
                  "dark:border-dark-3 dark:text-white"
                )}
              />
              {file ? (
                <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                  Selezionato: <span className="font-mono">{file.name}</span>
                </div>
              ) : null}
            </label>

            <label className="text-xs text-dark dark:text-white">
              Titolo
              <input
                className={cn(
                  "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary",
                  "dark:border-dark-3 dark:text-white"
                )}
                placeholder="Titolo (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
              <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                Se vuoto, userò il nome file.
              </div>
            </label>
          </div>

          <label className="text-xs text-dark dark:text-white">
            Summary
            <textarea
              className={cn(
                "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary",
                "dark:border-dark-3 dark:text-white"
              )}
              placeholder="Summary (2 righe)"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={uploading}
              rows={3}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="text-sm">
              <div className="mb-1 text-xs text-dark/70 dark:text-white/70">Visibilità</div>
              <div className="mt-1 flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    disabled={uploading}
                  />
                  <span className="text-dark dark:text-white">Public</span>
                </label>
                <span className="text-xs text-dark/60 dark:text-white/60">
                  {isPublic ? "public" : "personal"}
                </span>
              </div>
            </div>

            <div className={cn("text-sm", isPublic && "opacity-60 pointer-events-none")}>
              <Select
                label="Owner (solo personal)"
                value={ownerId}
                onChange={setOwnerId}
                options={ownerOptions as any}
                disabled={uploading || isPublic}
                placeholder="Seleziona owner"
              />
            </div>

            <div className="text-sm">
              <Select
                label="Categoria"
                value={category}
                onChange={(v) => setCategory(v as UiDocumentCategory)}
                options={categoryOptions as any}
                disabled={uploading}
                placeholder="Categoria"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
              className="rounded-xl border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={!file || uploading}
              className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
              {error}
            </div>
          ) : null}
        </form>
      </Modal>
    </ShowcaseSection>
  );
}
