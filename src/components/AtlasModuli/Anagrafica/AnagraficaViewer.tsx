// src/components/Anagrafiche/AnagraficaViewer.tsx
"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAnagrafica } from "@/components/Store/slices/anagraficheSlice";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import {
  isReferenceField,
  isReferenceMultiField,
  type FieldKey,
  type FieldDef,
} from "@/config/anagrafiche.fields.catalog";

import {
  DetailInfoCard,
  type DetailField,
} from "@/components/AtlasModuli/common/DetailInfoCard";
import {
  AttachmentsPanel,
  type AttachmentViewItem,
} from "@/components/AtlasModuli/common/AttachmentsPanel";

import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import { ReferencePill } from "@/components/AtlasModuli/common/ReferencePreviewCell";
import { StaticGeoMapPanel } from "@/components/AtlasModuli/common/maps/StaticGeoMapPanel";

import {
  useReferenceBatchPreviewMulti,
  type ReferenceBatchEntry,
} from "@/components/AtlasModuli/common/useReferenceBatchPreview";
import { formatFieldValue as formatDisplayFieldValue } from "@/components/AtlasModuli/common/FormatFieldValue";

import { useCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

// 🔔 icone
import { Icons } from "@/components/AtlasModuli/common/icons";

// ✅ modal stats
import { AnagraficaFieldStatsModal } from "@/components/AtlasModuli/Anagrafica/Insights/AnagraficaFieldStatsModal";

type VariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  includeFields: string[];
  fieldOverrides: Record<string, FieldOverride>;
  createdAt: string;
  updatedAt: string;
};

type UnitSpec = { kind: "prefix" | "suffix"; value: string };

type FieldOverride = {
  kind: "number" | "datetime" | "text" | "reference";
  format:
    | "plain"
    | "integer"
    | "decimal"
    | "compact"
    | "currency"
    | "percent"
    | "date"
    | "time"
    | "datetime"
    | "monthYear"
    | "relative"
    | "iso"
    | "text"
    | "longtext"
    | "label"
    | "link"
    | "email"
    | "phone"
    | "reference";
  unit?: UnitSpec;
  decimals?: number;
  percentBasis?: "whole" | "fraction";
  currency?: string;
  label?: string;
};

type StatsModalState =
  | null
  | {
  fieldKey: string;
  fieldLabel: string;
  pivot: string | number;
};

function buildCollectionPreview(count: number, noun = "elementi") {
  return (
    <span className="inline-flex rounded-full border border-emerald-400/45 bg-emerald-400/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
      {count} {noun}
    </span>
  );
}

function buildExpandablePreview(_firstLabel: string, othersCount: number) {
  return buildCollectionPreview(othersCount + 1);
}

function normId(x: string) {
  return String(x || "").trim().toLowerCase();
}

function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

async function fetchVariants(type: string): Promise<VariantConfigDTO[]> {
  const res = await fetch(`/api/anagrafiche/${encodeURIComponent(type)}/variants`, {
    method: "GET",
    credentials: "include",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || "Errore caricamento varianti");
  }
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

function applyUnit(str: string, unit?: UnitSpec) {
  if (!unit?.value) return str;
  return unit.kind === "prefix" ? `${unit.value}${str}` : `${str}${unit.value}`;
}

function formatRelative(date: Date, locale = "it-IT") {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const abs = Math.abs(diffMs);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < hour) {
    const m = Math.round(diffMs / minute);
    return rtf.format(m, "minute");
  }
  if (abs < day) {
    const h = Math.round(diffMs / hour);
    return rtf.format(h, "hour");
  }
  const d = Math.round(diffMs / day);
  return rtf.format(d, "day");
}

function renderFormattedValue(args: {
  raw: any;
  fieldDef: FieldDef;
  override?: FieldOverride;
  locale?: string;
}) {
  const { raw, fieldDef, override, locale = "it-IT" } = args;

  if (raw === null || raw === undefined || raw === "") return "—";

  // reference gestite fuori (pill)
  if (isReferenceField(fieldDef)) return String(raw);

  // fallback base per date
  if (!override) {
    if (fieldDef.type === "date") return new Date(raw).toLocaleDateString(locale);
    return String(raw);
  }

  // TEXT
  if (override.kind === "text") {
    const s = String(raw);

    if (override.format === "email") {
      return (
        <a className="text-primary underline" href={`mailto:${s}`}>
          {s}
        </a>
      );
    }
    if (override.format === "phone") {
      return (
        <a className="text-primary underline" href={`tel:${s}`}>
          {s}
        </a>
      );
    }
    if (override.format === "link") {
      const href = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
      return (
        <a className="text-primary underline" href={href} target="_blank" rel="noreferrer">
          {s}
        </a>
      );
    }
    if (override.format === "label") {
      return (
        <span className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-semibold text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
          {s}
        </span>
      );
    }
    // longtext/text: lasciamo stringa (DetailInfoCard gestisce già layout)
    return s;
  }

  // DATETIME
  if (override.kind === "datetime") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);

    if (override.format === "iso") return d.toISOString();
    if (override.format === "relative") return formatRelative(d, locale);

    if (override.format === "time")
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);

    if (override.format === "monthYear")
      return new Intl.DateTimeFormat(locale, { month: "2-digit", year: "numeric" }).format(d);

    if (override.format === "datetime")
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);

    // default "date"
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }

  // NUMBER
  if (override.kind === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);

    const decimals =
      typeof override.decimals === "number" && Number.isFinite(override.decimals)
        ? override.decimals
        : undefined;

    if (override.format === "currency") {
      const currency = override.currency || "EUR";
      const fmt = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: decimals ?? 2,
        minimumFractionDigits: decimals ?? 2,
      }).format(n);
      // unit opzionale (se vuoi forzare simbolo/prefisso custom)
      return applyUnit(fmt, override.unit);
    }

    if (override.format === "compact") {
      const fmt = new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: decimals ?? 1,
      }).format(n);
      return applyUnit(fmt, override.unit);
    }

    if (override.format === "percent") {
      const basis = override.percentBasis || "whole";
      const forIntl = basis === "fraction" ? n : n / 100;
      const fmt = new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: decimals ?? 0,
      }).format(forIntl);
      return applyUnit(fmt, override.unit);
    }

    if (override.format === "integer") {
      const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
      return applyUnit(fmt, override.unit);
    }

    if (override.format === "decimal") {
      const fmt = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      }).format(n);
      return applyUnit(fmt, override.unit);
    }

    // plain
    const fmt = new Intl.NumberFormat(locale, {
      maximumFractionDigits: decimals ?? 20,
    }).format(n);
    return applyUnit(fmt, override.unit);
  }

  return String(raw);
}

function GeoViewerActions({
  geoPoint,
}: {
  geoPoint: { lat: number; lng: number };
}) {
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const navigationHref = useMemo(
    () =>
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${geoPoint.lat},${geoPoint.lng}`,
      )}&travelmode=driving`,
    [geoPoint],
  );

  const handleDistance = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDistanceError("Geolocalizzazione non disponibile su questo dispositivo.");
      return;
    }

    setDistanceLoading(true);
    setDistanceError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const km = haversineDistanceKm(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          geoPoint,
        );
        setDistanceLabel(km < 1 ? `${Math.round(km * 1000)} m da te` : `${km.toFixed(1)} km da te`);
        setDistanceLoading(false);
      },
      () => {
        setDistanceError("Impossibile leggere la tua posizione.");
        setDistanceLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDistance}
        className="rounded-full border border-emerald-400/35 bg-emerald-400/[0.08] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400/[0.14]"
      >
        {distanceLoading ? "Calcolo distanza..." : "Distanza da me"}
      </button>
      <a
        href={navigationHref}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-stroke px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.05] dark:border-dark-3"
      >
        Apri navigazione
      </a>
      {distanceLabel ? <span className="text-xs text-dark/60 dark:text-white/60">{distanceLabel}</span> : null}
      {distanceError ? <span className="text-xs text-red-400">{distanceError}</span> : null}
    </div>
  );
}

export default function AnagraficaViewer({
                                           type,
                                           id,
                                         }: {
  type: string;
  id: string;
}) {
  const def = getAnagraficaDef(type);
  const dispatch = useAppDispatch();

  const { canEdit } = useCrudPermissions(type as AnagraficaTypeSlug);

  const selected = useAppSelector((s) => s.anagrafiche.byType[type]?.selected);

  useEffect(() => {
    if (id) dispatch(fetchAnagrafica({ type, id }));
  }, [dispatch, type, id]);

  const isLoading = !selected || (selected as any).id !== id;

  // Variants (viewer)
  const [variants, setVariants] = useState<VariantConfigDTO[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setVariantsLoading(true);
      setVariantsError(null);
      try {
        const list = await fetchVariants(type);
        if (!alive) return;

        const defaultDb = list.find((v) => normId(v.variantId) === "default") || null;
        const rest = list.filter((v) => normId(v.variantId) !== "default");

        const merged = (() => {
          const seen = new Set<string>();
          const out: VariantConfigDTO[] = [];
          for (const v of (defaultDb ? [defaultDb, ...rest] : rest)) {
            const k = normId(v.variantId);
            if (!k || seen.has(k)) continue;
            seen.add(k);
            out.push(v);
          }
          return out;
        })();

        setVariants(merged);
      } catch (e: any) {
        if (!alive) return;
        setVariantsError(e?.message || "Errore caricamento varianti");
        setVariants([]);
      } finally {
        if (!alive) return;
        setVariantsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [type]);

  const variantById = useMemo(() => {
    const m = new Map<string, VariantConfigDTO>();
    for (const v of variants) m.set(normId(v.variantId), v);
    return m;
  }, [variants]);

  const hasDefaultDb = useMemo(() => variantById.has("default"), [variantById]);

  const recordVariantId = useMemo(() => {
    const rawVariant = (selected as any)?.data?.variantId;
    return typeof rawVariant === "string" && rawVariant.trim() ? rawVariant.trim() : "default";
  }, [selected]);

  const activeVariant = useMemo(() => {
    const vId = normId(recordVariantId);
    return variantById.get(vId) || null;
  }, [recordVariantId, variantById]);

  const activeVariantLabel = useMemo(() => {
    if (activeVariant?.label?.trim()) return activeVariant.label.trim();
    if (normId(recordVariantId) === "default") {
      return hasDefaultDb ? variantById.get("default")?.label || "Default" : "Default";
    }
    return recordVariantId;
  }, [activeVariant, recordVariantId, hasDefaultDb, variantById]);

  const visibleKeys = useMemo(() => {
    const allKeys = Object.keys(def.fields || {});
    const allNoVariant = allKeys.filter((k) => normId(k) !== "variantid");

    const vId = normId(recordVariantId);

    if (vId === "default" && !hasDefaultDb) {
      return allNoVariant;
    }

    if (!activeVariant) return allNoVariant;

    const inc = (activeVariant.includeFields || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .filter((k) => normId(k) !== "variantid");

    if (inc.length === 0) return allNoVariant;

    const allowed = new Set(allNoVariant);
    return inc.filter((k) => allowed.has(k));
  }, [def.fields, recordVariantId, hasDefaultDb, activeVariant]);

  const keys = useMemo(() => visibleKeys as FieldKey[], [visibleKeys]);

  const displayName = useMemo(() => {
    const vals = def.preview.title
      .map((k) => (selected as any)?.data?.[k] ?? "")
      .filter(Boolean);
    return vals.join(" ") || "(senza titolo)";
  }, [def.preview.title, selected]);

  const visibilityRoles = Array.isArray((selected as any)?.visibilityRoles)
    ? ((selected as any).visibilityRoles as string[]).filter(Boolean)
    : [];
  const visibilityLabel = visibilityRoles.length > 0
    ? visibilityRoles.join(", ")
    : "Solo proprietario";

  const referenceFields = useMemo<[FieldKey, FieldDef & { type: "reference" }][]>(
    () =>
      Object.entries(def.fields)
        .filter(([, f]) => isReferenceField(f))
        .map(([k, f]) => [k as FieldKey, f as FieldDef & { type: "reference" }]),
    [def],
  );

  const referenceMultiFields = useMemo<[FieldKey, FieldDef & { type: "referenceMulti" }][]>(
    () =>
      Object.entries(def.fields)
        .filter(([, f]) => isReferenceMultiField(f))
        .map(([k, f]) => [k as FieldKey, f as FieldDef & { type: "referenceMulti" }]),
    [def],
  );

  const referenceEntries = useMemo<ReferenceBatchEntry[]>(
    () =>
      [
        ...referenceFields.map(([fieldKey, fieldDef]) => {
          const rawId = ((selected as any)?.data as any)?.[fieldKey];
          const ids = rawId ? [String(rawId)] : [];
          return {
            fieldKey,
            config: fieldDef.reference!,
            ids,
          };
        }),
        ...referenceMultiFields.map(([fieldKey, fieldDef]) => {
          const rawIds = ((selected as any)?.data as any)?.[fieldKey];
          const ids = Array.isArray(rawIds)
            ? rawIds.map((item: any) => String(item ?? "").trim()).filter(Boolean)
            : [];
          return {
            fieldKey,
            config: fieldDef.reference!,
            ids,
          };
        }),
      ],
    [referenceFields, referenceMultiFields, selected],
  );

  const referenceLabelsByField = useReferenceBatchPreviewMulti(referenceEntries);

  // ✅ stato modal stats
  const [statsModal, setStatsModal] = useState<StatsModalState>(null);

  const openStatsForField = useCallback((fieldKey: string, fieldLabel: string, pivot: string | number) => {
    setStatsModal({ fieldKey, fieldLabel, pivot });
  }, []);

  const infoFields: DetailField[] = useMemo(() => {
    const fields: DetailField[] = [];
    const overrides = (activeVariant?.fieldOverrides || {}) as Record<string, FieldOverride>;

    keys.forEach((k) => {
      const fld = def.fields[k] as FieldDef;
      const raw = (selected as any)?.data?.[k];

      // reference: pill cliccabile
      if (isReferenceField(fld)) {
        const idStr = raw ? String(raw) : null;
        const previewLabel = raw ? referenceLabelsByField[k]?.[String(raw)] ?? null : null;

        fields.push({
          id: String(k),
          label: fld.label,
          value: raw ? (
            <ReferencePill
              targetId={idStr!}
              fieldLabel={String(fld.label)}
              config={fld.reference!}
              previewLabel={previewLabel}
            />
          ) : (
            "—"
          ),
        });
        return;
      }

      if (isReferenceMultiField(fld)) {
        const ids = Array.isArray(raw)
          ? raw.map((item) => String(item ?? "").trim()).filter(Boolean)
          : [];

        fields.push({
          id: String(k),
          label: fld.label,
          value: ids.length > 0 ? referenceLabelsByField[k]?.[ids[0]] ?? ids[0] : "—",
          expandablePreview:
            ids.length > 0
              ? buildExpandablePreview(String(referenceLabelsByField[k]?.[ids[0]] ?? ids[0]), Math.max(0, ids.length - 1))
              : undefined,
          expandedContent:
            ids.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {ids.map((refId) => (
                <ReferencePill
                  key={`${String(k)}__${refId}`}
                  targetId={refId}
                  fieldLabel={String(fld.label)}
                  config={fld.reference!}
                  previewLabel={referenceLabelsByField[k]?.[refId] ?? null}
                />
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if (fld.type === "multiselect" && Array.isArray(raw)) {
        const labels = raw
          .map((value) => {
            const opt = fld.options?.find(([optionValue]) => optionValue === String(value));
            return opt?.[1] ?? String(value ?? "").trim();
          })
          .filter(Boolean);

        fields.push({
          id: String(k),
          label: fld.label,
          value: labels.length > 0 ? labels[0] : "—",
          expandablePreview:
            labels.length > 0
              ? buildExpandablePreview(String(labels[0]), Math.max(0, labels.length - 1))
              : undefined,
          expandedContent:
            labels.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {labels.map((label, index) => (
                <span
                  key={`${String(k)}__${label}__${index}`}
                  className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  {label}
                </span>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if ((fld.type === "labelArray" || fld.type === "numberArray") && Array.isArray(raw)) {
        const items = raw
          .map((value) => String(value ?? "").trim())
          .filter(Boolean);

        fields.push({
          id: String(k),
          label: fld.label,
          value: items.length > 0 ? items[0] : "—",
          expandablePreview:
            items.length > 0
              ? buildExpandablePreview(String(items[0]), Math.max(0, items.length - 1))
              : undefined,
          expandedContent:
            items.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {items.map((item, index) => (
                <span
                  key={`${String(k)}__${item}__${index}`}
                  className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                >
                  {item}
                </span>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if (fld.type === "geoPoint" && raw && typeof raw === "object") {
        const lat = String((raw as any).lat ?? "").trim();
        const lng = String((raw as any).lng ?? "").trim();
        fields.push({
          id: String(k),
          label: fld.label,
          value: lat && lng ? `${lat}, ${lng}` : "—",
        });
        return;
      }

      if (fld.type === "geoPointArray" && Array.isArray(raw)) {
        const points = raw
          .map((item) => {
            const lat = String((item as any)?.lat ?? "").trim();
            const lng = String((item as any)?.lng ?? "").trim();
            return lat && lng ? `${lat}, ${lng}` : "";
          })
          .filter(Boolean);

        fields.push({
          id: String(k),
          label: fld.label,
          value: points.length > 0 ? points[0] : "—",
          expandablePreview:
            points.length > 0 ? buildExpandablePreview(points[0], Math.max(0, points.length - 1)) : undefined,
          expandedContent:
            points.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                {points.map((point, index) => (
                  <span
                    key={`${String(k)}__${point}__${index}`}
                    className="inline-flex rounded-md border border-stroke bg-gray-2 px-2 py-1 text-[11px] font-medium text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  >
                    {point}
                  </span>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if (fld.type === "pairNumber" && raw && typeof raw === "object") {
        const a = String((raw as any).a ?? "").trim();
        const b = String((raw as any).b ?? "").trim();
        fields.push({
          id: String(k),
          label: fld.label,
          value: a && b ? `${a} × ${b}` : "â€”",
        });
        return;
      }

      if (fld.type === "labelValuePairs" && Array.isArray(raw)) {
        const rows = raw
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            label: String((item as any).label ?? "").trim(),
            value: String((item as any).value ?? "").trim(),
          }))
          .filter((item) => item.label && item.value);

        fields.push({
          id: String(k),
          label: fld.label,
          value: rows.length > 0 ? `${rows[0].label}: ${rows[0].value}` : "â€”",
          expandablePreview: rows.length > 0 ? buildCollectionPreview(rows.length) : undefined,
          expandedContent:
            rows.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                {rows.map((row, index) => (
                  <div
                    key={`${String(k)}__${row.label}__${index}`}
                    className="w-full rounded-lg border border-stroke/60 bg-white/[0.03] px-3 py-2 text-center dark:border-dark-3/60"
                  >
                    <span className="text-dark/60 dark:text-white/60">{row.label}: </span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if (fld.type === "keyValueNumber" && Array.isArray(raw)) {
        const rows = raw
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            key: String((item as any).key ?? "").trim(),
            value: (item as any).value,
          }))
          .filter((item) => item.key && item.value !== null && item.value !== undefined && item.value !== "");

        fields.push({
          id: String(k),
          label: fld.label,
          value: rows.length > 0 ? `${rows[0].key}: ${rows[0].value}` : "â€”",
          expandablePreview: rows.length > 0 ? buildCollectionPreview(rows.length) : undefined,
          expandedContent:
            rows.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                {rows.map((row, index) => (
                  <div
                    key={`${String(k)}__${row.key}__${index}`}
                    className="w-full rounded-lg border border-stroke/60 bg-white/[0.03] px-3 py-2 text-center dark:border-dark-3/60"
                  >
                    <span className="text-dark/60 dark:text-white/60">{row.key}: </span>
                    <span className="font-medium">{String(row.value)}</span>
                  </div>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      if (fld.type === "address" && raw && typeof raw === "object") {
        const street = String((raw as any).street ?? "").trim();
        const city = String((raw as any).city ?? "").trim();
        const zip = String((raw as any).zip ?? "").trim();
        const province = String((raw as any).province ?? "").trim();
        const country = String((raw as any).country ?? "").trim();
        const extra = String((raw as any).extra ?? "").trim();

        const lines = [
          street,
          extra,
          [zip, city].filter(Boolean).join(" "),
          [province, country].filter(Boolean).join(" - "),
        ].filter(Boolean);

        fields.push({
          id: String(k),
          label: fld.label,
          value: lines[0] ?? "â€”",
          expandablePreview:
            lines.length > 1 ? buildExpandablePreview(lines[0], lines.length - 1) : undefined,
          expandedContent:
            lines.length > 1 ? (
              <div className="flex flex-col items-center gap-2">
                {lines.map((line, index) => (
                  <div
                    key={`${String(k)}__${index}`}
                    className="w-full rounded-lg border border-stroke/60 bg-white/[0.03] px-3 py-2 text-center dark:border-dark-3/60"
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : undefined,
        });
        return;
      }

      const ov = overrides?.[String(k)];
      const valNode = formatDisplayFieldValue(raw, fld, ov as any);

      // stats: lasciamo come prima (pivot raw)
      const canStats =
        raw !== null &&
        raw !== undefined &&
        raw !== "" &&
        (fld.type === "select" || fld.type === "date" || fld.type === "number");

      fields.push({
        id: String(k),
        label: (ov?.label && ov.label.trim()) ? ov.label.trim() : fld.label,
        value: valNode as any,
        onClick: canStats
          ? () => {
            const pivot =
              fld.type === "number"
                ? Number(raw)
                : fld.type === "date"
                  ? String(raw)
                  : String(raw);
            openStatsForField(String(k), String(fld.label), pivot);
          }
          : undefined,
        clickable: canStats,
      });
    });

    return fields;
  }, [keys, def.fields, selected, referenceLabelsByField, openStatsForField, activeVariant]);

  const topGeoMap = useMemo(() => {
    let geoPoint: { lat: number; lng: number } | null = null;
    let sourceLabel: string | null = null;

    for (const key of keys) {
      const fieldDef = def.fields[key] as FieldDef | undefined;
      const raw = (selected as any)?.data?.[key];

      if (fieldDef?.type === "geoPoint" && raw && typeof raw === "object") {
        const lat = Number((raw as any).lat);
        const lng = Number((raw as any).lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          geoPoint = { lat, lng };
          sourceLabel = fieldDef.label;
          break;
        }
      }

      if (!geoPoint && fieldDef?.type === "geoPointArray" && Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        const lat = Number((first as any)?.lat);
        const lng = Number((first as any)?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          geoPoint = { lat, lng };
          sourceLabel = fieldDef.label;
          break;
        }
      }
    }

    if (!geoPoint) return null;

    const addressFieldKey = keys.find((key) => (def.fields[key] as FieldDef | undefined)?.type === "address");
    const addressRaw = addressFieldKey ? (selected as any)?.data?.[addressFieldKey] : null;
    const addressSummary =
      addressRaw && typeof addressRaw === "object"
        ? [
            String((addressRaw as any).street ?? "").trim(),
            [String((addressRaw as any).zip ?? "").trim(), String((addressRaw as any).city ?? "").trim()].filter(Boolean).join(" "),
            [String((addressRaw as any).province ?? "").trim(), String((addressRaw as any).country ?? "").trim()].filter(Boolean).join(" - "),
          ]
            .filter(Boolean)
            .join(", ")
        : "";

    return (
      <div className="space-y-3">
        <StaticGeoMapPanel
          geoPoint={geoPoint}
          title={sourceLabel ? `Mappa: ${sourceLabel}` : "Mappa"}
          subtitle={
            <div className="space-y-1">
              {addressSummary ? <div>{addressSummary}</div> : null}
              <div>
                geoPoint: {geoPoint.lat}, {geoPoint.lng}
              </div>
            </div>
          }
          emptyMessage="Nessuna mappa disponibile."
          heightClassName="h-[260px] md:h-[320px]"
        />
        <GeoViewerActions geoPoint={geoPoint} />
      </div>
    );
  }, [keys, def.fields, selected]);

  const attachmentItems: AttachmentViewItem[] = useMemo(() => {
    return (((selected as any)?.attachments ?? []) as any[]).map((a: any) => ({
      id: a._id,
      title: a.document?.title || `(doc ${a.documentId})`,
      href: `/api/documents/${a.documentId}/view`,
      category: a.document?.category || "altro",
      type: a.type,
      uploadedAt: a.uploadedAt ?? null,
    }));
  }, [selected]);

  const coverSrc = def.detailCard?.coverSrc ?? "/images/illustration/cover/cover-02.png";
  const avatarSrc = def.detailCard?.avatarSrc ?? "/images/illustration/avatar/avatar-02.png";
  const headerVariant = def.detailCard?.headerVariant ?? "cover-avatar";
  const avatarSize = def.detailCard?.avatarSize ?? "medium";
  const hoverEffect = def.detailCard?.hoverEffect ?? true;

  const handleOpenCalendarPopup = useCallback(() => {
    if (!id) return;

    const url = `/calendar/anagrafica-popup?type=${encodeURIComponent(type)}&id=${encodeURIComponent(
      id,
    )}&label=${encodeURIComponent(displayName)}`;

    window.open(url, "anagrafica-calendar", "width=500,height=700,noopener,noreferrer");
  }, [type, id, displayName]);

  return (
    <div className="space-y-6">
      <DetailInfoCard
        title={displayName}
        loading={isLoading}
        backHref={`/anagrafiche/${type}`}
        editHref={`/anagrafiche/${type}/${id}/edit`}
        canEdit={canEdit}
        pills={
          <>
            <InfoPill tone="success">Tipo: {def.label}</InfoPill>
            <InfoPill tone="info">Variante: {activeVariantLabel}</InfoPill>
            <InfoPill tone="rose">Visibilità: {visibilityLabel}</InfoPill>
          </>
        }
        topContent={topGeoMap}
        fields={infoFields}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        headerActions={
          !isLoading && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenCalendarPopup}
                className="
                  inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-emerald-400/[0.10]
                  px-4 py-2 text-xs font-semibold text-white shadow-[0_0_26px_rgba(16,185,129,0.16)]
                  hover:bg-emerald-400/[0.16]
                  dark:border-emerald-300/45 dark:bg-emerald-300/[0.10] dark:hover:bg-emerald-300/[0.16]
                "
              >
                <Icons.Calendar className="h-4 w-4" />
                <span className="hidden md:inline">Calendario</span>
              </button>
              {variantsLoading ? (
                <span className="text-xs text-dark/60 dark:text-white/60">Caricamento variante...</span>
              ) : null}
              {variantsError ? <span className="text-xs text-red-500">{variantsError}</span> : null}
            </div>
          )
        }
      />

      <AttachmentsPanel
        title="Allegati"
        loading={isLoading}
        items={attachmentItems}
        emptyMessage="Nessun allegato"
        viewLabel="View"
      />

      {statsModal && (
        <AnagraficaFieldStatsModal
          open={!!statsModal}
          onClose={() => setStatsModal(null)}
          type={type}
          fieldKey={statsModal.fieldKey}
          fieldLabel={statsModal.fieldLabel}
          pivot={statsModal.pivot}
          recordTitle={displayName}
        />
      )}
    </div>
  );
}
