"use client";

import React from "react";
import type { FieldDef } from "@/config/anagrafiche.fields.catalog";
import type { FieldOverride } from "@/server-utils/models/variantConfig.schema";

function isFiniteNumber(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function asNumber(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function asDate(raw: any): Date | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatRelative(d: Date) {
  const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);

  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  const diffYear = Math.round(diffMonth / 12);
  return rtf.format(diffYear, "year");
}

function formatNumber(
  raw: any,
  ov?: FieldOverride,
): string {
  const n = asNumber(raw);
  if (n === null) return "—";

  const format = ov?.format ?? "plain";

  // percent basis
  if (format === "percent") {
    const basis = ov?.percentBasis ?? "whole";
    const value = basis === "fraction" ? n : n / 100;
    const nf = new Intl.NumberFormat("it", {
      style: "percent",
      maximumFractionDigits: ov?.decimals ?? 2,
      minimumFractionDigits: ov?.decimals ?? 0,
    });
    return nf.format(value);
  }

  // currency
  if (format === "currency") {
    const currency = ov?.currency ?? "EUR";
    const nf = new Intl.NumberFormat("it", {
      style: "currency",
      currency,
      maximumFractionDigits: ov?.decimals ?? 2,
      minimumFractionDigits: ov?.decimals ?? 2,
    });
    return nf.format(n);
  }

  // compact
  if (format === "compact") {
    const nf = new Intl.NumberFormat("it", {
      notation: "compact",
      maximumFractionDigits: ov?.decimals ?? 1,
      minimumFractionDigits: ov?.decimals ?? 0,
    });
    const base = nf.format(n);
    if (ov?.unit?.value) {
      return ov.unit.kind === "prefix"
        ? `${ov.unit.value} ${base}`
        : `${base} ${ov.unit.value}`;
    }
    return base;
  }

  // integer/decimal/plain
  const maxFrac =
    format === "integer" ? 0 : (ov?.decimals ?? (format === "decimal" ? 2 : 2));
  const minFrac =
    format === "integer" ? 0 : (ov?.decimals ?? 0);

  const nf = new Intl.NumberFormat("it", {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: minFrac,
  });

  const base = nf.format(n);

  if (ov?.unit?.value) {
    return ov.unit.kind === "prefix"
      ? `${ov.unit.value} ${base}`
      : `${base} ${ov.unit.value}`;
  }

  return base;
}

function formatDateTime(
  raw: any,
  ov?: FieldOverride,
): string {
  const d = asDate(raw);
  if (!d) return "—";

  const format = ov?.format ?? "date";

  if (format === "iso") return d.toISOString();
  if (format === "relative") return formatRelative(d);

  if (format === "time") {
    return new Intl.DateTimeFormat("it", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  if (format === "datetime") {
    return new Intl.DateTimeFormat("it", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  if (format === "monthYear") {
    return new Intl.DateTimeFormat("it", {
      year: "numeric",
      month: "2-digit",
    }).format(d);
  }

  // default: date
  return new Intl.DateTimeFormat("it", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function renderText(raw: any, ov?: FieldOverride): React.ReactNode {
  if (raw === null || raw === undefined || raw === "") return "—";
  const s = String(raw);

  const format = ov?.format ?? "text";

  if (format === "longtext") {
    return <span className="whitespace-pre-line">{s}</span>;
  }

  if (format === "label") {
    // non cambiamo “design” globale: è solo un badge leggero
    return (
      <span className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
        {s}
      </span>
    );
  }

  if (format === "link") {
    const href = s.startsWith("http") ? s : `https://${s}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-light"
      >
        {s}
      </a>
    );
  }

  if (format === "email") {
    return (
      <a
        href={`mailto:${s}`}
        className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-light"
      >
        {s}
      </a>
    );
  }

  if (format === "phone") {
    return (
      <a
        href={`tel:${s}`}
        className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-light"
      >
        {s}
      </a>
    );
  }

  return s;
}

function renderBoolean(raw: any): React.ReactNode {
  if (raw === null || raw === undefined || raw === "") return "—";

  const normalized =
    typeof raw === "boolean"
      ? raw
      : typeof raw === "string"
        ? raw.trim().toLowerCase() === "true"
        : Boolean(raw);

  return (
    <span className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
      {normalized ? "Sì" : "No"}
    </span>
  );
}

function selectLabel(fieldDef: FieldDef, raw: any): string {
  const value = String(raw ?? "");
  if (!value) return "";
  const opt = fieldDef.options?.find(([optValue]) => optValue === value);
  return opt ? opt[1] : value;
}

function renderStringArray(values: string[]): React.ReactNode {
  if (!values.length) return "—";

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {values.map((value, index) => (
        <span
          key={`${value}__${index}`}
          className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function renderRangeNumber(raw: any): string {
  if (!raw || typeof raw !== "object") return "—";
  const from = asNumber((raw as any).from);
  const to = asNumber((raw as any).to);
  if (from === null || to === null) return "—";
  return `${formatNumber(from)} - ${formatNumber(to)}`;
}

function renderRangeDate(raw: any): string {
  if (!raw || typeof raw !== "object") return "—";
  const start = asDate((raw as any).start);
  const end = asDate((raw as any).end);
  if (!start || !end) return "—";
  return `${formatDateTime(start, { kind: "datetime", format: "date" } as any)} - ${formatDateTime(end, { kind: "datetime", format: "date" } as any)}`;
}

function renderGeoPoint(raw: any): string {
  if (!raw || typeof raw !== "object") return "—";
  const lat = asNumber((raw as any).lat);
  const lng = asNumber((raw as any).lng);
  if (lat === null || lng === null) return "—";
  return `${lat}, ${lng}`;
}

function renderPairNumber(raw: any): string {
  if (!raw || typeof raw !== "object") return "—";
  const a = asNumber((raw as any).a);
  const b = asNumber((raw as any).b);
  if (a === null || b === null) return "—";
  return `${formatNumber(a)} × ${formatNumber(b)}`;
}

function renderLabelValuePairs(raw: any): React.ReactNode {
  if (!Array.isArray(raw) || raw.length === 0) return "—";

  const rows = raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: String((item as any).label ?? "").trim(),
      value: String((item as any).value ?? "").trim(),
    }))
    .filter((item) => item.label && item.value);

  if (!rows.length) return "—";

  return (
    <div className="flex flex-col items-center gap-1">
      {rows.map((row, index) => (
        <div key={`${row.label}__${index}`} className="text-center">
          <span className="text-dark/60 dark:text-white/60">{row.label}: </span>
          <span className="font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderKeyValueNumber(raw: any): React.ReactNode {
  if (!Array.isArray(raw) || raw.length === 0) return "—";

  const rows = raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      key: String((item as any).key ?? "").trim(),
      value: asNumber((item as any).value),
    }))
    .filter((item) => item.key && item.value !== null) as Array<{ key: string; value: number }>;

  if (!rows.length) return "—";

  return (
    <div className="flex flex-col items-center gap-1">
      {rows.map((row, index) => (
        <div key={`${row.key}__${index}`} className="text-center">
          <span className="text-dark/60 dark:text-white/60">{row.key}: </span>
          <span className="font-medium">{formatNumber(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderAddress(raw: any): React.ReactNode {
  if (!raw || typeof raw !== "object") return "—";

  const parts = [
    String((raw as any).street ?? "").trim(),
    String((raw as any).extra ?? "").trim(),
    [String((raw as any).zip ?? "").trim(), String((raw as any).city ?? "").trim()].filter(Boolean).join(" "),
    String((raw as any).province ?? "").trim(),
    String((raw as any).country ?? "").trim(),
  ].filter(Boolean);

  if (!parts.length) return "—";

  return <span className="whitespace-pre-line">{parts.join("\n")}</span>;
}

export function formatFieldValue(
  raw: any,
  fieldDef: FieldDef,
  override?: FieldOverride,
): React.ReactNode {
  // fallback vecchio comportamento
  if (raw === null || raw === undefined || raw === "") return "—";

  // override decide la famiglia
  const kind = override?.kind;

  if (kind === "number") return formatNumber(raw, override);
  if (kind === "datetime") return formatDateTime(raw, override);
  if (kind === "text") return renderText(raw, override);

  // se non c'è override, deduco dal fieldDef
  if (fieldDef.type === "number") return formatNumber(raw, override);
  if (fieldDef.type === "date") return formatDateTime(raw, { ...override, format: override?.format ?? "date", kind: "datetime" });
  if (fieldDef.type === "textarea") return renderText(raw, { ...override, format: override?.format ?? "longtext", kind: "text" });
  if (fieldDef.type === "select") return selectLabel(fieldDef, raw);
  if (fieldDef.type === "boolean") return renderBoolean(raw);
  if (fieldDef.type === "multiselect") {
    const labels = Array.isArray(raw)
      ? raw
        .map((value) => selectLabel(fieldDef, value))
        .filter(Boolean)
      : [];
    return renderStringArray(labels);
  }
  if (fieldDef.type === "labelArray") {
    const labels = Array.isArray(raw)
      ? raw
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
    return renderStringArray(labels);
  }
  if (fieldDef.type === "numberArray") {
    const values = Array.isArray(raw)
      ? raw.map((value) => formatNumber(value)).filter(Boolean)
      : [];
    return renderStringArray(values);
  }
  if (fieldDef.type === "rangeNumber") return renderRangeNumber(raw);
  if (fieldDef.type === "rangeDate") return renderRangeDate(raw);
  if (fieldDef.type === "geoPoint") return renderGeoPoint(raw);
  if (fieldDef.type === "geoPointArray") {
    const values = Array.isArray(raw)
      ? raw.map((item) => renderGeoPoint(item)).filter((item) => item !== "—")
      : [];
    return renderStringArray(values);
  }
  if (fieldDef.type === "pairNumber") return renderPairNumber(raw);
  if (fieldDef.type === "labelValuePairs") return renderLabelValuePairs(raw);
  if (fieldDef.type === "keyValueNumber") return renderKeyValueNumber(raw);
  if (fieldDef.type === "address") return renderAddress(raw);

  // per text/tel/email ecc: se vuoi, puoi anche mappare automaticamente
  if (fieldDef.type === "email") return renderText(raw, { ...override, kind: "text", format: override?.format ?? "email" });
  if (fieldDef.type === "tel") return renderText(raw, { ...override, kind: "text", format: override?.format ?? "phone" });

  return String(raw);
}
