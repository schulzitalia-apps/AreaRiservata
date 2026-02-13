"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";

import type {
  DocumentItem,
  DocumentCategory,
} from "@/components/Store/models/documents";
import { platformConfig } from "@/config/platform.config";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchPublicDocuments } from "@/components/Store/slices/documentsSlice";

import {
  ResourceListBox,
  type Column,
} from "@/components/AtlasModuli/common/ResourceListBox";

type OptionTuple = [value: string, label: string];

export default function DocumentsPublicBox() {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.documents);

  // FILTRI
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | DocumentCategory>("all");

  // PAGINAZIONE
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // reset pagina quando cambiano i filtri
  useEffect(() => {
    setPage(1);
  }, [query, category]);

  // fetch SOLO pubblici
  useEffect(() => {
    dispatch(fetchPublicDocuments({ category }));
  }, [dispatch, category]);

  const loading = status === "loading" || status === "idle";

  const categoryOptions = useMemo<OptionTuple[]>(
    () => [
      ["all", "Tutte le categorie"],
      ...platformConfig.documentTypes.map((c) => [c, c] as OptionTuple),
    ],
    [],
  );

  // search + sort (client)
  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = !q
      ? items
      : items.filter((d) => {
        const hay = [
          d.title,
          d.summary ?? "",
          d.category,
          d.owner?.name ?? "",
          d.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });

    // esempio: ordina per updatedAt desc (più recenti sopra)
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return sorted;
  }, [items, query]);

  // paginazione (client)
  const total = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const columns: Column<DocumentItem>[] = [
    {
      id: "doc",
      header: "Documento",
      className: "col-span-8",
      isMain: true,
      render: (d) => (
        <>
          <div className="truncate font-semibold">{d.title || "Documento"}</div>

          <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
            {[d.category, d.type].filter(Boolean).join(" · ")}
          </div>

          {d.summary && (
            <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60 line-clamp-2">
              {d.summary}
            </div>
          )}

          {d.owner?.name && (
            <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
              Pubblicato da: {d.owner.name}
            </div>
          )}
        </>
      ),
    },
    {
      id: "date",
      header: "Aggiornato",
      className: "hidden xl:block col-span-2 text-xs",
      render: (d) => (
        <span>{new Date(d.updatedAt).toLocaleDateString("it-IT")}</span>
      ),
    },
  ];

  const toolbarRight = (
    <div className="w-64 text-sm">
      <Select
        value={category}
        onChange={(v) => setCategory(v as any)}
        options={categoryOptions}
        placeholder="Categoria"
      />
    </div>
  );

  return (
    <ResourceListBox<DocumentItem>
      title="Documenti pubblici"
      searchPlaceholder="Cerca documento…"
      query={query}
      setQuery={setQuery}
      loading={loading}
      items={pagedItems}
      emptyMessage="Nessun documento pubblico"
      columns={columns}
      getKey={(d) => d.id}
      toolbarRight={toolbarRight}
      actionsColumnClassName="md:col-span-4 xl:col-span-2 text-right"
      renderActions={(d) => (
        <div className="flex gap-2 justify-end">
          <a
            href={`/api/documents/${d.id}/view`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-stroke px-3 py-1.5 text-xs hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
          >
            Apri
          </a>

          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-stroke px-3 py-1.5 text-xs hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
            >
              Link
            </a>
          )}


        </div>
      )}
      page={safePage}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={total}
      onPageChange={setPage}
    />
  );
}
