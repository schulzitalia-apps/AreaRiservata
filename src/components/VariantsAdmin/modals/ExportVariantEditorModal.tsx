"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FIELD_CATALOG, isReferenceField, isReferenceMultiField, type FieldKey } from "@/config/anagrafiche.fields.catalog";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { Notice } from "../types";
import type { ExportFormat, ExportSortDir, ExportVariantConfigDTO } from "../exportTypes";

function getFieldsForSlug(slug: string): FieldKey[] {
  const config = (PUBLIC_ANAGRAFICA_TYPES as any)?.find((entry: any) => entry.slug === slug);
  return Array.isArray(config?.fields) ? config.fields : [];
}

function fieldLabel(fieldKey: string) {
  return (FIELD_CATALOG as any)?.[fieldKey]?.label || fieldKey;
}

function uniqStrings(items: string[]) {
  return Array.from(new Set(items.map((value) => String(value || "").trim()).filter(Boolean)));
}

export default function ExportVariantEditorModal({
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
  existing?: ExportVariantConfigDTO;
  onSave: (payload: {
    variantId: string;
    label: string;
    format: ExportFormat;
    includeFields: string[];
    referenceExpansions: Record<string, string[]>;
    filterDateField: string | null;
    filterSelectField: string | null;
    sortDateField: string | null;
    sortDir: ExportSortDir;
  }) => Promise<void>;
  onNotice: (n: Notice) => void;
}) {
  const allFields = useMemo(() => getFieldsForSlug(anagraficaSlug), [anagraficaSlug]);
  const def = useMemo(() => getAnagraficaDef(anagraficaSlug), [anagraficaSlug]);

  const dateFields = useMemo(
    () => allFields.filter((fieldKey) => def.fields[fieldKey]?.type === "date"),
    [allFields, def.fields],
  );

  const selectFields = useMemo(
    () => allFields.filter((fieldKey) => def.fields[fieldKey]?.type === "select"),
    [allFields, def.fields],
  );

  const [busy, setBusy] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [label, setLabel] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeFields, setIncludeFields] = useState<string[]>([]);
  const [referenceExpansions, setReferenceExpansions] = useState<Record<string, string[]>>({});
  const [filterDateField, setFilterDateField] = useState<string>("");
  const [filterSelectField, setFilterSelectField] = useState<string>("");
  const [sortDateField, setSortDateField] = useState<string>("");
  const [sortDir, setSortDir] = useState<ExportSortDir>("asc");

  useEffect(() => {
    if (!open) return;

    setVariantId(mode === "create" ? "" : existing?.variantId ?? "");
    setLabel(mode === "create" ? "" : existing?.label ?? "");
    setFormat(existing?.format === "xls" ? "xls" : "csv");
    setIncludeFields(Array.isArray(existing?.includeFields) ? existing!.includeFields : []);
    setReferenceExpansions(existing?.referenceExpansions ?? {});
    setFilterDateField(existing?.filterDateField ?? "");
    setFilterSelectField(existing?.filterSelectField ?? "");
    setSortDateField(existing?.sortDateField ?? "");
    setSortDir(existing?.sortDir === "desc" ? "desc" : "asc");
  }, [open, mode, existing]);

  const canSave = useMemo(() => {
    if (busy) return false;
    if (mode === "create" && !variantId.trim()) return false;
    if (includeFields.length === 0) return false;
    return true;
  }, [busy, includeFields.length, mode, variantId]);

  const sortedFields = useMemo(
    () => [...allFields].sort((left, right) => fieldLabel(left).localeCompare(fieldLabel(right))),
    [allFields],
  );

  function toggleField(fieldKey: string, enabled: boolean) {
    setIncludeFields((current) => {
      const next = new Set(current);
      if (enabled) next.add(fieldKey);
      else next.delete(fieldKey);
      return Array.from(next);
    });

    if (!enabled) {
      // La configurazione dei riferimenti resta sempre agganciata ai campi inclusi:
      // se tolgo il campo sorgente, sparisce anche la sua espansione.
      setReferenceExpansions((current) => {
        if (!(fieldKey in current)) return current;
        const next = { ...current };
        delete next[fieldKey];
        return next;
      });
    }
  }

  function toggleReferenceField(fieldKey: string, nestedKey: string) {
    setReferenceExpansions((current) => {
      const currentValues = current[fieldKey] ?? [];
      const nextValues = currentValues.includes(nestedKey)
        ? currentValues.filter((value) => value !== nestedKey)
        : [...currentValues, nestedKey];

      return {
        ...current,
        [fieldKey]: uniqStrings(nextValues),
      };
    });
  }

  async function handleSave() {
    if (!canSave) return;

    const finalVariantId =
      mode === "create" ? variantId.trim() : String(existing?.variantId ?? "").trim();
    const finalLabel = (label.trim() || finalVariantId).trim();

    const normalizedReferenceExpansions = Object.fromEntries(
      Object.entries(referenceExpansions)
        .filter(([fieldKey]) => includeFields.includes(fieldKey))
        .map(([fieldKey, nestedFields]) => [fieldKey, uniqStrings(nestedFields)])
        .filter(([, nestedFields]) => nestedFields.length > 0),
    );

    setBusy(true);
    try {
      await onSave({
        variantId: finalVariantId,
        label: finalLabel,
        format,
        includeFields: uniqStrings(includeFields),
        referenceExpansions: normalizedReferenceExpansions,
        filterDateField: filterDateField || null,
        filterSelectField: filterSelectField || null,
        sortDateField: sortDateField || null,
        sortDir,
      });
      onNotice({ type: "success", text: "Variante export salvata" });
      onClose();
    } catch (error: any) {
      onNotice({ type: "error", text: error?.message || "Errore salvataggio" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? `Crea variante export (${anagraficaSlug})` : `Modifica variante export (${anagraficaSlug})`}
      subtitle={
        <span className="text-[11px] text-dark/70 dark:text-white/70">
          Strumento dedicato solo agli export salvati: campi, riferimenti e filtri finali consentiti.
        </span>
      }
      maxWidthClassName="max-w-6xl"
    >
      <div className="grid gap-4 md:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            {mode === "create" ? (
              <label className="block text-xs text-dark dark:text-white">
                variantId
                <input
                  className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  placeholder="es. avanzamento-produzione"
                />
              </label>
            ) : (
              <div className="text-xs text-dark/70 dark:text-white/70">
                variantId: <span className="font-mono text-dark dark:text-white">{existing?.variantId}</span>
              </div>
            )}

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Label
              <input
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Nome leggibile per l'utente"
              />
            </label>

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Formato export predefinito
              <select
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={format}
                onChange={(e) => setFormat(e.target.value === "xls" ? "xls" : "csv")}
              >
                <option value="csv">CSV (.csv)</option>
                <option value="xls">Excel (.xls)</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 text-xs font-semibold text-dark dark:text-white">
              Filtri concessi all&apos;utente finale
            </div>

            <label className="block text-xs text-dark dark:text-white">
              Campo data per intervallo
              <select
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={filterDateField}
                onChange={(e) => setFilterDateField(e.target.value)}
              >
                <option value="">Nessuno</option>
                {dateFields.map((fieldKey) => (
                  <option key={fieldKey} value={fieldKey}>
                    {fieldLabel(fieldKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Campo select per stato
              <select
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={filterSelectField}
                onChange={(e) => setFilterSelectField(e.target.value)}
              >
                <option value="">Nessuno</option>
                {selectFields.map((fieldKey) => (
                  <option key={fieldKey} value={fieldKey}>
                    {fieldLabel(fieldKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Ordinamento data
              <select
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={sortDateField}
                onChange={(e) => setSortDateField(e.target.value)}
              >
                <option value="">Ordine naturale</option>
                {dateFields.map((fieldKey) => (
                  <option key={fieldKey} value={fieldKey}>
                    {fieldLabel(fieldKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs text-dark dark:text-white">
              Direzione ordinamento
              <select
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary disabled:opacity-50 dark:border-dark-3 dark:text-white"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value === "desc" ? "desc" : "asc")}
                disabled={!sortDateField}
              >
                <option value="asc">Crescente</option>
                <option value="desc">Decrescente</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="text-xs font-semibold text-dark dark:text-white">
              Campi esportati
            </div>
            <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
              Qui definisci la struttura persistente del preset. Se includi un riferimento, puoi anche esploderne i campi collegati.
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {sortedFields.map((fieldKey) => {
              const fieldDef = def.fields[fieldKey];
              const checked = includeFields.includes(fieldKey);
              const isReference =
                !!fieldDef && (isReferenceField(fieldDef) || isReferenceMultiField(fieldDef));
              const targetDef =
                isReference && fieldDef.reference?.kind === "anagrafica"
                  ? getAnagraficaDef(fieldDef.reference.targetSlug)
                  : null;

              return (
                <div
                  key={fieldKey}
                  className="rounded-lg border border-stroke p-3 dark:border-dark-3"
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(e) => toggleField(fieldKey, e.target.checked)}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-dark dark:text-white">
                        {fieldLabel(fieldKey)}
                      </div>
                      <div className="font-mono text-[10px] text-dark/60 dark:text-white/60">
                        {fieldKey} · {fieldDef?.type || "unknown"}
                      </div>
                    </div>
                  </label>

                  {checked && targetDef ? (
                    <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 dark:bg-primary/10">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Campi del riferimento
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(Object.keys(targetDef.fields) as FieldKey[]).map((nestedKey) => (
                          <label
                            key={`${fieldKey}-${nestedKey}`}
                            className="flex items-start gap-2 rounded-md bg-white/70 px-2 py-1.5 text-xs text-dark dark:bg-dark-2/60 dark:text-white"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={(referenceExpansions[fieldKey] ?? []).includes(nestedKey)}
                              onChange={() => toggleReferenceField(fieldKey, nestedKey)}
                            />
                            <span className="truncate">
                              {targetDef.fields[nestedKey]?.label ?? nestedKey}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

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
