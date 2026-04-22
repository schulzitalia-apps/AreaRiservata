import { Schema, Types, Document as MDoc } from "mongoose";
import {
  isReferenceField,
  isReferenceMultiField,
  type FieldKey,
} from "@/config/anagrafiche.fields.catalog";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

export type ExportFormat = "csv" | "xls";
export type ExportSortDir = "asc" | "desc";

export type ExportReferenceExpansion = Record<string, string[]>;

export interface IExportVariantConfigDoc extends MDoc {
  _id: Types.ObjectId;

  anagraficaSlug: string;
  variantId: string;
  label: string;

  format: ExportFormat;
  includeFields: string[];
  referenceExpansions: ExportReferenceExpansion;

  filterDateField?: string | null;
  filterSelectField?: string | null;
  sortDateField?: string | null;
  sortDir: ExportSortDir;

  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const referenceExpansionValueSchema = new Schema(
  {
    fields: { type: [String], default: [] },
  },
  { _id: false },
);

export function buildExportVariantConfigSchema() {
  const schema = new Schema<IExportVariantConfigDoc>(
    {
      anagraficaSlug: { type: String, required: true, trim: true, maxlength: 80, index: true },
      variantId: { type: String, required: true, trim: true, maxlength: 80, index: true },
      label: { type: String, required: true, trim: true, maxlength: 200 },

      format: { type: String, enum: ["csv", "xls"], required: true, default: "csv" },
      includeFields: { type: [String], default: [] },

      referenceExpansions: {
        type: Map,
        of: referenceExpansionValueSchema,
        default: () => ({}),
      },

      filterDateField: { type: String, default: null, trim: true, maxlength: 120 },
      filterSelectField: { type: String, default: null, trim: true, maxlength: 120 },
      sortDateField: { type: String, default: null, trim: true, maxlength: 120 },
      sortDir: { type: String, enum: ["asc", "desc"], required: true, default: "asc" },

      createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    },
    { timestamps: true },
  );

  schema.index({ anagraficaSlug: 1, variantId: 1 }, { unique: true });

  return schema;
}

export function normalizeReferenceExpansionsMap(
  slug: string,
  input?: Record<string, string[]>,
): ExportReferenceExpansion {
  const def = getAnagraficaDef(slug);
  const out: ExportReferenceExpansion = {};

  if (!input || typeof input !== "object") return out;

  for (const [fieldKey, rawNestedKeys] of Object.entries(input)) {
    const sourceField = def.fields[fieldKey as FieldKey];
    if (!sourceField || (!isReferenceField(sourceField) && !isReferenceMultiField(sourceField))) {
      continue;
    }
    if (!sourceField.reference || sourceField.reference.kind !== "anagrafica") continue;

    const targetDef = getAnagraficaDef(sourceField.reference.targetSlug);
    const uniqNestedKeys = Array.from(
      new Set(
        (Array.isArray(rawNestedKeys) ? rawNestedKeys : [])
          .map((nestedKey) => String(nestedKey || "").trim())
          .filter((nestedKey) => !!targetDef.fields[nestedKey as FieldKey]),
      ),
    );

    if (uniqNestedKeys.length) {
      out[fieldKey] = uniqNestedKeys;
    }
  }

  return out;
}
