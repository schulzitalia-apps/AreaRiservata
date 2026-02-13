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

  // per text/tel/email ecc: se vuoi, puoi anche mappare automaticamente
  if (fieldDef.type === "email") return renderText(raw, { ...override, kind: "text", format: override?.format ?? "email" });
  if (fieldDef.type === "tel") return renderText(raw, { ...override, kind: "text", format: override?.format ?? "phone" });

  return String(raw);
}
