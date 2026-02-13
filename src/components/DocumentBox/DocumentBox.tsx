// src/components/DocumentBox/DocumentBox.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  type DocumentItem,
  type DocType,
  type DocumentCategory,
} from "@/components/Store/models/documents"
import {
  fetchAllForUser,
  fetchMyDocuments,
  fetchPublicDocuments,
} from "@/components/Store/slices/documentsSlice";
import Toolbar from "./Toolbar";
import ListItem from "./ListItem";
import GridItem from "./GridItem";

type Scope = "all" | "personal" | "public";
type GroupKey = DocType;
const ORDER: GroupKey[] = ["pdf", "image", "docx", "xlsx", "txt", "other"];

export type DocumentBoxProps = {
  initialView?: "grid" | "list";
  initialScope?: Scope;
  category?: "all" | DocumentCategory; // ⬅️ nuova prop
};

export default function DocumentBox({
                                      initialView = "list",
                                      initialScope = "all",
                                      category = "all",
                                    }: DocumentBoxProps) {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.documents);

  const [viewMode, setViewMode] = useState<"grid" | "list">(initialView);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocType>("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "size">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // fetch in base a scope + categoria
  useEffect(() => {
    if (scope === "all") dispatch(fetchAllForUser({ category }));
    else if (scope === "personal") dispatch(fetchMyDocuments({ category }));
    else dispatch(fetchPublicDocuments({ category }));
  }, [dispatch, scope, category]);

  const filteredSorted = useMemo(() => {
    let r = [...items];
    if (typeFilter !== "all") r = r.filter((d) => d.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((d) => d.title.toLowerCase().includes(q) || (d.summary ?? "").toLowerCase().includes(q));
    }
    r.sort((a, b) => {
      if (sortBy === "date") {
        const va = new Date(a.updatedAt).getTime();
        const vb = new Date(b.updatedAt).getTime();
        return sortDir === "asc" ? va - vb : vb - va;
      }
      if (sortBy === "size") return sortDir === "asc" ? a.sizeKB - b.sizeKB : b.sizeKB - a.sizeKB;
      return sortDir === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    });
    return r;
  }, [items, typeFilter, query, sortBy, sortDir]);

  const groups = useMemo(() => {
    const map = new Map<GroupKey, DocumentItem[]>();
    for (const k of ORDER) map.set(k, []);
    for (const doc of filteredSorted) map.get(doc.type)?.push(doc);
    return map;
  }, [filteredSorted]);

  const loading = status === "loading" || status === "idle";
  const total = filteredSorted.length;

  const refresh = () => {
    if (scope === "all") dispatch(fetchAllForUser({ category }));
    else if (scope === "personal") dispatch(fetchMyDocuments({ category }));
    else dispatch(fetchPublicDocuments({ category }));
  };

  return (
    <div className="w-full max-w-full rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        scope={scope}
        onScopeChange={setScope}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortBy={setSortBy}
        onSortDir={setSortDir}
        onRefresh={refresh}
      />

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-2 dark:bg-dark-2" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-dark dark:text-white">Vuoto</div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredSorted.map((d) => (
              <GridItem key={d.id} doc={d} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {ORDER.map((k) => {
              const arr = groups.get(k) || [];
              if (arr.length === 0) return null;
              return (
                <section key={k} className="space-y-2">
                  <h3 className="px-2 text-sm font-semibold capitalize text-dark dark:text-white">{k}</h3>
                  <div className="rounded-lg border border-stroke dark:border-dark-3">
                    <div className="grid grid-cols-12 gap-3 border-b border-stroke px-4 py-2 text-xs text-dark/70 dark:border-dark-3 dark:text-white/70">
                      <div className="col-span-6">Nome</div>
                      <div className="col-span-2">Visibilità</div>
                      <div className="col-span-2">Dim.</div>
                      <div className="col-span-2 text-right">Aggiornato</div>
                    </div>
                    {arr.map((d) => (
                      <ListItem key={d.id} doc={d} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
