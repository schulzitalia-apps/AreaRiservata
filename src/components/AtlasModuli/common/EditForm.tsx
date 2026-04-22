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
import { AppButton } from "@/components/ui";
import { InteractiveGeoPointEditor } from "@/components/AtlasModuli/common/maps/InteractiveGeoPointEditor";

import {
  isReferenceMultiField,
  type ReferenceConfig,
} from "@/config/anagrafiche.fields.catalog";
import { anagraficheService } from "@/components/Store/services/anagraficheService";

export type EditFieldDef = {
  label: string;
  type: string;
  options?: ReadonlyArray<readonly [string, string]>;
  reference?: ReferenceConfig;
};

function normalizeBooleanInput(raw: any): "" | "true" | "false" {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") return "true";
    if (normalized === "false") return "false";
  }
  return "";
}

function normalizeStringArrayInput(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function normalizeNumberArrayInput(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      if (value === null || value === undefined || value === "") return "";
      const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      return Number.isFinite(num) ? String(num) : "";
    })
    .filter(Boolean);
}

function normalizeRangeNumberInput(raw: any): { from: string; to: string } {
  if (!raw || typeof raw !== "object") return { from: "", to: "" };
  const from = (raw as any).from;
  const to = (raw as any).to;
  return {
    from: from === null || from === undefined || from === "" ? "" : String(from),
    to: to === null || to === undefined || to === "" ? "" : String(to),
  };
}

function normalizeRangeDateInput(raw: any): { start: string; end: string } {
  if (!raw || typeof raw !== "object") return { start: "", end: "" };
  const start = (raw as any).start;
  const end = (raw as any).end;
  return {
    start: start ? new Date(start).toISOString().slice(0, 10) : "",
    end: end ? new Date(end).toISOString().slice(0, 10) : "",
  };
}

function normalizeGeoPointInput(raw: any): { lat: string; lng: string } {
  if (!raw || typeof raw !== "object") return { lat: "", lng: "" };
  return {
    lat: (raw as any).lat === null || (raw as any).lat === undefined ? "" : String((raw as any).lat),
    lng: (raw as any).lng === null || (raw as any).lng === undefined ? "" : String((raw as any).lng),
  };
}

function normalizeGeoPointArrayInput(raw: any): Array<{ lat: string; lng: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeGeoPointInput(item));
}

function normalizePairNumberInput(raw: any): { a: string; b: string } {
  if (!raw || typeof raw !== "object") return { a: "", b: "" };
  return {
    a: (raw as any).a === null || (raw as any).a === undefined ? "" : String((raw as any).a),
    b: (raw as any).b === null || (raw as any).b === undefined ? "" : String((raw as any).b),
  };
}

function normalizeLabelValuePairsInput(raw: any): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: String((item as any).label ?? "").trim(),
      value: String((item as any).value ?? "").trim(),
    }))
    .filter((item) => item.label || item.value);
}

function normalizeKeyValueNumberInput(raw: any): Array<{ key: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      key: String((item as any).key ?? "").trim(),
      value:
        (item as any).value === null || (item as any).value === undefined
          ? ""
          : String((item as any).value),
    }))
    .filter((item) => item.key || item.value);
}

function normalizeAddressInput(raw: any): {
  street: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  extra: string;
} {
  if (!raw || typeof raw !== "object") {
    return { street: "", city: "", zip: "", province: "", country: "", extra: "" };
  }
  return {
    street: String((raw as any).street ?? "").trim(),
    city: String((raw as any).city ?? "").trim(),
    zip: String((raw as any).zip ?? "").trim(),
    province: String((raw as any).province ?? "").trim(),
    country: String((raw as any).country ?? "").trim(),
    extra: String((raw as any).extra ?? "").trim(),
  };
}

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
    visibilityRoles?: string[] | null;
  };
  saving?: boolean;
  onSubmit: (payload: {
    data: Record<string, any>;
    visibilityRoles: string[];
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

  const geoPointFieldKeys = useMemo(
    () => fieldKeys.filter((k) => (fields[k] as EditFieldDef)?.type === "geoPoint").map(String),
    [fieldKeys, fields],
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
    visibilityRoles: string[];
  }>({
    data: {},
    visibilityRoles: [],
  });
  const [geoAddressCacheByField, setGeoAddressCacheByField] = useState<
    Record<string, { label?: string; address?: ReturnType<typeof normalizeAddressInput> | null } | null>
  >({});

  // inizializza da `initial`
  useEffect(() => {
    const initialData: Record<string, any> = {};

    fieldKeys.forEach((k) => {
      const def = fields[k] as EditFieldDef;
      const raw = initial?.data?.[k as string];

      if (def.type === "date" && raw) {
        initialData[k as string] = new Date(raw).toISOString().slice(0, 10);
      } else if (def.type === "boolean") {
        initialData[k as string] = normalizeBooleanInput(raw);
      } else if (def.type === "numberArray") {
        initialData[k as string] = normalizeNumberArrayInput(raw);
      } else if (def.type === "rangeNumber") {
        initialData[k as string] = normalizeRangeNumberInput(raw);
      } else if (def.type === "rangeDate") {
        initialData[k as string] = normalizeRangeDateInput(raw);
      } else if (def.type === "geoPoint") {
        initialData[k as string] = normalizeGeoPointInput(raw);
      } else if (def.type === "geoPointArray") {
        initialData[k as string] = normalizeGeoPointArrayInput(raw);
      } else if (def.type === "pairNumber") {
        initialData[k as string] = normalizePairNumberInput(raw);
      } else if (def.type === "labelValuePairs") {
        initialData[k as string] = normalizeLabelValuePairsInput(raw);
      } else if (def.type === "keyValueNumber") {
        initialData[k as string] = normalizeKeyValueNumberInput(raw);
      } else if (def.type === "address") {
        initialData[k as string] = normalizeAddressInput(raw);
      } else if (
        def.type === "multiselect" ||
        def.type === "labelArray" ||
        isReferenceMultiField(def as any)
      ) {
        initialData[k as string] = normalizeStringArrayInput(raw);
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
      visibilityRoles: normalizeStringArrayInput(initial?.visibilityRoles),
    });
    setGeoAddressCacheByField({});
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
      } else if (def.type === "boolean") {
        normalizedData[k as string] =
          raw === "true" ? true : raw === "false" ? false : null;
      } else if (def.type === "numberArray") {
        normalizedData[k as string] = Array.isArray(raw)
          ? raw
              .map((value) => Number(String(value).replace(",", ".")))
              .filter((value) => Number.isFinite(value))
          : [];
      } else if (def.type === "rangeNumber") {
        const from = Number(String((raw as any)?.from ?? "").replace(",", "."));
        const to = Number(String((raw as any)?.to ?? "").replace(",", "."));
        normalizedData[k as string] =
          Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
      } else if (def.type === "rangeDate") {
        const start = (raw as any)?.start;
        const end = (raw as any)?.end;
        normalizedData[k as string] =
          start && end ? { start: new Date(start), end: new Date(end) } : null;
      } else if (def.type === "geoPoint") {
        const lat = Number(String((raw as any)?.lat ?? "").replace(",", "."));
        const lng = Number(String((raw as any)?.lng ?? "").replace(",", "."));
        normalizedData[k as string] =
          Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      } else if (def.type === "geoPointArray") {
        normalizedData[k as string] = Array.isArray(raw)
          ? raw
              .map((item) => {
                const lat = Number(String((item as any)?.lat ?? "").replace(",", "."));
                const lng = Number(String((item as any)?.lng ?? "").replace(",", "."));
                return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
              })
              .filter(Boolean)
          : [];
      } else if (def.type === "pairNumber") {
        const a = Number(String((raw as any)?.a ?? "").replace(",", "."));
        const b = Number(String((raw as any)?.b ?? "").replace(",", "."));
        normalizedData[k as string] =
          Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null;
      } else if (def.type === "labelValuePairs") {
        normalizedData[k as string] = Array.isArray(raw)
          ? raw
              .map((item) => ({
                label: String((item as any)?.label ?? "").trim(),
                value: String((item as any)?.value ?? "").trim(),
              }))
              .filter((item) => item.label && item.value)
          : [];
      } else if (def.type === "keyValueNumber") {
        normalizedData[k as string] = Array.isArray(raw)
          ? raw
              .map((item) => {
                const key = String((item as any)?.key ?? "").trim();
                const value = Number(String((item as any)?.value ?? "").replace(",", "."));
                return key && Number.isFinite(value) ? { key, value } : null;
              })
              .filter(Boolean)
          : [];
      } else if (def.type === "address") {
        const address = normalizeAddressInput(raw);
        normalizedData[k as string] =
          address.street || address.city || address.zip || address.province || address.country || address.extra
            ? address
            : null;
      } else if (
        def.type === "multiselect" ||
        def.type === "labelArray" ||
        isReferenceMultiField(def as any)
      ) {
        normalizedData[k as string] = Array.isArray(raw) ? raw : [];
      } else {
        normalizedData[k as string] = raw;
      }
    });

    await onSubmit({
      data: normalizedData,
      visibilityRoles: normalizeStringArrayInput(form.visibilityRoles),
    });
  };

  const visibilitySummary = useMemo(() => {
    if (form.visibilityRoles.includes("Public")) {
      return "Visibile a tutti gli utenti abilitati (con i permessi, possono anche modificarla).";
    }

    if (form.visibilityRoles.includes("PublicReadOnly")) {
      return "Visibile a tutti gli utenti abilitati, ma modificabile solo da te (proprietario) e dagli amministratori.";
    }

    if (form.visibilityRoles.length > 0) {
      return `Visibile anche alle classi: ${form.visibilityRoles.join(", ")}.`;
    }

    return "Visibile solo a te (proprietario).";
  }, [form.visibilityRoles]);

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
          <p className="text-xs text-dark/60 dark:text-white/60">{visibilitySummary}</p>

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
        <div className="mt-6 max-w-3xl">
          <MultiSelectInput
            label="Classe di visibilità"
            value={form.visibilityRoles}
            onChange={(next) => setForm((s) => ({ ...s, visibilityRoles: next }))}
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

            if (fld.type === "boolean") {
              return (
                <Select
                  key={String(k)}
                  label={fld.label}
                  value={String(value ?? "")}
                  options={[
                    ["true", "Sì"],
                    ["false", "No"],
                  ] as const}
                  onChange={(v: string) => handleFieldChange(String(k), v)}
                />
              );
            }

            if (fld.type === "multiselect") {
              return (
                <MultiSelectInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  options={(fld.options ?? []) as ReadonlyArray<
                    readonly [string, string]
                  >}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "labelArray") {
              return (
                <TagArrayInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  placeholder="Aggiungi etichetta libera"
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "referenceMulti" && fld.reference) {
              return (
                <ReferenceMultiSelectInput
                  key={String(k)}
                  label={fld.label}
                  config={fld.reference}
                  value={Array.isArray(value) ? value : []}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "numberArray") {
              return (
                <NumberArrayInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "rangeNumber") {
              return (
                <RangeNumberInput
                  key={String(k)}
                  label={fld.label}
                  value={
                    value && typeof value === "object"
                      ? value
                      : { from: "", to: "" }
                  }
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "rangeDate") {
              return (
                <RangeDateInput
                  key={String(k)}
                  label={fld.label}
                  value={
                    value && typeof value === "object"
                      ? value
                      : { start: "", end: "" }
                  }
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "geoPoint") {
              return (
                <GeoPointInput
                  key={String(k)}
                  label={fld.label}
                  value={value && typeof value === "object" ? value : { lat: "", lng: "" }}
                  onChange={(next) => handleFieldChange(String(k), next)}
                  onResolvedAddressChange={(next) =>
                    setGeoAddressCacheByField((state) => ({
                      ...state,
                      [String(k)]: next
                        ? {
                            ...next,
                            address: next.address
                              ? normalizeAddressInput(next.address)
                              : next.address ?? null,
                          }
                        : null,
                    }))
                  }
                />
              );
            }

            if (fld.type === "geoPointArray") {
              return (
                <GeoPointArrayInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "pairNumber") {
              return (
                <PairNumberInput
                  key={String(k)}
                  label={fld.label}
                  value={value && typeof value === "object" ? value : { a: "", b: "" }}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "labelValuePairs") {
              return (
                <LabelValuePairsInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "keyValueNumber") {
              return (
                <KeyValueNumberInput
                  key={String(k)}
                  label={fld.label}
                  value={Array.isArray(value) ? value : []}
                  onChange={(next) => handleFieldChange(String(k), next)}
                />
              );
            }

            if (fld.type === "address") {
              return (
                <AddressInput
                  key={String(k)}
                  label={fld.label}
                  value={value && typeof value === "object" ? value : normalizeAddressInput(null)}
                  onChange={(next) => handleFieldChange(String(k), next)}
                  geoPointOptions={geoPointFieldKeys.map((geoKey) => ({
                    key: geoKey,
                    label: fields[geoKey as keyof typeof fields]?.label ?? geoKey,
                    value: normalizeGeoPointInput(form.data[geoKey]),
                    cachedMeta: geoAddressCacheByField[geoKey] ?? null,
                  }))}
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

function MultiSelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  const selected = new Set((value ?? []).map((item) => String(item)));

  const toggle = (optionValue: string) => {
    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    onChange(Array.from(next));
  };

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>

      <div className="flex flex-wrap gap-2">
        {options.map(([optionValue, optionLabel]) => {
          const active = selected.has(optionValue);

          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => toggle(optionValue)}
              className={`
                inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors
                ${
                  active
                    ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400"
                    : "border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                }
              `}
            >
              <span>{optionLabel}</span>
            </button>
          );
        })}

        {options.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessuna opzione disponibile.
          </span>
        )}
      </div>
    </div>
  );
}

function TagArrayInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const selected = normalizeStringArrayInput(value);

  const addTag = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;
    if (selected.includes(nextValue)) {
      setDraft("");
      return;
    }
    onChange([...selected, nextValue]);
    setDraft("");
  };

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>

      <div className="mb-2 flex gap-2">
        <input
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
          value={draft}
          placeholder={placeholder ?? "Aggiungi valore"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(selected.filter((entry) => entry !== item))}
            className="inline-flex items-center gap-2 rounded-full border border-stroke bg-gray-2 px-3 py-1.5 text-xs dark:border-dark-3 dark:bg-dark-2"
          >
            <span>{item}</span>
            <span className="text-[10px] opacity-70">x</span>
          </button>
        ))}

        {selected.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessuna etichetta inserita.
          </span>
        )}
      </div>
    </div>
  );
}

function NumberArrayInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = normalizeNumberArrayInput(value);

  const addNumber = () => {
    const normalized = draft.replace(",", ".").trim();
    if (!normalized) return;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return;
    onChange([...selected, String(parsed)]);
    setDraft("");
  };

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>

      <div className="mb-2 flex gap-2">
        <input
          className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
          value={draft}
          placeholder="Aggiungi numero"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNumber();
            }
          }}
        />
        <button
          type="button"
          onClick={addNumber}
          className="rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map((item, index) => (
          <button
            key={`${item}__${index}`}
            type="button"
            onClick={() => onChange(selected.filter((_, itemIndex) => itemIndex !== index))}
            className="inline-flex items-center gap-2 rounded-full border border-stroke bg-gray-2 px-3 py-1.5 text-xs dark:border-dark-3 dark:bg-dark-2"
          >
            <span>{item}</span>
            <span className="text-[10px] opacity-70">x</span>
          </button>
        ))}

        {selected.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessun numero inserito.
          </span>
        )}
      </div>
    </div>
  );
}

function RangeNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { from: string; to: string };
  onChange: (v: { from: string; to: string }) => void;
}) {
  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Da"
          type="number"
          value={value.from}
          onChange={(next) => onChange({ ...value, from: next })}
        />
        <Input
          label="A"
          type="number"
          value={value.to}
          onChange={(next) => onChange({ ...value, to: next })}
        />
      </div>
    </div>
  );
}

function RangeDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { start: string; end: string };
  onChange: (v: { start: string; end: string }) => void;
}) {
  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Inizio"
          type="date"
          value={value.start}
          onChange={(next) => onChange({ ...value, start: next })}
        />
        <Input
          label="Fine"
          type="date"
          value={value.end}
          onChange={(next) => onChange({ ...value, end: next })}
        />
      </div>
    </div>
  );
}

function GeoPointInput({
  label,
  value,
  onChange,
  onResolvedAddressChange,
}: {
  label: string;
  value: { lat: string; lng: string };
  onChange: (v: { lat: string; lng: string }) => void;
  onResolvedAddressChange?: (meta: {
    label?: string;
    address?: {
      street?: string;
      city?: string;
      zip?: string;
      province?: string;
      country?: string;
      extra?: string;
    } | null;
  } | null) => void;
}) {
  const lat = Number(String(value.lat ?? "").replace(",", "."));
  const lng = Number(String(value.lng ?? "").replace(",", "."));

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>

      <div className="mb-3">
        <InteractiveGeoPointEditor
          value={Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null}
          onChange={(point) =>
            onChange({
              lat: String(point.lat),
              lng: String(point.lng),
            })
          }
          onResolvedAddressChange={onResolvedAddressChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Lat"
          type="number"
          value={value.lat}
          onChange={(next) => {
            onResolvedAddressChange?.(null);
            onChange({ ...value, lat: next });
          }}
        />
        <Input
          label="Lng"
          type="number"
          value={value.lng}
          onChange={(next) => {
            onResolvedAddressChange?.(null);
            onChange({ ...value, lng: next });
          }}
        />
      </div>
    </div>
  );
}

function GeoPointArrayInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Array<{ lat: string; lng: string }>;
  onChange: (v: Array<{ lat: string; lng: string }>) => void;
}) {
  const points = normalizeGeoPointArrayInput(value);

  return (
    <div className="text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => onChange([...points, { lat: "", lng: "" }])}
          className="rounded-lg border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          + Punto
        </button>
      </div>

      <div className="space-y-2">
        {points.map((point, index) => (
          <div key={index} className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-dark/60 dark:text-white/60">Punto {index + 1}</span>
              <button
                type="button"
                onClick={() => onChange(points.filter((_, pointIndex) => pointIndex !== index))}
                className="text-xs text-red-500 underline"
              >
                Rimuovi
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Lat"
                type="number"
                value={point.lat}
                onChange={(next) =>
                  onChange(points.map((entry, pointIndex) => (pointIndex === index ? { ...entry, lat: next } : entry)))
                }
              />
              <Input
                label="Lng"
                type="number"
                value={point.lng}
                onChange={(next) =>
                  onChange(points.map((entry, pointIndex) => (pointIndex === index ? { ...entry, lng: next } : entry)))
                }
              />
            </div>
          </div>
        ))}

        {points.length === 0 ? (
          <span className="text-xs text-dark/50 dark:text-white/50">Nessun punto inserito.</span>
        ) : null}
      </div>
    </div>
  );
}

function PairNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { a: string; b: string };
  onChange: (v: { a: string; b: string }) => void;
}) {
  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="A" type="number" value={value.a} onChange={(next) => onChange({ ...value, a: next })} />
        <Input label="B" type="number" value={value.b} onChange={(next) => onChange({ ...value, b: next })} />
      </div>
    </div>
  );
}

function LabelValuePairsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Array<{ label: string; value: string }>;
  onChange: (v: Array<{ label: string; value: string }>) => void;
}) {
  const rows = normalizeLabelValuePairsInput(value);

  return (
    <div className="text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { label: "", value: "" }])}
          className="rounded-lg border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          + Riga
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-dark/60 dark:text-white/60">Riga {index + 1}</span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="text-xs text-red-500 underline"
              >
                Rimuovi
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                label="Etichetta"
                value={row.label}
                onChange={(next) =>
                  onChange(rows.map((entry, rowIndex) => (rowIndex === index ? { ...entry, label: next } : entry)))
                }
              />
              <Input
                label="Valore"
                value={row.value}
                onChange={(next) =>
                  onChange(rows.map((entry, rowIndex) => (rowIndex === index ? { ...entry, value: next } : entry)))
                }
              />
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <span className="text-xs text-dark/50 dark:text-white/50">Nessuna riga inserita.</span>
        ) : null}
      </div>
    </div>
  );
}

function KeyValueNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Array<{ key: string; value: string }>;
  onChange: (v: Array<{ key: string; value: string }>) => void;
}) {
  const rows = normalizeKeyValueNumberInput(value);

  return (
    <div className="text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { key: "", value: "" }])}
          className="rounded-lg border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
        >
          + Riga
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-dark/60 dark:text-white/60">Riga {index + 1}</span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                className="text-xs text-red-500 underline"
              >
                Rimuovi
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input
                label="Chiave"
                value={row.key}
                onChange={(next) =>
                  onChange(rows.map((entry, rowIndex) => (rowIndex === index ? { ...entry, key: next } : entry)))
                }
              />
              <Input
                label="Valore numerico"
                type="number"
                value={row.value}
                onChange={(next) =>
                  onChange(rows.map((entry, rowIndex) => (rowIndex === index ? { ...entry, value: next } : entry)))
                }
              />
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <span className="text-xs text-dark/50 dark:text-white/50">Nessuna riga inserita.</span>
        ) : null}
      </div>
    </div>
  );
}

function AddressInput({
  label,
  value,
  onChange,
  geoPointOptions,
}: {
  label: string;
  value: {
    street: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    extra: string;
  };
  onChange: (v: {
    street: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    extra: string;
  }) => void;
  geoPointOptions: Array<{
    key: string;
    label: string;
    value: { lat: string; lng: string };
    cachedMeta?: { label?: string; address?: ReturnType<typeof normalizeAddressInput> | null } | null;
  }>;
}) {
  const [selectedGeoKey, setSelectedGeoKey] = useState("");
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  useEffect(() => {
    if (geoPointOptions.length === 0) {
      setSelectedGeoKey("");
      return;
    }
    const exists = geoPointOptions.some((option) => option.key === selectedGeoKey);
    if (!exists) setSelectedGeoKey(geoPointOptions[0].key);
  }, [geoPointOptions, selectedGeoKey]);

  const selectedGeo = geoPointOptions.find((option) => option.key === selectedGeoKey) ?? null;

  const handleAutofillFromGeoPoint = async () => {
    if (!selectedGeo) return;

    const lat = Number(String(selectedGeo.value.lat ?? "").replace(",", "."));
    const lng = Number(String(selectedGeo.value.lng ?? "").replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setAutofillError("Il geopoint selezionato non ha coordinate valide.");
      return;
    }

    setAutofillLoading(true);
    setAutofillError(null);

    try {
      const cachedAddress = selectedGeo.cachedMeta?.address;
      const address = cachedAddress
        ? cachedAddress
        : await (async () => {
            const res = await fetch(
              `/api/maps/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
              {
                method: "GET",
                credentials: "include",
              },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.message || "Errore reverse geocoding");
            return json?.item?.address;
          })();

      if (!address) throw new Error("Nessun indirizzo disponibile per questo geopoint.");

      onChange({
        street: String(address.street ?? ""),
        city: String(address.city ?? ""),
        zip: String(address.zip ?? ""),
        province: String(address.province ?? ""),
        country: String(address.country ?? ""),
        extra: String(address.extra ?? ""),
      });
    } catch (e: any) {
      setAutofillError(e?.message || "Errore autocompilazione indirizzo.");
    } finally {
      setAutofillLoading(false);
    }
  };

  return (
    <div className="text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <span>{label}</span>
        <div className="flex flex-col gap-2 md:min-w-[320px] md:flex-row md:items-end">
          {geoPointOptions.length > 0 ? (
            <label className="block text-xs text-dark/60 dark:text-white/60 md:min-w-[180px]">
              <span className="mb-1 block">Geopoint sorgente</span>
              <select
                value={selectedGeoKey}
                onChange={(e) => setSelectedGeoKey(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              >
                {geoPointOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <AppButton
            type="button"
            variant="outline"
            tone="success"
            size="sm"
            onClick={handleAutofillFromGeoPoint}
            loading={autofillLoading}
            disabled={geoPointOptions.length === 0}
          >
            Autocompila con geopoint
          </AppButton>
        </div>
      </div>

      {geoPointOptions.length === 0 ? (
        <div className="mb-3 rounded-xl border border-dashed border-stroke px-3 py-2 text-xs text-dark/55 dark:border-dark-3 dark:text-white/55">
          Nessun geopoint disponibile in questo form.
        </div>
      ) : null}

      {selectedGeo?.cachedMeta?.address ? (
        <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-2 text-xs text-dark/75 dark:text-white/75">
          Ultima selezione mappa disponibile per questo geopoint:
          <div className="mt-1 font-medium text-white">
            {selectedGeo.cachedMeta.label ||
              [
                selectedGeo.cachedMeta.address.street,
                [selectedGeo.cachedMeta.address.zip, selectedGeo.cachedMeta.address.city].filter(Boolean).join(" "),
                [selectedGeo.cachedMeta.address.province, selectedGeo.cachedMeta.address.country].filter(Boolean).join(" - "),
              ]
                .filter(Boolean)
                .join(", ")}
          </div>
        </div>
      ) : null}

      {autofillError ? (
        <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {autofillError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input label="Via / civico" value={value.street} onChange={(next) => onChange({ ...value, street: next })} />
        <Input label="Città" value={value.city} onChange={(next) => onChange({ ...value, city: next })} />
        <Input label="CAP" value={value.zip} onChange={(next) => onChange({ ...value, zip: next })} />
        <Input label="Provincia" value={value.province} onChange={(next) => onChange({ ...value, province: next })} />
        <Input label="Paese" value={value.country} onChange={(next) => onChange({ ...value, country: next })} />
        <Input label="Extra" value={value.extra} onChange={(next) => onChange({ ...value, extra: next })} />
      </div>
    </div>
  );
}

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

function ReferenceMultiSelectInput({
  label,
  value,
  onChange,
  config,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  config: ReferenceConfig;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});

  const { kind, targetSlug, previewField } = config;
  const selectedIds = useMemo(() => normalizeStringArrayInput(value), [value]);

  useEffect(() => {
    if (kind !== "anagrafica" || selectedIds.length === 0) {
      setSelectedLabels({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await anagraficheService.getFieldValues({
          targetSlug,
          field: previewField ?? "displayName",
          ids: selectedIds,
        });

        if (cancelled) return;

        const next: Record<string, string> = {};
        selectedIds.forEach((id) => {
          next[id] = res[id] ?? id;
        });
        setSelectedLabels(next);
      } catch {
        if (!cancelled) setSelectedLabels({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIds, kind, targetSlug, previewField]);

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

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>

      <div className="mb-2 flex flex-wrap gap-2">
        {selectedIds.map((id) => (
          <button
            key={id}
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-primary px-3 py-1 text-xs text-primary dark:border-red-400 dark:text-red-400"
            onClick={() => toggle(id)}
          >
            <span className="truncate max-w-[220px]">{selectedLabels[id] ?? id}</span>
            <span className="text-[10px] opacity-70">x</span>
          </button>
        ))}

        {selectedIds.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessun collegamento selezionato.
          </span>
        )}
      </div>

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
          options.map((opt) => {
            const active = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className={`
                  inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs
                  transition-colors
                  ${
                    active
                      ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400"
                      : "border-primary text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
                  }
                `}
              >
                <span className="truncate max-w-[180px]">{opt.label}</span>
              </button>
            );
          })}

        {!loading && options.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            Nessun risultato.
          </span>
        )}
      </div>
    </div>
  );
}
