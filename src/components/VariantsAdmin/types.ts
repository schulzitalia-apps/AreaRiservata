export type Notice =
  | null
  | { type: "success" | "error" | "info"; text: string };

export type UnitSpec = {
  kind: "prefix" | "suffix";
  value: string;
};

export type NumberFormat =
  | "plain"
  | "integer"
  | "decimal"
  | "compact"
  | "currency"
  | "percent";

export type DateTimeFormat =
  | "date"
  | "time"
  | "datetime"
  | "monthYear"
  | "relative"
  | "iso";

export type TextFormat =
  | "text"
  | "longtext"
  | "label"
  | "link"
  | "email"
  | "phone";

export type ReferenceFormat = "reference";

export type DisplayKind = "number" | "datetime" | "text" | "reference";

export type DisplayFormat =
  | NumberFormat
  | DateTimeFormat
  | TextFormat
  | ReferenceFormat;

export type FieldOverride = {
  kind: DisplayKind;
  format: DisplayFormat;

  unit?: UnitSpec;
  decimals?: number;

  percentBasis?: "whole" | "fraction";
  currency?: string;

  label?: string;
};

export type VariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  includeFields: string[];
  fieldOverrides: Record<string, FieldOverride>;
  createdAt: string;
  updatedAt: string;
};

export type CreateVariantPayload = {
  variantId: string;
  label: string;
  includeFields: string[];
  fieldOverrides?: Record<string, FieldOverride>;
};

export type UpdateVariantPayload = {
  label?: string;
  includeFields?: string[];
  fieldOverrides?: Record<string, FieldOverride>;
};
