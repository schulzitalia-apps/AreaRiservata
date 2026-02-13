// src/components/Anagrafiche/AnagraficaEdit.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchAnagrafica,
  createAnagrafica,
  updateAnagrafica,
  uploadAnagraficaAttachment,
  deleteAnagraficaAttachment,
} from "@/components/Store/slices/anagraficheSlice";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { EditForm } from "@/components/AtlasModuli/common/EditForm";
import {
  EditAttachmentsPanel,
  type EditAttachment,
} from "@/components/AtlasModuli/common/EditAttachmentsPanel";

type VariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  includeFields: string[];
  fieldOverrides: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

type VariantOption = { variantId: string; label: string };

function normId(x: string) {
  return String(x || "").trim().toLowerCase();
}

function dedupOptions(opts: VariantOption[]) {
  const seen = new Set<string>();
  const out: VariantOption[] = [];
  for (const o of opts) {
    const k = normId(o.variantId);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

async function fetchVariants(type: string): Promise<VariantConfigDTO[]> {
  const res = await fetch(
    `/api/anagrafiche/${encodeURIComponent(type)}/variants`,
    {
      method: "GET",
      credentials: "include",
      headers: { "content-type": "application/json" },
    },
  );
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.message || "Errore caricamento varianti");
  }
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

function pickFields(all: Record<string, any>, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) {
    if (k in all) out[k] = all[k];
  }
  return out;
}

export default function AnagraficaEdit({
                                         type,
                                         id,
                                       }: {
  type: string;
  id?: string;
}) {
  const dispatch = useAppDispatch();
  const def = getAnagraficaDef(type);

  // ⚠️ lo leggiamo comunque, ma in NEW lo ignoriamo
  const selected = useAppSelector((s) => s.anagrafiche.byType[type]?.selected);

  const isNew = !id;

  const [saving, setSaving] = useState(false);

  // Variants
  const [variants, setVariants] = useState<VariantConfigDTO[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState<string | null>(null);

  const [selectedVariantId, setSelectedVariantId] = useState<string>("default");

  useEffect(() => {
    if (!id) return;
    dispatch(fetchAnagrafica({ type, id }));
  }, [dispatch, type, id]);

  // ✅ set variantId iniziale
  useEffect(() => {
    if (isNew) {
      setSelectedVariantId("default");
      return;
    }

    const v = (selected as any)?.data?.variantId;
    if (typeof v === "string" && v.trim()) {
      setSelectedVariantId(v.trim());
    } else {
      setSelectedVariantId("default");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, selected?.id]);

  // carica varianti sempre (serve per selector)
  useEffect(() => {
    let alive = true;
    (async () => {
      setVariantsLoading(true);
      setVariantsError(null);
      try {
        const list = await fetchVariants(type);
        if (!alive) return;

        // preferisci default DB se esiste (e dedup case-insensitive)
        const defaultDb =
          list.find((v) => normId(v.variantId) === "default") || null;
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

  const variantOptions: VariantOption[] = useMemo(() => {
    const base: VariantOption[] = hasDefaultDb
      ? [
        {
          variantId: "default",
          label: variantById.get("default")?.label || "Default",
        },
      ]
      : [{ variantId: "default", label: "Default" }];

    const rest = variants
      .filter((v) => normId(v.variantId) !== "default")
      .map((v) => ({ variantId: v.variantId, label: v.label || v.variantId }));

    return dedupOptions([...base, ...rest]);
  }, [variants, hasDefaultDb, variantById]);

  const visibleFieldKeys = useMemo(() => {
    const allKeys = Object.keys(def.fields || {});
    const vId = normId(selectedVariantId);

    const allNoVariant = allKeys.filter((k) => normId(k) !== "variantid");

    if (vId === "default" && !hasDefaultDb) {
      return allNoVariant;
    }

    const cfg = variantById.get(vId);
    if (!cfg) return allNoVariant;

    const inc = (cfg.includeFields || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .filter((k) => normId(k) !== "variantid");

    if (inc.length === 0) return allNoVariant;

    const allowed = new Set(allNoVariant);
    return inc.filter((k) => allowed.has(k));
  }, [def.fields, selectedVariantId, hasDefaultDb, variantById]);

  const fieldsForForm = useMemo(() => {
    const all = def.fields as Record<string, any>;
    return pickFields(all, visibleFieldKeys);
  }, [def.fields, visibleFieldKeys]);

  // ✅ initial: in NEW NON pescare dallo store + visibilità proprietario
  const initial = useMemo(() => {
    if (isNew) {
      return {
        data: {},
        visibilityRole: "", // ✅ solo proprietario
      };
    }

    const dataAll = (selected as any)?.data ?? {};
    const dataPicked = pickFields(dataAll, visibleFieldKeys);
    return {
      data: dataPicked,
      visibilityRole: (selected as any)?.visibilityRole ?? null,
    };
  }, [isNew, selected, visibleFieldKeys]);

  // ✅ attachments: in NEW vuoto (lo store potrebbe avere roba vecchia)
  const attachments = useMemo(() => {
    if (isNew) return [] as EditAttachment[];
    return (((selected as any)?.attachments ?? []) as EditAttachment[]);
  }, [isNew, selected]);

  const handleSubmit = async (payload: {
    data: Record<string, any>;
    visibilityRole: string | null;
  }) => {
    setSaving(true);
    try {
      const baseData = id ? ((selected as any)?.data ?? {}) : {};
      const mergedData = {
        ...baseData,
        ...payload.data,
        variantId: selectedVariantId,
      };

      if (id) {
        await dispatch(
          updateAnagrafica({
            type,
            id,
            data: {
              data: mergedData,
              visibilityRole: payload.visibilityRole,
            },
          }),
        ).unwrap();

        window.location.href = `/anagrafiche/${type}/${id}`;
        return;
      } else {
        const res = await dispatch(
          createAnagrafica({
            type,
            payload: {
              data: mergedData,
              visibilityRole: payload.visibilityRole,
            },
          }),
        ).unwrap();

        const newId = (res as any).id;
        window.location.href = `/anagrafiche/${type}/${newId}`;
        return;
      }
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = id ? "Modifica anagrafica" : "Nuova anagrafica";

  const coverSrc =
    def.detailCard?.coverSrc ??
    "/images/illustration/cover/cover-02.png";
  const avatarSrc =
    def.detailCard?.avatarSrc ??
    "/images/illustration/avatar/avatar-02.png";
  const headerVariant = def.detailCard?.headerVariant ?? "cover-avatar";
  const avatarSize = def.detailCard?.avatarSize ?? "medium";
  const hoverEffect = def.detailCard?.hoverEffect ?? true;

  return (
    <div className="space-y-6">
      {/* ✅ Selector Varianti */}
      <div className="rounded-[14px] border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-dark dark:text-white">
              Variante
            </div>
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

      <EditForm
        title={headerTitle}
        subtitle={def.label}
        backHref={`/anagrafiche/${type}`}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        fields={fieldsForForm as any}
        visibilityOptions={def.visibilityOptions as any}
        initial={initial}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <EditAttachmentsPanel
        documentTypes={def.documentTypes}
        attachments={attachments}
        canUpload={!!id}
        onUpload={async ({ file, attachmentType, title }) => {
          if (!id) return;
          const fd = new FormData();
          fd.append("file", file, file.name);
          fd.append("attachmentType", attachmentType);
          fd.append("category", attachmentType);
          if (title) fd.append("title", title);
          await dispatch(
            uploadAnagraficaAttachment({ type, id, form: fd }),
          ).unwrap();
        }}
        onDelete={async (attId) => {
          if (!id) return;
          await dispatch(
            deleteAnagraficaAttachment({
              type,
              id,
              attachmentId: attId,
              removeDocument: true,
            }),
          ).unwrap();
        }}
      />
    </div>
  );
}
