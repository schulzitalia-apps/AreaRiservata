// src/components/Anagrafiche/variants/useAnagraficaVariants.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiListVariants, type VariantConfigDTO, type FieldOverride } from "./api";

export type VariantOption = { variantId: string; label: string };

export function useAnagraficaVariants(type: string, enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<VariantConfigDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await apiListVariants(type);
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Errore caricamento varianti");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, enabled]);

  const options: VariantOption[] = useMemo(() => {
    const base: VariantOption[] = [{ variantId: "default", label: "Default" }];
    const rest = items.map((v) => ({ variantId: v.variantId, label: v.label || v.variantId }));
    return [...base, ...rest];
  }, [items]);

  const byId = useMemo(() => {
    const m = new Map<string, VariantConfigDTO>();
    for (const v of items) m.set(v.variantId, v);
    return m;
  }, [items]);

  return { loading, error, items, options, byId, reload: load };
}

/* ------------------------------------------------------------------ */
/*                    DISPLAY FORMATTER (viewer)                      */
/* ------------------------------------------------------------------ */

export function formatValueWithOverride(args: {
  raw: any;
  fieldType: string; // "text" | "number" | "date" | ... (dal tuo FieldDef)
  override?: FieldOverride;
  locale?: string;
}): string {
  const { raw, fieldType, override, locale = "it-IT" } = args;

  if (raw === null || raw === undefined || raw === "") return "—";

  // reference la gestisci già con ReferencePill: qui non tocco
  if (fieldType === "reference") return String(raw);

  // ✅ se non c’è override → fallback attuale (minimo indispensabile)
  if (!override) {
    if (fieldType === "date") return new Date(raw).toLocaleDateString(locale);
    return String(raw);
  }

  // ------------------------------------------------
  // NUMBER
  // ------------------------------------------------
  if (override.kind === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);

    const decimals =
      typeof override.decimals === "number" && Number.isFinite(override.decimals)
        ? override.decimals
        : undefined;

    const unitPrefix = override.unit?.kind === "prefix" ? override.unit.value : "";
    const unitSuffix = override.unit?.kind === "suffix" ? override.unit.value : "";

    if (override.format === "percent") {
      const basis = override.percentBasis || "whole";
      const value = basis === "fraction" ? n * 100 : n;
      const nf = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      });
      return `${unitPrefix}${nf.format(value)}${unitSuffix || "%"}`;
    }

    if (override.format === "currency") {
      const currency = override.currency || "EUR";
      const nf = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
      // se vuoi forzare "€" come unit prefix, lo fai con unit, ma di solito basta Intl.
      const formatted = nf.format(n);
      return `${unitPrefix}${formatted}${unitSuffix}`;
    }

    if (override.format === "compact") {
      const nf = new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: decimals ?? 1,
      });
      return `${unitPrefix}${nf.format(n)}${unitSuffix}`;
    }

    if (override.format === "integer") {
      const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
      return `${unitPrefix}${nf.format(Math.round(n))}${unitSuffix}`;
    }

    if (override.format === "decimal") {
      const nf = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
      return `${unitPrefix}${nf.format(n)}${unitSuffix}`;
    }

    // plain
    const nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 6,
    });
    return `${unitPrefix}${nf.format(n)}${unitSuffix}`;
  }

  // ------------------------------------------------
  // DATETIME
  // ------------------------------------------------
  if (override.kind === "datetime") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);

    switch (override.format) {
      case "time":
        return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      case "datetime":
        return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
      case "monthYear":
        return d.toLocaleDateString(locale, { month: "2-digit", year: "numeric" });
      case "iso":
        return d.toISOString();
      case "relative": {
        const diff = Date.now() - d.getTime();
        const s = Math.round(diff / 1000);
        const m = Math.round(s / 60);
        const h = Math.round(m / 60);
        const days = Math.round(h / 24);
        if (Math.abs(s) < 60) return `${s} sec`;
        if (Math.abs(m) < 60) return `${m} min`;
        if (Math.abs(h) < 24) return `${h} ore`;
        return `${days} giorni`;
      }
      case "date":
      default:
        return d.toLocaleDateString(locale);
    }
  }

  // ------------------------------------------------
  // TEXT
  // ------------------------------------------------
  if (override.kind === "text") {
    // qui “format” è un hint UI. Nel viewer puoi decidere se applicare qualcosa.
    // Per ora: ritorno stringa pulita.
    return String(raw);
  }

  return String(raw);
}
