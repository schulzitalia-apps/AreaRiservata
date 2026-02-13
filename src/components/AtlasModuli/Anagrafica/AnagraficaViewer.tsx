// src/components/Anagrafiche/AnagraficaViewer.tsx
"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAnagrafica } from "@/components/Store/slices/anagraficheSlice";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import {
  isReferenceField,
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

import {
  useReferenceBatchPreviewMulti,
  type ReferenceBatchEntry,
} from "@/components/AtlasModuli/common/useReferenceBatchPreview";

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

function normId(x: string) {
  return String(x || "").trim().toLowerCase();
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

  const [selectedVariantId, setSelectedVariantId] = useState<string>("default");

  // inizializza selector dalla scheda (se presente)
  useEffect(() => {
    const v = (selected as any)?.data?.variantId;
    if (typeof v === "string" && v.trim()) setSelectedVariantId(v.trim());
    else setSelectedVariantId("default");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(selected as any)?.id]);

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

  const variantOptions = useMemo(() => {
    const base = hasDefaultDb
      ? [{ variantId: "default", label: variantById.get("default")?.label || "Default" }]
      : [{ variantId: "default", label: "Default" }];

    const rest = variants
      .filter((v) => normId(v.variantId) !== "default")
      .map((v) => ({ variantId: v.variantId, label: v.label || v.variantId }));

    const seen = new Set<string>();
    const out: { variantId: string; label: string }[] = [];
    for (const o of [...base, ...rest]) {
      const k = normId(o.variantId);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(o);
    }
    return out;
  }, [variants, hasDefaultDb, variantById]);

  const activeVariant = useMemo(() => {
    const vId = normId(selectedVariantId);
    return variantById.get(vId) || null;
  }, [selectedVariantId, variantById]);

  const visibleKeys = useMemo(() => {
    const allKeys = Object.keys(def.fields || {});
    const allNoVariant = allKeys.filter((k) => normId(k) !== "variantid");

    const vId = normId(selectedVariantId);

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
  }, [def.fields, selectedVariantId, hasDefaultDb, activeVariant]);

  const keys = useMemo(() => visibleKeys as FieldKey[], [visibleKeys]);

  const displayName = useMemo(() => {
    const vals = def.preview.title
      .map((k) => (selected as any)?.data?.[k] ?? "")
      .filter(Boolean);
    return vals.join(" ") || "(senza titolo)";
  }, [def.preview.title, selected]);

  const visibilityLabel = (selected as any)?.visibilityRole || "Solo proprietario";

  const referenceFields = useMemo<[FieldKey, FieldDef & { type: "reference" }][]>(
    () =>
      Object.entries(def.fields)
        .filter(([, f]) => isReferenceField(f))
        .map(([k, f]) => [k as FieldKey, f as FieldDef & { type: "reference" }]),
    [def],
  );

  const referenceEntries = useMemo<ReferenceBatchEntry[]>(
    () =>
      referenceFields.map(([fieldKey, fieldDef]) => {
        const rawId = ((selected as any)?.data as any)?.[fieldKey];
        const ids = rawId ? [String(rawId)] : [];
        return {
          fieldKey,
          config: fieldDef.reference!,
          ids,
        };
      }),
    [referenceFields, selected],
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

      const ov = overrides?.[String(k)];
      const valNode = renderFormattedValue({ raw, fieldDef: fld, override: ov });

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
      {/* ✅ Selector Varianti */}
      <div className="rounded-[14px] border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-dark dark:text-white">Variante</div>
            <div className="text-xs text-dark/60 dark:text-white/60">
              Seleziona la visualizzazione (campi + formati) per questa scheda.
            </div>
            {variantsError ? (
              <div className="mt-2 text-xs text-red-600">{variantsError}</div>
            ) : null}
          </div>

          <div className="min-w-[260px]">
            <select
              className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              disabled={variantsLoading}
            >
              {variantOptions.map((v) => (
                <option key={normId(v.variantId)} value={v.variantId}>
                  {v.label} ({v.variantId})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DetailInfoCard
        title={displayName}
        loading={isLoading}
        backHref={`/anagrafiche/${type}`}
        editHref={`/anagrafiche/${type}/${id}/edit`}
        canEdit={canEdit}
        pills={
          <>
            <InfoPill tone="success">Tipo: {def.label}</InfoPill>
            <InfoPill tone="rose">Visibilità: {visibilityLabel}</InfoPill>
          </>
        }
        fields={infoFields}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        headerActions={
          !isLoading && (
            <button
              type="button"
              onClick={handleOpenCalendarPopup}
              className="
                inline-flex items-center gap-2 rounded-full border border-stroke bg-white
                px-4 py-2 text-xs font-medium text-dark shadow-sm
                hover:bg-gray-2
                dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-2/80
              "
            >
              <Icons.Calendar className="h-4 w-4" />
              <span className="hidden md:inline">Calendario</span>
            </button>
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
