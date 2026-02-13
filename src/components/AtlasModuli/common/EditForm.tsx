// src/components/AtlasModuli/common/EditForm.tsx
"use client";

import {
  useMemo,
  useState,
  useEffect,
  type ReactNode,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  FloatingSection,
  type FloatingSectionHeaderVariant,
  type FloatingSectionAvatarSize,
} from "@/components/Layouts/FloatingSection";
import { Select } from "@/components/ui/select";

import type { ReferenceConfig } from "@/config/anagrafiche.fields.catalog";
import { anagraficheService } from "@/components/Store/services/anagraficheService";

export type EditFieldDef = {
  label: string;
  type: string;
  options?: ReadonlyArray<readonly [string, string]>;
  reference?: ReferenceConfig;
};

export type EditFormProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref: string;

  coverSrc?: string;
  avatarSrc?: string;

  // nuova config header, in linea con DetailInfoCard / FloatingSection
  headerVariant?: FloatingSectionHeaderVariant;
  avatarSize?: FloatingSectionAvatarSize;
  hoverEffect?: boolean;

  fields: Record<string, EditFieldDef>;
  visibilityOptions: ReadonlyArray<readonly [string, string]>;
  initial?: {
    data?: Record<string, any>;
    visibilityRole?: string | null;
  };
  saving?: boolean;
  onSubmit: (payload: {
    data: Record<string, any>;
    visibilityRole: string | null;
  }) => Promise<void> | void;
  children?: ReactNode;
};

export function EditForm({
                           title,
                           subtitle,
                           backHref,
                           coverSrc = "/images/cover/cover-04.png",
                           avatarSrc = "/images/user/user-02.png",
                           headerVariant = "cover-avatar",
                           avatarSize = "medium",
                           hoverEffect = true,
                           fields,
                           visibilityOptions,
                           initial,
                           saving,
                           onSubmit,
                           children,
                         }: EditFormProps) {
  const router = useRouter();

  const fieldKeys = useMemo(
    () => Object.keys(fields) as Array<keyof typeof fields>,
    [fields],
  );

  // ✅ NEW detection senza prop: se non ho dati -> è una creazione
  const isNew = useMemo(() => {
    const d = initial?.data;
    return !d || Object.keys(d).length === 0;
  }, [initial]);

  // 🔐 Opzioni visibilità: in testa Public e PublicReadOnly se non presenti
  const visibilityOptionsWithPublic = useMemo(() => {
    const hasPublic = visibilityOptions.some(([value]) => value === "Public");
    const hasPublicReadOnly = visibilityOptions.some(
      ([value]) => value === "PublicReadOnly",
    );

    const extra: Array<[string, string]> = [];
    if (!hasPublic) {
      extra.push([
        "Public",
        "Pubblico (visibile e modificabile dagli utenti abilitati)",
      ]);
    }
    if (!hasPublicReadOnly) {
      extra.push([
        "PublicReadOnly",
        "Pubblico (solo lettura per altri, modificabile solo da proprietario e admin)",
      ]);
    }

    return [...extra, ...visibilityOptions] as ReadonlyArray<
      readonly [string, string]
    >;
  }, [visibilityOptions]);

  const [form, setForm] = useState<{
    data: Record<string, any>;
    visibilityRole: string;
  }>({
    data: {},
    visibilityRole: "",
  });

  // inizializza da `initial`
  useEffect(() => {
    const initialData: Record<string, any> = {};

    fieldKeys.forEach((k) => {
      const def = fields[k] as EditFieldDef;
      const raw = initial?.data?.[k as string];

      if (def.type === "date" && raw) {
        initialData[k as string] = new Date(raw).toISOString().slice(0, 10);
      } else if (def.type === "select") {
        if (raw != null && raw !== "") {
          initialData[k as string] = raw;
        } else {
          // ✅ SOLO NEW: parti da "Seleziona…" (value = "")
          if (isNew) {
            initialData[k as string] = "";
          } else {
            // edit: fallback storico (prima option)
            const opt = Array.isArray(def.options) ? def.options[0]?.[0] : "";
            initialData[k as string] = opt ?? "";
          }
        }
      } else {
        initialData[k as string] = raw ?? "";
      }
    });

    setForm({
      data: initialData,
      visibilityRole: initial?.visibilityRole ?? "",
    });
  }, [initial, fieldKeys, fields, isNew]);

  const handleFieldChange = (key: string, value: any) => {
    setForm((s) => ({ ...s, data: { ...s.data, [key]: value } }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const normalizedData: Record<string, any> = {};

    fieldKeys.forEach((k) => {
      const def = fields[k] as EditFieldDef;
      const raw = form.data[k as string];

      if (def.type === "date") {
        normalizedData[k as string] = raw ? new Date(raw) : null;
      } else {
        normalizedData[k as string] = raw;
      }
    });

    await onSubmit({
      data: normalizedData,
      visibilityRole: form.visibilityRole || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FloatingSection
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        title={title}
        subtitle={subtitle}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
      >
        {/* barra azioni + descrizione visibilità */}
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <p className="text-xs text-dark/60 dark:text-white/60">
            {form.visibilityRole === "Public"
              ? "Visibile a tutti gli utenti abilitati (con i permessi, possono anche modificarla)."
              : form.visibilityRole === "PublicReadOnly"
                ? "Visibile a tutti gli utenti abilitati, ma modificabile solo da te (proprietario) e dagli amministratori."
                : form.visibilityRole
                  ? `Visibile anche alla classe: ${form.visibilityRole}`
                  : "Visibile solo a te (proprietario)."}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="rounded-lg border border-stroke px-4 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Indietro
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </div>

        {/* SELECT VISIBILITÀ */}
        <div className="mt-6 max-w-sm">
          <Select
            label="Classe di visibilità"
            value={form.visibilityRole}
            onChange={(v) => setForm((s) => ({ ...s, visibilityRole: v }))}
            options={visibilityOptionsWithPublic as any}
          />
        </div>

        {/* CAMPI DINAMICI */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {fieldKeys.map((k) => {
            const fld = fields[k] as EditFieldDef;
            const value = form.data[k as string] ?? "";

            if (fld.type === "reference" && fld.reference) {
              return (
                <ReferenceSelectInput
                  key={String(k)}
                  label={fld.label}
                  config={fld.reference}
                  value={value}
                  onChange={(v) => handleFieldChange(String(k), v)}
                />
              );
            }

            if (fld.type === "textarea") {
              return (
                <Textarea
                  key={String(k)}
                  label={fld.label}
                  value={value}
                  onChange={(v) => handleFieldChange(String(k), v)}
                />
              );
            }

            if (fld.type === "select") {
              return (
                <Select
                  key={String(k)}
                  label={fld.label}
                  // ✅ non forzare mai "prima option" qui
                  value={String(value ?? "")}
                  options={(fld.options ?? []) as ReadonlyArray<
                    readonly [string, string]
                  >}
                  onChange={(v: string) => handleFieldChange(String(k), v)}
                />
              );
            }

            const inputTypeMap: Record<string, string> = {
              date: "date",
              email: "email",
              tel: "tel",
              number: "number",
              datetime: "datetime-local",
              text: "text",
            };
            const inputType = inputTypeMap[fld.type] ?? "text";

            return (
              <Input
                key={String(k)}
                label={fld.label}
                type={inputType}
                value={value}
                onChange={(v) => handleFieldChange(String(k), v)}
              />
            );
          })}
        </div>

        {children && <div className="mt-6 space-y-4">{children}</div>}
      </FloatingSection>
    </form>
  );
}

/* ---------------- INPUT / TEXTAREA HELPERS ---------------- */

function Input({
                 label,
                 value,
                 onChange,
                 type = "text",
               }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        value={value ?? ""}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Textarea({
                    label,
                    value,
                    onChange,
                    rows = 4,
                  }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-1">{label}</div>
      <textarea
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ---------------- REFERENCE SELECT INPUT ---------------- */

function ReferenceSelectInput({
                                label,
                                value,
                                onChange,
                                config,
                              }: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  config: ReferenceConfig;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const { kind, targetSlug, previewField } = config;

  useEffect(() => {
    if (!value) {
      setSelectedLabel(null);
      return;
    }
    if (kind !== "anagrafica") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await anagraficheService.getFieldValues({
          targetSlug,
          field: previewField ?? "displayName",
          ids: [value],
        });

        if (cancelled) return;
        const lbl = res[value] ?? null;
        setSelectedLabel(lbl);
      } catch {
        if (!cancelled) setSelectedLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, kind, targetSlug, previewField]);

  useEffect(() => {
    if (kind !== "anagrafica") {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await anagraficheService.list({
          type: targetSlug,
          query: query || undefined,
          page: 1,
          pageSize: 10,
        });

        if (cancelled) return;

        const opts =
          res.items?.map((item: any) => {
            const dataLabel =
              previewField && item.data?.[previewField]
                ? item.data[previewField]
                : null;

            const lbl = dataLabel || item.displayName || String(item.id);

            return { id: String(item.id), label: String(lbl) };
          }) ?? [];

        setOptions(opts);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, targetSlug, previewField, query]);

  const current = options.find((o) => o.id === value) || null;
  const shownLabel = current?.label ?? selectedLabel ?? (value || "");

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>

      {value && shownLabel && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-primary dark:border-red-400 dark:text-red-400">
          <span className="font-semibold">Selezionato:</span>
          <span className="truncate max-w-[220px]">{shownLabel}</span>
          <button
            type="button"
            className="ml-1 text-[10px] opacity-70 hover:opacity-100"
            onClick={() => onChange("")}
          >
            ✕
          </button>
        </div>
      )}

      <input
        className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        type="text"
        placeholder={kind === "anagrafica" ? "Cerca per nome…" : "Seleziona…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-1">
        {loading && (
          <span className="text-xs text-dark/60 dark:text-white/60">
            Caricamento…
          </span>
        )}
        {!loading &&
          options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`
                inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs
                transition-colors
                ${
                opt.id === value
                  ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400"
                  : "border-primary text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
              }
              `}
            >
              <span className="truncate max-w-[180px]">{opt.label}</span>
            </button>
          ))}

        {!loading && options.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessun risultato.
          </span>
        )}
      </div>
    </div>
  );
}
