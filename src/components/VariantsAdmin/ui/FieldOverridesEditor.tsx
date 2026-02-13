"use client";

import type { FieldOverride, DisplayKind } from "../types";
import { FIELD_CATALOG } from "@/config/anagrafiche.fields.catalog";

function inferKind(fieldKey: string): DisplayKind {
  const def = (FIELD_CATALOG as any)?.[fieldKey];
  const t = def?.type;

  if (t === "number") return "number";
  if (t === "date") return "datetime";
  if (t === "email" || t === "tel" || t === "textarea" || t === "text") return "text";
  if (t === "select") return "text";
  if (t === "reference") return "reference";
  return "text";
}

const numberFormats = ["plain", "integer", "decimal", "compact", "currency", "percent"] as const;
const datetimeFormats = ["date", "time", "datetime", "monthYear", "relative", "iso"] as const;
const textFormats = ["text", "longtext", "label", "link", "email", "phone"] as const;

export default function FieldOverridesEditor({
                                               fieldKey,
                                               value,
                                               onChange,
                                             }: {
  fieldKey: string;
  value?: FieldOverride;
  onChange: (next?: FieldOverride) => void;
}) {
  const baseKind = inferKind(fieldKey);
  const label = (FIELD_CATALOG as any)?.[fieldKey]?.label || fieldKey;

  const current = value;
  const enabled = !!current;

  const formats =
    baseKind === "number"
      ? numberFormats
      : baseKind === "datetime"
        ? datetimeFormats
        : baseKind === "reference"
          ? (["reference"] as const)
          : textFormats;

  function toggle(on: boolean) {
    if (!on) return onChange(undefined);
    onChange({ kind: baseKind, format: formats[0] });
  }

  function setFormat(f: string) {
    if (!current) return;
    const next: FieldOverride = { ...current, kind: baseKind, format: f as any };

    // pulizie minime
    if (next.kind !== "number") {
      delete next.unit;
      delete next.decimals;
      delete next.percentBasis;
      delete next.currency;
    }

    if (next.kind === "number" && next.format !== "percent") delete next.percentBasis;
    if (next.kind === "number" && next.format !== "currency") delete next.currency;

    onChange(next);
  }

  return (
    <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-dark dark:text-white">
            {label}
          </div>
          <div className="truncate text-[11px] text-dark/60 dark:text-white/60 font-mono">
            {fieldKey} · kind: {baseKind}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-dark dark:text-white">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
          />
          Override
        </label>
      </div>

      {enabled && current ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-dark dark:text-white">
            Formato
            <select
              className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              value={String(current.format)}
              onChange={(e) => setFormat(e.target.value)}
            >
              {formats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-dark dark:text-white">
            Label UI (opzionale)
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              value={current.label ?? ""}
              onChange={(e) => onChange({ ...current, label: e.target.value || undefined })}
              placeholder={label}
            />
          </label>

          {/* NUMBER extras */}
          {baseKind === "number" ? (
            <>
              <label className="text-xs text-dark dark:text-white">
                Decimali
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  value={current.decimals ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value);
                    onChange({ ...current, decimals: v });
                  }}
                />
              </label>

              <label className="text-xs text-dark dark:text-white">
                Unità (prefisso/suffisso)
                <div className="mt-1 grid grid-cols-[120px,1fr] gap-2">
                  <select
                    className="w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    value={current.unit?.kind ?? ""}
                    onChange={(e) => {
                      const kind = e.target.value as any;
                      if (!kind) return onChange({ ...current, unit: undefined });
                      onChange({ ...current, unit: { kind, value: current.unit?.value ?? "" } });
                    }}
                  >
                    <option value="">(none)</option>
                    <option value="prefix">prefix</option>
                    <option value="suffix">suffix</option>
                  </select>

                  <input
                    className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                    value={current.unit?.value ?? ""}
                    onChange={(e) => {
                      if (!current.unit) return;
                      onChange({ ...current, unit: { ...current.unit, value: e.target.value } });
                    }}
                    placeholder='es. "€" o "kg"'
                    disabled={!current.unit}
                  />
                </div>
              </label>

              {current.format === "percent" ? (
                <label className="text-xs text-dark dark:text-white">
                  percentBasis
                  <select
                    className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    value={current.percentBasis ?? "whole"}
                    onChange={(e) =>
                      onChange({ ...current, percentBasis: e.target.value as any })
                    }
                  >
                    <option value="whole">whole (15 → 15%)</option>
                    <option value="fraction">fraction (0.15 → 15%)</option>
                  </select>
                </label>
              ) : null}

              {current.format === "currency" ? (
                <label className="text-xs text-dark dark:text-white">
                  Currency (ISO)
                  <input
                    className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                    value={current.currency ?? ""}
                    onChange={(e) =>
                      onChange({ ...current, currency: e.target.value || undefined })
                    }
                    placeholder="EUR"
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
