"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Notice, VariantConfigDTO, FieldOverride } from "../types";
import FieldOverridesEditor from "../ui/FieldOverridesEditor";
import { FIELD_CATALOG } from "@/config/anagrafiche.fields.catalog";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

function getFieldsForSlug(slug: string): string[] {
  // Preferisco usare l’elenco fields “pubblico” per slug (come nel tuo screenshot)
  const t: any = (PUBLIC_ANAGRAFICA_TYPES as any)?.find((x: any) => x.slug === slug);
  const fields: string[] = Array.isArray(t?.fields) ? t.fields : [];
  return fields;
}

function fieldLabel(fieldKey: string) {
  return (FIELD_CATALOG as any)?.[fieldKey]?.label || fieldKey;
}

export default function VariantEditorModal({
                                             open,
                                             onClose,
                                             anagraficaSlug,
                                             mode,
                                             existing,
                                             onSave,
                                             onNotice,
                                           }: {
  open: boolean;
  onClose: () => void;
  anagraficaSlug: string;
  mode: "create" | "edit";
  existing?: VariantConfigDTO | { variantId: "default"; label: "Default"; includeFields: string[]; fieldOverrides: Record<string, FieldOverride> };
  onSave: (payload: {
    variantId: string;
    label: string;
    includeFields: string[];
    fieldOverrides: Record<string, FieldOverride>;
  }) => Promise<void>;
  onNotice: (n: Notice) => void;
}) {
  const allFields = useMemo(() => getFieldsForSlug(anagraficaSlug), [anagraficaSlug]);

  const [busy, setBusy] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [label, setLabel] = useState("");
  const [includeFields, setIncludeFields] = useState<string[]>([]);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, FieldOverride>>({});

  useEffect(() => {
    if (!open) return;

    const isCreate = mode === "create";
    const vId = isCreate ? "" : (existing?.variantId ?? "");
    setVariantId(vId);

    setLabel(
      isCreate
        ? ""
        : (existing as any)?.label ?? (existing?.variantId === "default" ? "Default" : ""),
    );

    const inc = (existing as any)?.includeFields ?? [];
    setIncludeFields(Array.isArray(inc) ? inc : []);

    const ov = (existing as any)?.fieldOverrides ?? {};
    setFieldOverrides(ov && typeof ov === "object" ? ov : {});
  }, [open, mode, existing]);

  const canSave = useMemo(() => {
    if (busy) return false;
    if (mode === "create" && !variantId.trim()) return false;
    return true;
  }, [busy, mode, variantId]);

  function toggleField(k: string, on: boolean) {
    setIncludeFields((prev) => {
      const set = new Set(prev);
      if (on) set.add(k);
      else set.delete(k);

      // se tolgo il campo, tolgo anche override
      if (!on) {
        setFieldOverrides((cur) => {
          const next = { ...cur };
          delete next[k];
          return next;
        });
      }
      return Array.from(set);
    });
  }

  async function handleSave() {
    if (!canSave) return;

    const vId = mode === "create" ? variantId.trim() : (existing?.variantId ?? "").trim();
    const finalLabel = (label.trim() || vId || "Default").trim();

    setBusy(true);
    try {
      await onSave({
        variantId: vId,
        label: finalLabel,
        includeFields: includeFields,
        fieldOverrides,
      });
      onNotice({ type: "success", text: "Variante salvata" });
      onClose();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore salvataggio" });
    } finally {
      setBusy(false);
    }
  }

  const sortedFields = useMemo(() => {
    return [...allFields].sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b)));
  }, [allFields]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? `Crea variante (${anagraficaSlug})` : `Modifica variante (${anagraficaSlug})`}
      subtitle={
        <span className="font-mono text-[11px]">
          {mode === "create" ? "Nuova variante" : `variantId: ${(existing as any)?.variantId}`}
        </span>
      }
      maxWidthClassName="max-w-6xl"
    >
      <div className="grid gap-4 md:grid-cols-[360px,1fr]">
        {/* LEFT: meta + fields */}
        <div className="space-y-4">
          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            {mode === "create" ? (
              <label className="block text-xs text-dark dark:text-white">
                variantId
                <input
                  className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  placeholder="es. b2b / retail / print"
                />
              </label>
            ) : (
              <div className="text-xs text-dark/70 dark:text-white/70">
                variantId:{" "}
                <span className="font-mono text-dark dark:text-white">
                  {(existing as any)?.variantId}
                </span>
              </div>
            )}

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Label
              <input
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nome user friendly"
              />
            </label>
          </div>

          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 text-xs font-semibold text-dark dark:text-white">
              Campi inclusi
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {sortedFields.map((k) => {
                const on = includeFields.includes(k);
                return (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-gray-2/60 dark:hover:bg-dark-2/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-dark dark:text-white">
                        {fieldLabel(k)}
                      </div>
                      <div className="truncate font-mono text-[10px] text-dark/60 dark:text-white/60">
                        {k}
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleField(k, e.target.checked)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: overrides */}
        <div className="space-y-3">
          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="text-xs font-semibold text-dark dark:text-white">
              Override formattazione (opzionale)
            </div>
            <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
              Qui decidi come visualizzare i campi (currency/percent/date/link/label ecc).
            </div>
          </div>

          {includeFields.length === 0 ? (
            <div className="rounded-lg border border-stroke p-6 text-sm text-dark/60 dark:border-dark-3 dark:text-white/60">
              Seleziona almeno un campo a sinistra.
            </div>
          ) : (
            <div className="space-y-3">
              {includeFields.map((k) => (
                <FieldOverridesEditor
                  key={k}
                  fieldKey={k}
                  value={fieldOverrides[k]}
                  onChange={(next) => {
                    setFieldOverrides((prev) => {
                      const out = { ...prev };
                      if (!next) delete out[k];
                      else out[k] = next;
                      return out;
                    });
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
            >
              {busy ? "..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
