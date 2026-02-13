// src/components/AtlasModuli/anagrafiche/AnagraficheList/helpers.ts
import {
  isReferenceField,
  type FieldDef,
  type FieldKey,
} from "@/config/anagrafiche.fields.catalog";

/* ---------------------------------- TYPES --------------------------------- */

export type OptionTuple = [value: string, label: string];
export type AnagraficheListVariant = "compact" | "comfortable";
export type VisibilityControlMode = false | "checkbox" | "dropdown";
export type PreviewMode = "hover" | "clickModal";

export type HoverPreviewCfg =
  | { enabled: false }
  | { enabled: true; title?: string; keys: FieldKey[]; mode?: PreviewMode };

export type AnagraficheListConfig = {
  variant?: AnagraficheListVariant;

  /**
   * Config per slug (override)
   */
  bySlug?: Record<string, AnagraficheListConfig>;

  main?: {
    title?: FieldKey[];
    subtitle?: FieldKey[];
    showOwner?: boolean;
    showDate?: false | "updatedOnly" | "updatedOrCreated";
    referencePills?: "auto" | FieldKey[] | false;
  };

  columns?: {
    mode?: "searchIn" | "custom";
    keys?: FieldKey[];
    showVisibility?: boolean;
  };

  controls?: {
    docType?: boolean;
    visibility?: VisibilityControlMode;
    sort?: boolean; // dropdown sort (se vuoi)
  };

  hoverPreview?: false | { title?: string; keys: FieldKey[]; mode?: PreviewMode };
};

export type SortChoice = {
  key: string;
  dir: "asc" | "desc";
  label: string;
};

export type SortIndex = {
  // key -> label (per pill / dropdown)
  labelByKey: Record<string, string>;
  // options dropdown (se usi sort: true)
  options: OptionTuple[];

  // map FieldKey -> sortKey backend
  searchKeyByField: Partial<Record<FieldKey, string>>;
  titleKeyByField: Partial<Record<FieldKey, string>>;
  subtitleKeyByField: Partial<Record<FieldKey, string>>;
};

/* ------------------------------ CONFIG MERGE ------------------------------ */

export function mergeListConfig(
  base?: AnagraficheListConfig,
  override?: AnagraficheListConfig,
): AnagraficheListConfig {
  if (!base && !override) return {};
  if (!override) return base ?? {};
  if (!base) return override ?? {};

  const mergedBySlug =
    base.bySlug || override.bySlug
      ? { ...(base.bySlug ?? {}), ...(override.bySlug ?? {}) }
      : undefined;

  return {
    ...base,
    ...override,
    bySlug: mergedBySlug,
    main: { ...base.main, ...override.main },
    columns: { ...base.columns, ...override.columns },
    controls: { ...base.controls, ...override.controls },
    hoverPreview: override.hoverPreview ?? base.hoverPreview,
  };
}

export function resolveSlugConfig(
  slug: string,
  cfg?: AnagraficheListConfig,
): AnagraficheListConfig {
  const safeCfg: AnagraficheListConfig = cfg ?? {};
  const override = safeCfg.bySlug?.[slug];
  if (!override) return safeCfg;

  const { bySlug: _ignore, ...overrideNoMap } = override;
  return mergeListConfig(safeCfg, overrideNoMap as AnagraficheListConfig);
}

export function normalizeHoverPreview(cfg?: AnagraficheListConfig): HoverPreviewCfg {
  const safeCfg = cfg ?? {};
  if (!safeCfg.hoverPreview) return { enabled: false };
  return {
    enabled: true,
    title: safeCfg.hoverPreview.title,
    keys: safeCfg.hoverPreview.keys,
    mode: safeCfg.hoverPreview.mode ?? "hover",
  };
}

/* ---------------------------------- UTILS --------------------------------- */

export function uniqFieldKeys(keys: FieldKey[]): FieldKey[] {
  const out: FieldKey[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const s = String(k);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(k);
  }
  return out;
}

export function getDefaultSortDirForKey(sortKey: string): "asc" | "desc" {
  if (sortKey === "updatedAt" || sortKey === "createdAt") return "desc";
  return "asc";
}

/* ---------------------------------- SORT ---------------------------------- */

export function makeSortOptions(def: {
  preview: { title: FieldKey[]; subtitle: FieldKey[]; searchIn: FieldKey[] };
  fields: Record<string, FieldDef>;
}): SortChoice[] {
  const fieldLabel = (fk: FieldKey) => def.fields[fk]?.label ?? String(fk);

  const out: SortChoice[] = [
    { key: "", dir: "asc", label: "Ordine predefinito" },
    { key: "updatedAt", dir: "desc", label: "Ultima modifica" },
    { key: "createdAt", dir: "desc", label: "Creazione" },
  ];

  const seenField = new Set<string>();
  const add = (fk: FieldKey, key: string) => {
    const s = String(fk);
    if (seenField.has(s)) return;
    seenField.add(s);
    out.push({ key, dir: getDefaultSortDirForKey(key), label: fieldLabel(fk) });
  };

  def.preview.title.forEach((fk, i) => add(fk, `title${i}`));
  def.preview.subtitle.forEach((fk, i) => add(fk, `subtitle${i}`));
  def.preview.searchIn.forEach((fk, i) => add(fk, `search${i}`));

  return out;
}

export function buildSortIndex(def: {
  preview?: { title?: FieldKey[]; subtitle?: FieldKey[]; searchIn?: FieldKey[] };
  fields: Record<string, FieldDef>;
}): SortIndex {
  const title = def.preview?.title ?? [];
  const subtitle = def.preview?.subtitle ?? [];
  const searchIn = def.preview?.searchIn ?? [];

  const searchKeyByField: Partial<Record<FieldKey, string>> = {};
  const titleKeyByField: Partial<Record<FieldKey, string>> = {};
  const subtitleKeyByField: Partial<Record<FieldKey, string>> = {};

  searchIn.forEach((fk, i) => (searchKeyByField[fk] = `search${i}`));
  title.forEach((fk, i) => (titleKeyByField[fk] = `title${i}`));
  subtitle.forEach((fk, i) => (subtitleKeyByField[fk] = `subtitle${i}`));

  const choices = makeSortOptions({
    preview: { title, subtitle, searchIn },
    fields: def.fields,
  });

  const labelByKey: Record<string, string> = {};
  for (const c of choices) labelByKey[c.key] = c.label;

  const options: OptionTuple[] = choices
    .filter((c) => c.key)
    .map((c) => [c.key, c.label]);

  return { labelByKey, options: [["", "Ordine predefinito"], ...options], searchKeyByField, titleKeyByField, subtitleKeyByField };
}

/* -------------------------------- FORMATTERS ------------------------------ */

export function formatDateOnly(iso: unknown): string {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(iso: unknown): string {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatNumber(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n);
}

export function formatSelect(fieldDef: FieldDef, raw: unknown): string {
  const v = String(raw ?? "");
  if (!v) return "";
  const opt = fieldDef.options?.find(([value]) => value === v);
  return opt ? opt[1] : v;
}

export function formatFieldValue(fieldDef: FieldDef | undefined, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (!fieldDef) return String(raw);

  if (isReferenceField(fieldDef)) return String(raw);

  switch (fieldDef.type) {
    case "number":
      return formatNumber(raw);
    case "date":
      return formatDateOnly(raw);
    case "select":
      return formatSelect(fieldDef, raw);
    default:
      return String(raw);
  }
}

/* ------------------------------ FIELDS PROJECTION -------------------------- */

export type BuildListFieldsConfig = {
  columnKeys?: FieldKey[];
  subtitleKeys?: FieldKey[];
  hoverKeys?: FieldKey[];
};

export function buildListFields(
  def: { preview: { title: FieldKey[] } },
  configColumns: BuildListFieldsConfig,
  referenceFields: FieldKey[],
  alwaysIncludeTitle = true,
  limit = 50,
  titleKeysOverride?: FieldKey[],
): string[] {
  const titleKeys = alwaysIncludeTitle ? titleKeysOverride ?? def.preview.title ?? [] : [];

  const groups: FieldKey[][] = [
    titleKeys,
    configColumns.subtitleKeys ?? [],
    configColumns.columnKeys ?? [],
    configColumns.hoverKeys ?? [],
    referenceFields ?? [],
  ];

  const out: string[] = [];
  const seen = new Set<string>();

  const push = (k: FieldKey | undefined | null) => {
    if (!k) return;
    const s = String(k);
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  for (const g of groups) {
    for (const k of g) {
      if (out.length >= limit) break;
      push(k);
    }
    if (out.length >= limit) break;
  }

  const totalRequested = groups.reduce((acc, g) => acc + g.length, 0);
  if (totalRequested > out.length) {
    // eslint-disable-next-line no-console
    console.warn(`[AnagraficheList] fields projection truncated (${out.length}/${totalRequested}).`);
  }

  return out;
}

/* ------------------------------ COLUMNS (NEW) ------------------------------ */

export function computeColumnKeys(args: {
  mode: "searchIn" | "custom";
  // base
  searchInKeys: FieldKey[];
  // config extras
  configKeys?: FieldKey[];
  // custom keys
  customKeys?: FieldKey[];
  // to dedupe (title/subtitle)
  titleKeys: FieldKey[];
  subtitleKeys: FieldKey[];
}): FieldKey[] {
  const { mode, searchInKeys, configKeys, customKeys, titleKeys, subtitleKeys } = args;

  const base =
    mode === "custom"
      ? (customKeys ?? [])
      : uniqFieldKeys([...(searchInKeys ?? []), ...((configKeys ?? []) as FieldKey[])]);

  // Dedup: se una chiave è già in title/subtitle, non la ripeto nelle colonne
  const blocked = new Set<string>([...titleKeys, ...subtitleKeys].map(String));
  return base.filter((k) => !blocked.has(String(k)));
}
