"use client";

import { useMemo, useState } from "react";
import type { Notice, VariantConfigDTO } from "../types";
import VariantEditorModal from "../modals/VariantEditorModal";
import { apiCreateVariant, apiDeleteVariant, apiUpdateVariant } from "../api";
import { ResourceListBox, Column } from "@/components/AtlasModuli/common/ResourceListBox";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

type DefaultVirtual = {
  variantId: "default";
  label: "Default";
  includeFields: string[];
  fieldOverrides: any;
};

function slugSupportsVariants(anagraficaSlug: string): boolean {
  const t: any = (PUBLIC_ANAGRAFICA_TYPES as any)?.find((x: any) => x.slug === anagraficaSlug);
  const fields: string[] = Array.isArray(t?.fields) ? t.fields : [];
  // regola: se non ho variantId nella def, non permetto varianti custom
  return fields.includes("variantId");
}

export default function VariantsListBox({
                                          anagraficaSlug,
                                          items,
                                          loading,
                                          onRefresh,
                                          onNotice,
                                        }: {
  anagraficaSlug: string;
  items: VariantConfigDTO[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNotice: (n: Notice) => void;
}) {
  const [query, setQuery] = useState("");
  const [openEditor, setOpenEditor] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<VariantConfigDTO | DefaultVirtual | undefined>();

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supportsVariants = useMemo(
    () => slugSupportsVariants(anagraficaSlug),
    [anagraficaSlug],
  );

  const listWithDefault = useMemo(() => {
    const hasDefault = items.some((x) => x.variantId === "default");

    const virtualDefault: DefaultVirtual = {
      variantId: "default",
      label: "Default",
      includeFields: [],
      fieldOverrides: {},
    };

    // se NON supporta variants: mostra SOLO default (virtuale o DB)
    if (!supportsVariants) {
      if (hasDefault) return items.filter((x) => x.variantId === "default");
      return [virtualDefault as any];
    }

    // supporta variants: default sempre visibile + altre
    const all = hasDefault ? items : [virtualDefault as any, ...items];
    return all;
  }, [items, supportsVariants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listWithDefault;
    return listWithDefault.filter((v: any) => {
      return (
        String(v.variantId || "").toLowerCase().includes(q) ||
        String(v.label || "").toLowerCase().includes(q)
      );
    });
  }, [listWithDefault, query]);

  function openCreate() {
    if (!supportsVariants) return;
    setMode("create");
    setEditing(undefined);
    setOpenEditor(true);
  }

  function openEdit(v: any) {
    // edit della default sempre ok (anche se slug non supporta variants)
    if (!supportsVariants && v.variantId !== "default") return;
    setMode("edit");
    setEditing(v);
    setOpenEditor(true);
  }

  async function handleSave(payload: {
    variantId: string;
    label: string;
    includeFields: string[];
    fieldOverrides: any;
  }) {
    if (saving) return;

    // hard guard: se slug non supporta variants, puoi salvare solo default
    if (!supportsVariants && payload.variantId !== "default") {
      onNotice({ type: "error", text: "Questo slug non supporta varianti custom." });
      return;
    }

    setSaving(true);

    try {
      if (mode === "create") {
        await apiCreateVariant(anagraficaSlug, {
          variantId: payload.variantId,
          label: payload.label,
          includeFields: payload.includeFields,
          fieldOverrides: payload.fieldOverrides,
        });
      } else {
        const isVirtualDefault =
          (editing as any)?.variantId === "default" && !(editing as any)?.id;

        if (isVirtualDefault) {
          await apiCreateVariant(anagraficaSlug, {
            variantId: "default",
            label: payload.label,
            includeFields: payload.includeFields,
            fieldOverrides: payload.fieldOverrides,
          });
        } else {
          await apiUpdateVariant(anagraficaSlug, payload.variantId, {
            label: payload.label,
            includeFields: payload.includeFields,
            fieldOverrides: payload.fieldOverrides,
          });
        }
      }

      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: VariantConfigDTO) {
    if (v.variantId === "default") {
      onNotice({ type: "error", text: "La default non si elimina (puoi solo modificarla)." });
      return;
    }

    // se slug non supporta variants, non dovresti mai arrivare qui
    if (!supportsVariants) {
      onNotice({ type: "error", text: "Questo slug non supporta varianti custom." });
      return;
    }

    const ok = confirm(`Eliminare la variante "${v.variantId}"?`);
    if (!ok) return;

    setDeletingId(v.id);
    try {
      await apiDeleteVariant(anagraficaSlug, v.variantId);
      onNotice({ type: "success", text: "Variante eliminata" });
      await onRefresh();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore eliminazione" });
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<any>[] = [
    {
      id: "main",
      header: "Variante",
      isMain: true,
      className: "col-span-6",
      render: (v) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-dark dark:text-white">
            {v.label || v.variantId}
          </div>
          <div className="truncate text-[12px] text-dark/70 dark:text-white/70">
            <span className="font-mono">{v.variantId}</span>
            {" · "}
            campi:{" "}
            <span className="font-mono">
              {Array.isArray(v.includeFields) ? v.includeFields.length : 0}
            </span>
          </div>

          {!supportsVariants ? (
            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Questo slug non supporta varianti custom (manca <span className="font-mono">variantId</span>).
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "meta",
      header: "Meta",
      className: "col-span-3 hidden md:block",
      render: (v) => (
        <div className="text-[11px] text-dark/60 dark:text-white/60">
          {v.id ? (
            <>
              <div className="truncate font-mono">id: {v.id}</div>
              <div className="truncate">
                upd: {v.updatedAt ? new Date(v.updatedAt).toLocaleString() : "-"}
              </div>
            </>
          ) : (
            <div className="italic">Virtual (non salvata)</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ResourceListBox<any>
        title={`Varianti · ${anagraficaSlug}`}
        searchPlaceholder="Cerca per label o variantId…"
        query={query}
        setQuery={setQuery}
        loading={loading}
        items={filtered}
        emptyMessage="Nessuna variante."
        columns={columns}
        getKey={(v) => v.id ?? `virtual-${v.variantId}`}
        toolbarRight={
          <div className="flex gap-2">
            {supportsVariants ? (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-blue-light"
              >
                + Nuova variante
              </button>
            ) : null}

            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md border border-stroke px-3 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Aggiorna
            </button>
          </div>
        }
        renderActions={(v) => {
          const isDefault = v.variantId === "default";
          const isBusyRow = deletingId === v.id;

          // se non supporta variants: niente delete, edit solo default
          const canEdit = supportsVariants ? true : isDefault;
          const canDelete = supportsVariants && !isDefault;

          return (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => openEdit(v)}
                className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-2 disabled:opacity-40 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Edit
              </button>

              <button
                type="button"
                disabled={!canDelete || isBusyRow}
                onClick={() => handleDelete(v as VariantConfigDTO)}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                title={
                  !supportsVariants
                    ? "Slug senza supporto varianti"
                    : isDefault
                      ? "Default non eliminabile"
                      : "Elimina variante"
                }
              >
                {isBusyRow ? "..." : "Delete"}
              </button>
            </div>
          );
        }}
        actionsColumnClassName="col-span-3"
      />

      <VariantEditorModal
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
