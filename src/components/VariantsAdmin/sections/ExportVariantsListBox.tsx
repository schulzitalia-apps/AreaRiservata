"use client";

import { useMemo, useState } from "react";
import { ResourceListBox, type Column } from "@/components/AtlasModuli/common/ResourceListBox";
import type { Notice } from "../types";
import type { ExportVariantConfigDTO } from "../exportTypes";
import {
  apiCreateExportVariant,
  apiDeleteExportVariant,
  apiUpdateExportVariant,
} from "../exportApi";
import ExportVariantEditorModal from "../modals/ExportVariantEditorModal";

export default function ExportVariantsListBox({
  anagraficaSlug,
  items,
  loading,
  onRefresh,
  onNotice,
}: {
  anagraficaSlug: string;
  items: ExportVariantConfigDTO[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNotice: (n: Notice) => void;
}) {
  const [query, setQuery] = useState("");
  const [openEditor, setOpenEditor] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ExportVariantConfigDTO | undefined>();
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((item) => {
      return (
        String(item.variantId || "").toLowerCase().includes(normalizedQuery) ||
        String(item.label || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [items, query]);

  function openCreate() {
    setMode("create");
    setEditing(undefined);
    setOpenEditor(true);
  }

  function openEdit(item: ExportVariantConfigDTO) {
    setMode("edit");
    setEditing(item);
    setOpenEditor(true);
  }

  async function handleSave(payload: {
    variantId: string;
    label: string;
    format: "csv" | "xls";
    includeFields: string[];
    referenceExpansions: Record<string, string[]>;
    filterDateField: string | null;
    filterSelectField: string | null;
    sortDateField: string | null;
    sortDir: "asc" | "desc";
  }) {
    if (saving) return;

    setSaving(true);
    try {
      if (mode === "create") {
        await apiCreateExportVariant(anagraficaSlug, payload);
      } else {
        await apiUpdateExportVariant(anagraficaSlug, payload.variantId, payload);
      }

      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ExportVariantConfigDTO) {
    const ok = confirm(`Eliminare la variante export "${item.variantId}"?`);
    if (!ok) return;

    setDeletingId(item.id);
    try {
      await apiDeleteExportVariant(anagraficaSlug, item.variantId);
      onNotice({ type: "success", text: "Variante export eliminata" });
      await onRefresh();
    } catch (error: any) {
      onNotice({ type: "error", text: error?.message || "Errore eliminazione" });
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<ExportVariantConfigDTO>[] = [
    {
      id: "main",
      header: "Schema export",
      isMain: true,
      className: "col-span-6",
      render: (item) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-dark dark:text-white">
            {item.label || item.variantId}
          </div>
          <div className="truncate text-[12px] text-dark/70 dark:text-white/70">
            <span className="font-mono">{item.variantId}</span>
            {" · "}
            {item.format.toUpperCase()}
            {" · "}
            campi: <span className="font-mono">{item.includeFields.length}</span>
          </div>
        </div>
      ),
    },
    {
      id: "filters",
      header: "Preset",
      className: "col-span-3 hidden md:block",
      render: (item) => (
        <div className="text-[11px] text-dark/60 dark:text-white/60">
          <div>data: {item.filterDateField || "-"}</div>
          <div>select: {item.filterSelectField || "-"}</div>
          <div>sort: {item.sortDateField ? `${item.sortDateField} (${item.sortDir})` : "-"}</div>
        </div>
      ),
    },
  ];

  return (
    <>
      <ResourceListBox<ExportVariantConfigDTO>
        title={`Varianti export · ${anagraficaSlug}`}
        searchPlaceholder="Cerca schema export…"
        query={query}
        setQuery={setQuery}
        loading={loading}
        items={filtered}
        emptyMessage="Nessuna variante export."
        columns={columns}
        getKey={(item) => item.id}
        toolbarRight={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-blue-light"
            >
              + Nuova variante export
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md border border-stroke px-3 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Aggiorna
            </button>
          </div>
        }
        renderActions={(item) => {
          const isBusyRow = deletingId === item.id;

          return (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Edit
              </button>

              <button
                type="button"
                disabled={isBusyRow}
                onClick={() => handleDelete(item)}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {isBusyRow ? "..." : "Delete"}
              </button>
            </div>
          );
        }}
        actionsColumnClassName="col-span-3"
      />

      <ExportVariantEditorModal
        open={openEditor}
        onClose={() => setOpenEditor(false)}
        anagraficaSlug={anagraficaSlug}
        mode={mode}
        existing={editing}
        onSave={handleSave}
        onNotice={onNotice}
      />
    </>
  );
}
