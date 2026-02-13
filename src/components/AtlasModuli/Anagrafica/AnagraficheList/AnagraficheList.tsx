// src/components/AtlasModuli/anagrafiche/AnagraficheList/AnagraficheList.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import {
  isReferenceField,
  type FieldKey,
  type FieldDef,
} from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

import { useCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";
import { useAppDispatch } from "@/components/Store/hooks";

import {
  useReferenceBatchPreviewMulti,
  type ReferenceBatchEntry,
} from "@/components/AtlasModuli/common/useReferenceBatchPreview";

import { useAnagraficheList, type AnagraficaFilters } from "../useAnagraficheList";
import { AnagraficheListToolbar } from "./AnagraficheListToolbar";
import { AnagraficheListTable } from "./AnagraficheListTable";

import {
  buildListFields,
  buildSortIndex,
  computeColumnKeys,
  formatFieldValue,
  resolveSlugConfig,
  type AnagraficheListConfig,
} from "./helpers";

function pickKeys<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

export default function AnagraficheList({
                                          type,
                                          config,
                                        }: {
  type: string;
  config: AnagraficheListConfig;
}) {
  const dispatch = useAppDispatch();
  const def = getAnagraficaDef(type);

  const { canView, canCreate, canEdit, canDelete } = useCrudPermissions(type as any);

  // ✅ config per slug (override)
  const cfg = useMemo(() => resolveSlugConfig(type, config), [type, config]);

  const mainCfg = cfg.main ?? {};
  const columnsCfg = cfg.columns ?? {};

  // ------------------------------
  // UI STATE
  // ------------------------------
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState<string>("");
  const [ownerOnly, setOwnerOnly] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const sortIndex = useMemo(() => buildSortIndex(def as any), [def]);
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => setPage(1), [query, docType, ownerOnly, sortKey, sortDir]);

  // ------------------------------
  // Title / Subtitle / SearchIn
  // ------------------------------
  const titleKeys: FieldKey[] = pickKeys(mainCfg.title ?? def.preview?.title);
  const subtitleKeys: FieldKey[] = pickKeys(mainCfg.subtitle ?? def.preview?.subtitle);
  const searchInKeys: FieldKey[] = pickKeys(def.preview?.searchIn);

  // ------------------------------
  // Columns dinamiche
  // ------------------------------
  const columnKeys: FieldKey[] = useMemo(() => {
    const mode = (columnsCfg.mode ?? "searchIn") as "searchIn" | "custom";
    return computeColumnKeys({
      mode,
      searchInKeys,
      configKeys: columnsCfg.keys,
      customKeys: columnsCfg.keys,
      titleKeys,
      subtitleKeys,
    });
  }, [columnsCfg.mode, columnsCfg.keys, searchInKeys, titleKeys, subtitleKeys]);

  const showVisibilityColumn = columnsCfg.showVisibility ?? true;

  // ------------------------------
  // Reference pills
  // ------------------------------
  const referenceFieldsAll = useMemo<FieldKey[]>(() => {
    const all = Object.keys(def.fields) as FieldKey[];
    return all.filter((k) => isReferenceField(def.fields[k]));
  }, [def]);

  const referencePillsCfg = mainCfg.referencePills ?? false;

  const referencePillKeys: FieldKey[] = useMemo(() => {
    if (referencePillsCfg === false) return [];
    if (referencePillsCfg === "auto") return referenceFieldsAll;
    return referencePillsCfg;
  }, [referencePillsCfg, referenceFieldsAll]);

  const showReferencePills = referencePillKeys.length > 0;

  // ------------------------------
  // Hover preview keys
  // ------------------------------
  const hoverCfg = cfg.hoverPreview ?? false;
  const hoverKeys: FieldKey[] = useMemo(() => (hoverCfg ? hoverCfg.keys ?? [] : []), [hoverCfg]);
  const hoverTitle = useMemo(
    () => (hoverCfg ? hoverCfg.title ?? "Anteprima" : "Anteprima"),
    [hoverCfg],
  );

  // ------------------------------
  // Projection fields -> API
  // ------------------------------
  const fields = useMemo(() => {
    return buildListFields(
      { preview: { title: titleKeys } },
      { subtitleKeys, columnKeys, hoverKeys },
      showReferencePills ? referencePillKeys : [],
      true,
      50,
      titleKeys,
    );
  }, [titleKeys, subtitleKeys, columnKeys, hoverKeys, showReferencePills, referencePillKeys]);

  // ------------------------------
  // Filters -> hook
  // ------------------------------
  const filters: AnagraficaFilters = {
    query: query || undefined,
    docType: docType || undefined,

    // ⚠️ se OWNER non è un valore reale del backend, cambialo tu.
    visibilityRole: ownerOnly ? "OWNER" : undefined,

    sortKey: sortKey || undefined,
    sortDir: sortKey ? sortDir : undefined,

    fields,
  };

  const { items, status, total, totalPages } = useAnagraficheList(type, filters, page, pageSize);
  const loading = status === "loading" || status === "idle";

  // ------------------------------
  // Reference previews batch
  // ------------------------------
  const referenceEntries = useMemo<ReferenceBatchEntry[]>(() => {
    if (!showReferencePills) return [];

    return referencePillKeys
      .map((fieldKey) => {
        const fieldDef = def.fields[fieldKey] as any;
        const ids = items
          .map((p) => (p.data as any)?.[fieldKey])
          .filter(Boolean)
          .map(String);

        if (!fieldDef?.reference || ids.length === 0) return null;

        return { fieldKey, config: fieldDef.reference, ids } as ReferenceBatchEntry;
      })
      .filter(Boolean) as ReferenceBatchEntry[];
  }, [items, showReferencePills, referencePillKeys, def.fields]);

  const referenceLabelsByField = useReferenceBatchPreviewMulti(referenceEntries);

  // ------------------------------
  // Helpers render values
  // ------------------------------
  const cellValuePlain = (p: AnagraficaPreview, k: FieldKey) => {
    const raw = (p.data as any)?.[k];
    const fd = def.fields[k] as FieldDef | undefined;
    if (raw === null || raw === undefined || raw === "") return "";

    if (fd && isReferenceField(fd)) {
      const idStr = String(raw);
      return referenceLabelsByField[k]?.[idStr] ?? idStr;
    }

    return formatFieldValue(fd, raw);
  };

  // sort click coerente: se clicco stessa chiave -> toggle dir
  const onSortByKey = (k: string) => {
    if (!k) {
      setSortKey("");
      setSortDir("desc");
      return;
    }
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const emptyMessage = query || docType ? "Nessun risultato" : "Nessun elemento";

  return (
    <div className="space-y-4">
      <AnagraficheListToolbar
        def={def}
        cfg={cfg}
        total={total}
        loading={loading}
        canCreate={canCreate}
        type={type}
        query={query}
        docType={docType}
        ownerOnly={ownerOnly}
        sortKey={sortKey}
        sortDir={sortDir}
        sortIndex={sortIndex}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onQueryChange={setQuery}
        onDocTypeChange={setDocType}
        onOwnerOnlyChange={setOwnerOnly}
        onSortByKey={onSortByKey}
        onPageChange={setPage}
      />

      <AnagraficheListTable
        type={type}
        def={def}
        cfg={{
          ...cfg,
          hoverPreview: hoverCfg ? { title: hoverTitle, keys: hoverKeys } : false,
        }}
        items={items}
        loading={loading}
        emptyMessage={emptyMessage}
        titleKeys={titleKeys}
        subtitleKeys={subtitleKeys}
        columnKeys={columnKeys}
        showVisibilityColumn={showVisibilityColumn}
        sortKey={sortKey}
        sortDir={sortDir}
        sortIndex={sortIndex}
        onSortByKey={onSortByKey}
        referencePillKeys={referencePillKeys}
        referenceLabelsByField={referenceLabelsByField}
        dispatch={dispatch}
        canView={canView}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      {/* pagination è già gestita in toolbar */}
    </div>
  );
}
