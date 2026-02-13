// src/components/DocumentBox/Toolbar.tsx
"use client";

import { type DocType } from "@/components/Store/models/documents";
import { useId } from "react";

type Scope = "all" | "personal" | "public";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;

  scope: Scope;
  onScopeChange: (v: Scope) => void;

  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;

  typeFilter: "all" | DocType;
  onTypeChange: (v: "all" | DocType) => void;

  sortBy: "date" | "title" | "size";
  sortDir: "asc" | "desc";
  onSortBy: (v: "date" | "title" | "size") => void;
  onSortDir: (v: "asc" | "desc") => void;

  onRefresh: () => void;
};

export default function Toolbar({
                                  query,
                                  onQueryChange,
                                  scope,
                                  onScopeChange,
                                  viewMode,
                                  onViewModeChange,
                                  typeFilter,
                                  onTypeChange,
                                  sortBy,
                                  sortDir,
                                  onSortBy,
                                  onSortDir,
                                  onRefresh,
                                }: Props) {
  const searchId = useId();

  return (
    <div className="flex flex-col gap-3 border-b border-stroke p-4 dark:border-dark-3 md:flex-row md:items-center md:justify-between">
      {/* search */}
      <div className="relative w-full md:w-[28rem]">
        <input
          id={searchId}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cerca documenti…"
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
        />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* SCOPE */}
        <select
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:bg-gray-dark dark:text-white dark:border-dark-3"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as any)}
          title="Filtra: tutti, solo personali, solo pubblici"
        >
          <option value="all">Mostra tutto</option>
          <option value="personal">Solo personali</option>
          <option value="public">Solo pubblici</option>
        </select>

        {/* TYPE */}
        <select
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:bg-gray-dark dark:text-white dark:border-dark-3"
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value as any)}
        >
          <option value="all">Tutti i formati</option>
          <option value="pdf">PDF</option>
          <option value="image">Immagini</option>
          <option value="docx">DOCX</option>
          <option value="xlsx">XLSX</option>
          <option value="txt">TXT</option>
          <option value="other">Altro</option>
        </select>

        {/* SORT */}
        <select
          className="rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:bg-gray-dark dark:text-white dark:border-dark-3"
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [b, d] = e.target.value.split("-") as [any, any];
            onSortBy(b);
            onSortDir(d);
          }}
        >
          <option value="date-desc">Recenti</option>
          <option value="date-asc">Meno recenti</option>
          <option value="title-asc">Titolo A-Z</option>
          <option value="title-desc">Titolo Z-A</option>
          <option value="size-asc">Dimensione ↑</option>
          <option value="size-desc">Dimensione ↓</option>
        </select>

        {/* view toggle */}
        <div className="inline-flex overflow-hidden rounded-md border border-stroke dark:border-dark-3">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`px-3 py-2 text-sm ${
              viewMode === "grid" ? "bg-primary text-white" : "bg-transparent text-dark dark:text-white"
            }`}
            title="Vista griglia"
          >
            ⬚
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`px-3 py-2 text-sm ${
              viewMode === "list" ? "bg-primary text-white" : "bg-transparent text-dark dark:text-white"
            }`}
            title="Vista lista"
          >
            ≣
          </button>
        </div>

        <button onClick={onRefresh} className="rounded-md border border-stroke px-3 py-2 text-sm dark:border-dark-3">
          Refresh
        </button>
      </div>
    </div>
  );
}
