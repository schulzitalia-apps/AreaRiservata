"use client";

import { useEffect, useMemo, useState } from "react";

import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import {
  isReferenceField,
  isReferenceMultiField,
  type FieldDef,
  type FieldKey,
} from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import {
  AppButton,
  AppField,
  AppInput,
  AppModal,
  AppSelect,
} from "@/components/ui";

import { formatFieldValue, uniqFieldKeys } from "./helpers";

type ExportFormat = "csv" | "xls";

type BaseListFilters = {
  query?: string;
  docType?: string;
  visibilityRole?: string;
};

type ReferenceExpansionState = Partial<Record<FieldKey, FieldKey[]>>;

type ReferencePlan = {
  fieldKey: FieldKey;
  fieldDef: FieldDef;
  targetSlug: string;
  targetDef: ReturnType<typeof getAnagraficaDef>;
  labelKeys: FieldKey[];
  nestedKeys: FieldKey[];
  multiple: boolean;
};

type ExportColumn = {
  key: string;
  label: string;
  getValue: (item: AnagraficaPreview) => string;
};

function parseDateValue(raw: unknown): number | null {
  if (!raw) return null;
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateStart(raw: string): number | null {
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseDateEnd(raw: string): number | null {
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.getTime();
}

function csvEscape(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadFile(content: string, mime: string, fileName: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function fetchAllAnagrafichePages(params: Parameters<typeof anagraficheService.list>[0]) {
  const items: AnagraficaPreview[] = [];
  const pageSize = 200;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await anagraficheService.list({
      ...params,
      page,
      pageSize,
    });

    items.push(...(res.items ?? []));

    const safePageSize = Math.max(1, res.pageSize || pageSize);
    totalPages = Math.max(1, Math.ceil((res.total || 0) / safePageSize));
    page += 1;
  }

  return items;
}

function buildCsv(columns: ExportColumn[], items: AnagraficaPreview[]) {
  const lines = [
    columns.map((column) => csvEscape(column.label)).join(";"),
    ...items.map((item) =>
      columns.map((column) => csvEscape(column.getValue(item))).join(";"),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

function buildExcel(columns: ExportColumn[], items: AnagraficaPreview[], sheetName: string) {
  const header = columns
    .map((column) => `<th>${htmlEscape(column.label)}</th>`)
    .join("");

  const rows = items
    .map((item) => {
      const cells = columns
        .map((column) => `<td>${htmlEscape(column.getValue(item))}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="ProgId" content="Excel.Sheet" />
    <meta name="Generator" content="Atlas" />
    <title>${htmlEscape(sheetName)}</title>
  </head>
  <body>
    <table>
      <thead>
        <tr>${header}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

export function AnagraficheExportModal({
  open,
  onClose,
  type,
  def,
  baseFilters,
  defaultSelectedFields,
}: {
  open: boolean;
  onClose: () => void;
  type: string;
  def: ReturnType<typeof getAnagraficaDef>;
  baseFilters: BaseListFilters;
  defaultSelectedFields: FieldKey[];
}) {
  const allFieldKeys = useMemo(
    () => Object.keys(def.fields) as FieldKey[],
    [def.fields],
  );

  const dateFields = useMemo(
    () => allFieldKeys.filter((fieldKey) => def.fields[fieldKey]?.type === "date"),
    [allFieldKeys, def.fields],
  );

  const selectFields = useMemo(
    () => allFieldKeys.filter((fieldKey) => def.fields[fieldKey]?.type === "select"),
    [allFieldKeys, def.fields],
  );

  const safeDefaultSelectedFields = useMemo(() => {
    const fallback = defaultSelectedFields.length ? defaultSelectedFields : def.preview.title;
    return uniqFieldKeys(fallback.filter((fieldKey) => !!def.fields[fieldKey]));
  }, [defaultSelectedFields, def.fields, def.preview.title]);

  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(safeDefaultSelectedFields);
  const [referenceExpansions, setReferenceExpansions] = useState<ReferenceExpansionState>({});
  const [dateFilterField, setDateFilterField] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateSortField, setDateSortField] = useState<string>("");
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("asc");
  const [selectFilters, setSelectFilters] = useState<Partial<Record<FieldKey, string>>>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    setFormat("csv");
    setSelectedFields(safeDefaultSelectedFields);
    setReferenceExpansions({});
    setDateFilterField("");
    setDateFrom("");
    setDateTo("");
    setDateSortField("");
    setDateSortDir("asc");
    setSelectFilters({});
    setExporting(false);
    setError("");
  }, [open, safeDefaultSelectedFields]);

  const referencePlans = useMemo<ReferencePlan[]>(() => {
    return selectedFields
      .map((fieldKey) => {
        const fieldDef = def.fields[fieldKey];
        const isSingleReference = isReferenceField(fieldDef);
        const isMultiReference = isReferenceMultiField(fieldDef);

        if (!fieldDef || (!isSingleReference && !isMultiReference)) return null;
        if (!fieldDef.reference || fieldDef.reference.kind !== "anagrafica") return null;

        try {
          const targetDef = getAnagraficaDef(fieldDef.reference.targetSlug);
          const rawNestedKeys = referenceExpansions[fieldKey] ?? [];
          const nestedKeys = uniqFieldKeys(
            rawNestedKeys.filter((nestedKey) => !!targetDef.fields[nestedKey]),
          );

          const previewField = fieldDef.reference.previewField as FieldKey | undefined;
          const labelKeys = uniqFieldKeys(
            (previewField ? [previewField] : targetDef.preview.title).filter(
              (nestedKey) => !!targetDef.fields[nestedKey],
            ),
          );

          return {
            fieldKey,
            fieldDef,
            targetSlug: fieldDef.reference.targetSlug,
            targetDef,
            labelKeys,
            nestedKeys,
            multiple: isMultiReference,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ReferencePlan[];
  }, [def.fields, referenceExpansions, selectedFields]);

  const activeBaseFilters = useMemo(() => {
    const entries: string[] = [];
    if (baseFilters.query) entries.push(`Ricerca: ${baseFilters.query}`);
    if (baseFilters.docType) entries.push(`Tipo documento: ${baseFilters.docType}`);
    if (baseFilters.visibilityRole) entries.push(`Visibilita: ${baseFilters.visibilityRole}`);
    return entries;
  }, [baseFilters.docType, baseFilters.query, baseFilters.visibilityRole]);

  const toggleField = (fieldKey: FieldKey) => {
    setSelectedFields((current) => {
      if (current.includes(fieldKey)) {
        return current.filter((item) => item !== fieldKey);
      }
      return [...current, fieldKey];
    });

    setReferenceExpansions((current) => {
      if (!(fieldKey in current)) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  };

  const toggleReferenceNestedField = (fieldKey: FieldKey, nestedKey: FieldKey) => {
    setReferenceExpansions((current) => {
      const currentKeys = current[fieldKey] ?? [];
      const hasNestedKey = currentKeys.includes(nestedKey);
      const nextKeys = hasNestedKey
        ? currentKeys.filter((item) => item !== nestedKey)
        : [...currentKeys, nestedKey];

      return {
        ...current,
        [fieldKey]: uniqFieldKeys(nextKeys),
      };
    });
  };

  const updateSelectFilter = (fieldKey: FieldKey, value: string) => {
    setSelectFilters((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  };

  const handleExport = async () => {
    if (!selectedFields.length) {
      setError("Seleziona almeno un campo da esportare.");
      return;
    }

    setExporting(true);
    setError("");

    try {
      const requestedFields = uniqFieldKeys([
        ...selectedFields,
        ...(dateFilterField ? ([dateFilterField] as FieldKey[]) : []),
        ...(dateSortField ? ([dateSortField] as FieldKey[]) : []),
        ...Object.entries(selectFilters)
          .filter(([, value]) => String(value || "").trim().length > 0)
          .map(([fieldKey]) => fieldKey as FieldKey),
      ]);

      const baseItems = await fetchAllAnagrafichePages({
        type,
        query: baseFilters.query,
        docType: baseFilters.docType,
        visibilityRole: baseFilters.visibilityRole,
        fields: requestedFields.map(String),
      });

      const fromTs = parseDateStart(dateFrom);
      const toTs = parseDateEnd(dateTo);

      let filteredItems = baseItems.filter((item) => {
        if (dateFilterField) {
          const rawDate = (item.data as any)?.[dateFilterField];
          const currentTs = parseDateValue(rawDate);

          if (currentTs === null) return false;
          if (fromTs !== null && currentTs < fromTs) return false;
          if (toTs !== null && currentTs >= toTs) return false;
        }

        for (const [fieldKey, value] of Object.entries(selectFilters)) {
          const expected = String(value || "").trim();
          if (!expected) continue;

          const raw = (item.data as any)?.[fieldKey];
          if (String(raw ?? "").trim() !== expected) return false;
        }

        return true;
      });

      if (dateSortField) {
        filteredItems = [...filteredItems].sort((left, right) => {
          const leftTs = parseDateValue((left.data as any)?.[dateSortField]);
          const rightTs = parseDateValue((right.data as any)?.[dateSortField]);

          if (leftTs === null && rightTs === null) return 0;
          if (leftTs === null) return 1;
          if (rightTs === null) return -1;

          return dateSortDir === "asc" ? leftTs - rightTs : rightTs - leftTs;
        });
      }

      if (!filteredItems.length) {
        setError("Nessuna anagrafica corrisponde ai criteri scelti.");
        return;
      }

      const idsBySlug = new Map<string, Set<string>>();
      const requiredFieldsBySlug = new Map<string, Set<string>>();

      for (const plan of referencePlans) {
        const unionFields = uniqFieldKeys([...plan.labelKeys, ...plan.nestedKeys]);
        const slugFields = requiredFieldsBySlug.get(plan.targetSlug) ?? new Set<string>();

        unionFields.forEach((fieldKey) => slugFields.add(String(fieldKey)));
        requiredFieldsBySlug.set(plan.targetSlug, slugFields);

        for (const item of filteredItems) {
          const rawValue = (item.data as any)?.[plan.fieldKey];
          const ids = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];

          for (const id of ids) {
            const idValue = String(id ?? "").trim();
            if (!idValue) continue;

            const slugIds = idsBySlug.get(plan.targetSlug) ?? new Set<string>();
            slugIds.add(idValue);
            idsBySlug.set(plan.targetSlug, slugIds);
          }
        }
      }

      const referenceDataBySlug = new Map<string, Record<string, AnagraficaPreview>>();

      for (const [slug, idsSet] of idsBySlug.entries()) {
        const ids = Array.from(idsSet);
        if (!ids.length) {
          referenceDataBySlug.set(slug, {});
          continue;
        }

        const fields = Array.from(requiredFieldsBySlug.get(slug) ?? new Set<string>());
        const records = await fetchAllAnagrafichePages({
          type: slug,
          ids,
          fields,
        });

        referenceDataBySlug.set(
          slug,
          records.reduce<Record<string, AnagraficaPreview>>((acc, record) => {
            acc[record.id] = record;
            return acc;
          }, {}),
        );
      }

      const buildReferenceLabel = (plan: ReferencePlan, record: AnagraficaPreview | undefined) => {
        if (!record) return "";

        const parts = plan.labelKeys
          .map((fieldKey) =>
            formatFieldValue(plan.targetDef.fields[fieldKey], (record.data as any)?.[fieldKey]),
          )
          .filter(Boolean);

        return parts.join(" / ") || record.displayName || record.id;
      };

      const columns: ExportColumn[] = [];

      for (const fieldKey of selectedFields) {
        const fieldDef = def.fields[fieldKey];
        const referencePlan = referencePlans.find((plan) => plan.fieldKey === fieldKey);

        if (!fieldDef) continue;

        if (referencePlan) {
          columns.push({
            key: String(fieldKey),
            label: fieldDef.label,
            getValue: (item) => {
              const recordsById = referenceDataBySlug.get(referencePlan.targetSlug) ?? {};
              const rawValue = (item.data as any)?.[fieldKey];
              const ids = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];

              return ids
                .map((id) => buildReferenceLabel(referencePlan, recordsById[String(id ?? "").trim()]))
                .filter(Boolean)
                .join(" | ");
            },
          });

          for (const nestedKey of referencePlan.nestedKeys) {
            columns.push({
              key: `${String(fieldKey)}::${String(nestedKey)}`,
              label: `${fieldDef.label} / ${referencePlan.targetDef.fields[nestedKey]?.label ?? nestedKey}`,
              getValue: (item) => {
                const recordsById = referenceDataBySlug.get(referencePlan.targetSlug) ?? {};
                const rawValue = (item.data as any)?.[fieldKey];
                const ids = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];

                return ids
                  .map((id) => recordsById[String(id ?? "").trim()])
                  .filter(Boolean)
                  .map((record) =>
                    formatFieldValue(
                      referencePlan.targetDef.fields[nestedKey],
                      (record.data as any)?.[nestedKey],
                    ),
                  )
                  .filter(Boolean)
                  .join(" | ");
              },
            });
          }

          continue;
        }

        columns.push({
          key: String(fieldKey),
          label: fieldDef.label,
          getValue: (item) => formatFieldValue(fieldDef, (item.data as any)?.[fieldKey]),
        });
      }

      const fileDate = new Date().toISOString().slice(0, 10);
      const fileBaseName = `${type}-export-${fileDate}`;

      if (format === "csv") {
        downloadFile(
          buildCsv(columns, filteredItems),
          "text/csv;charset=utf-8",
          `${fileBaseName}.csv`,
        );
      } else {
        downloadFile(
          buildExcel(columns, filteredItems, def.label),
          "application/vnd.ms-excel;charset=utf-8",
          `${fileBaseName}.xls`,
        );
      }

      onClose();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? "Errore durante l'esportazione."));
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    { value: "csv", label: "CSV (.csv)" },
    { value: "xls", label: "Excel (.xls)" },
  ];

  const dateFieldOptions = [
    { value: "", label: "Nessun filtro" },
    ...dateFields.map((fieldKey) => ({
      value: String(fieldKey),
      label: def.fields[fieldKey]?.label ?? String(fieldKey),
    })),
  ];

  const dateSortOptions = [
    { value: "", label: "Ordine predefinito" },
    ...dateFields.map((fieldKey) => ({
      value: String(fieldKey),
      label: def.fields[fieldKey]?.label ?? String(fieldKey),
    })),
  ];

  const sortDirOptions = [
    { value: "asc", label: "Crescente" },
    { value: "desc", label: "Decrescente" },
  ];

  return (
    <AppModal
      open={open}
      onClose={() => !exporting && onClose()}
      title={`Esporta ${def.label}`}
      subtitle="Scegli campi, date, stati e formato. Il filtro viene applicato usando i dati caricati tramite le API anagrafiche esistenti."
      size="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-dark/60 dark:text-white/60">
            {selectedFields.length} campi selezionati
          </div>
          <div className="flex gap-2">
            <AppButton
              variant="outline"
              tone="neutral"
              onClick={onClose}
              disabled={exporting}
            >
              Annulla
            </AppButton>
            <AppButton loading={exporting} onClick={handleExport}>
              Esporta
            </AppButton>
          </div>
        </div>
      }
      disableClose={exporting}
    >
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        {activeBaseFilters.length ? (
          <div className="rounded-2xl border border-stroke bg-gray-1/70 p-4 text-sm text-dark/75 dark:border-dark-3 dark:bg-dark-2/40 dark:text-white/75">
            L'export parte gia' dalla list corrente: {activeBaseFilters.join(" / ")}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <AppSelect
            label="Formato"
            value={format}
            onChange={(value) => setFormat(value as ExportFormat)}
            options={formatOptions}
          />

          <div className="rounded-2xl border border-stroke bg-white/60 p-4 text-sm text-dark/70 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/70">
            L'ordinamento per data e i filtri data/select vengono applicati localmente all'insieme restituito dalle API list e reference.
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-dark dark:text-white">Campi da esportare</h3>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Seleziona i campi base. Per i riferimenti puoi anche scegliere quali campi del record collegato esplodere nel file.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {allFieldKeys.map((fieldKey) => {
              const fieldDef = def.fields[fieldKey];
              const checked = selectedFields.includes(fieldKey);
              const targetPlan = referencePlans.find((plan) => plan.fieldKey === fieldKey);

              return (
                <div
                  key={String(fieldKey)}
                  className="rounded-2xl border border-stroke bg-white/60 p-4 dark:border-dark-3 dark:bg-gray-dark/40"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-stroke accent-primary"
                      checked={checked}
                      onChange={() => toggleField(fieldKey)}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-dark dark:text-white">{fieldDef.label}</div>
                      <div className="text-xs uppercase tracking-wide text-dark/45 dark:text-white/45">
                        {fieldDef.type}
                      </div>
                    </div>
                  </label>

                  {checked && targetPlan ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-3 dark:bg-primary/10">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                        Campi del riferimento
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(Object.keys(targetPlan.targetDef.fields) as FieldKey[]).map((nestedKey) => (
                          <label
                            key={`${String(fieldKey)}-${String(nestedKey)}`}
                            className="flex cursor-pointer items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-dark dark:bg-gray-dark/40 dark:text-white"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-stroke accent-primary"
                              checked={(referenceExpansions[fieldKey] ?? []).includes(nestedKey)}
                              onChange={() => toggleReferenceNestedField(fieldKey, nestedKey)}
                            />
                            <span className="min-w-0 truncate">
                              {targetPlan.targetDef.fields[nestedKey]?.label ?? nestedKey}
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
        </section>

        {dateFields.length ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-dark dark:text-white">Date</h3>
              <p className="text-sm text-dark/60 dark:text-white/60">
                Puoi limitare l'export a un intervallo e, se vuoi, ordinare il file in base a una data configurata.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AppSelect
                label="Campo data per intervallo"
                value={dateFilterField}
                onChange={setDateFilterField}
                options={dateFieldOptions}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <AppInput
                  label="Da"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <AppInput
                  label="A"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              <AppSelect
                label="Ordina per data"
                value={dateSortField}
                onChange={setDateSortField}
                options={dateSortOptions}
              />

              <AppSelect
                label="Direzione ordinamento"
                value={dateSortDir}
                onChange={(value) => setDateSortDir(value as "asc" | "desc")}
                options={sortDirOptions}
                disabled={!dateSortField}
              />
            </div>
          </section>
        ) : null}

        {selectFields.length ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-dark dark:text-white">Filtri select</h3>
              <p className="text-sm text-dark/60 dark:text-white/60">
                Per ogni campo select puoi scegliere uno stato preciso da esportare.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {selectFields.map((fieldKey) => {
                const fieldDef = def.fields[fieldKey];
                const options = [
                  { value: "", label: "Tutti" },
                  ...(fieldDef.options ?? []).map(([value, label]) => ({ value, label })),
                ];

                return (
                  <AppSelect
                    key={String(fieldKey)}
                    label={fieldDef.label}
                    value={selectFilters[fieldKey] ?? ""}
                    onChange={(value) => updateSelectFilter(fieldKey, value)}
                    options={options}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {!dateFields.length && !selectFields.length ? (
          <AppField
            label="Filtri speciali"
            hint="Questo tipo di anagrafica non espone campi date/select nel catalogo corrente."
          >
            <div className="rounded-2xl border border-stroke bg-white/60 px-4 py-3 text-sm text-dark/65 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/65">
              L'export resta disponibile sui campi scelti, ma senza filtri aggiuntivi configurati.
            </div>
          </AppField>
        ) : null}
      </div>
    </AppModal>
  );
}
