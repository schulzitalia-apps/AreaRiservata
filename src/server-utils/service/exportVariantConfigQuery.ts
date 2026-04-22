import { connectToDatabase } from "../lib/mongoose-connection";
import { getExportVariantConfigModel } from "../models/exportVariantConfig.model";
import {
  normalizeReferenceExpansionsMap,
  type ExportFormat,
  type ExportReferenceExpansion,
  type ExportSortDir,
} from "../models/exportVariantConfig.schema";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

export type ExportVariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  format: ExportFormat;
  includeFields: string[];
  referenceExpansions: ExportReferenceExpansion;
  filterDateField: string | null;
  filterSelectField: string | null;
  sortDateField: string | null;
  sortDir: ExportSortDir;
  createdAt: string;
  updatedAt: string;
};

export type CreateExportVariantPayload = {
  variantId: string;
  label: string;
  format?: ExportFormat;
  includeFields: string[];
  referenceExpansions?: ExportReferenceExpansion;
  filterDateField?: string | null;
  filterSelectField?: string | null;
  sortDateField?: string | null;
  sortDir?: ExportSortDir;
};

export type UpdateExportVariantPayload = {
  label?: string;
  format?: ExportFormat;
  includeFields?: string[];
  referenceExpansions?: ExportReferenceExpansion;
  filterDateField?: string | null;
  filterSelectField?: string | null;
  sortDateField?: string | null;
  sortDir?: ExportSortDir;
};

function uniqStrings(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr || []) {
    const value = String(raw || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function validateFieldsAgainstSlug(slug: string, includeFields: string[]) {
  const def = getAnagraficaDef(slug);
  const allowed = new Set(Object.keys(def.fields || {}));
  const bad = (includeFields || []).filter((field) => !allowed.has(field));
  if (bad.length) {
    const err = new Error(`INVALID_FIELDS: ${bad.join(", ")}`);
    (err as any).code = "INVALID_FIELDS";
    throw err;
  }
}

function validateDateField(slug: string, field: string | null | undefined, code: string) {
  if (!field) return;
  const def = getAnagraficaDef(slug);
  const fieldDef = def.fields[field as FieldKey];
  if (!fieldDef || fieldDef.type !== "date") {
    const err = new Error(`${code}: ${field}`);
    (err as any).code = code;
    throw err;
  }
}

function validateSelectField(slug: string, field: string | null | undefined) {
  if (!field) return;
  const def = getAnagraficaDef(slug);
  const fieldDef = def.fields[field as FieldKey];
  if (!fieldDef || fieldDef.type !== "select") {
    const err = new Error(`INVALID_SELECT_FIELD: ${field}`);
    (err as any).code = "INVALID_SELECT_FIELD";
    throw err;
  }
}

function toDTO(doc: any): ExportVariantConfigDTO {
  const rawExpansions =
    doc.referenceExpansions instanceof Map
      ? Object.fromEntries(doc.referenceExpansions.entries())
      : (doc.referenceExpansions ?? {});

  const referenceExpansions = Object.fromEntries(
    Object.entries(rawExpansions).map(([fieldKey, value]: [string, any]) => [
      fieldKey,
      Array.isArray(value?.fields)
        ? value.fields.map((entry: string) => String(entry))
        : Array.isArray(value)
          ? value.map((entry: string) => String(entry))
          : [],
    ]),
  );

  return {
    id: String(doc._id),
    anagraficaSlug: doc.anagraficaSlug,
    variantId: doc.variantId,
    label: doc.label,
    format: doc.format,
    includeFields: Array.isArray(doc.includeFields) ? doc.includeFields : [],
    referenceExpansions,
    filterDateField: doc.filterDateField ?? null,
    filterSelectField: doc.filterSelectField ?? null,
    sortDateField: doc.sortDateField ?? null,
    sortDir: doc.sortDir === "desc" ? "desc" : "asc",
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function listExportVariants(params: {
  anagraficaSlug: string;
}): Promise<ExportVariantConfigDTO[]> {
  await connectToDatabase();
  const Model = getExportVariantConfigModel();

  const docs = await Model.find({ anagraficaSlug: params.anagraficaSlug })
    .sort({ variantId: 1 })
    .lean();

  return docs.map(toDTO);
}

export async function getExportVariant(params: {
  anagraficaSlug: string;
  variantId: string;
}): Promise<ExportVariantConfigDTO | null> {
  await connectToDatabase();
  const Model = getExportVariantConfigModel();

  const doc = await Model.findOne({
    anagraficaSlug: params.anagraficaSlug,
    variantId: params.variantId,
  }).lean();

  return doc ? toDTO(doc) : null;
}

export async function createExportVariant(params: {
  anagraficaSlug: string;
  payload: CreateExportVariantPayload;
  userId?: string;
}): Promise<ExportVariantConfigDTO> {
  const { anagraficaSlug, payload, userId } = params;
  await connectToDatabase();
  const Model = getExportVariantConfigModel();

  const variantId = String(payload.variantId || "").trim();
  if (!variantId) throw new Error("VARIANT_ID_REQUIRED");

  const includeFields = uniqStrings(payload.includeFields || []);
  validateFieldsAgainstSlug(anagraficaSlug, includeFields);

  const filterDateField = payload.filterDateField?.trim() || null;
  const filterSelectField = payload.filterSelectField?.trim() || null;
  const sortDateField = payload.sortDateField?.trim() || null;

  validateDateField(anagraficaSlug, filterDateField, "INVALID_FILTER_DATE_FIELD");
  validateDateField(anagraficaSlug, sortDateField, "INVALID_SORT_DATE_FIELD");
  validateSelectField(anagraficaSlug, filterSelectField);

  const referenceExpansions = normalizeReferenceExpansionsMap(
    anagraficaSlug,
    payload.referenceExpansions,
  );

  const created = await Model.create({
    anagraficaSlug,
    variantId,
    label: String(payload.label || variantId).trim(),
    format: payload.format === "xls" ? "xls" : "csv",
    includeFields,
    referenceExpansions: Object.fromEntries(
      Object.entries(referenceExpansions).map(([fieldKey, fields]) => [
        fieldKey,
        { fields },
      ]),
    ),
    filterDateField,
    filterSelectField,
    sortDateField,
    sortDir: payload.sortDir === "desc" ? "desc" : "asc",
    createdBy: userId || null,
    updatedBy: userId || null,
  });

  return toDTO(created.toObject());
}

export async function updateExportVariant(params: {
  anagraficaSlug: string;
  variantId: string;
  payload: UpdateExportVariantPayload;
  userId?: string;
}): Promise<ExportVariantConfigDTO | null> {
  const { anagraficaSlug, variantId, payload, userId } = params;
  await connectToDatabase();
  const Model = getExportVariantConfigModel();

  const existing = await Model.findOne({ anagraficaSlug, variantId }).lean<any>();
  if (!existing) return null;

  const update: Record<string, any> = {};

  if (typeof payload.label === "string") update.label = payload.label.trim();
  if (payload.format) update.format = payload.format === "xls" ? "xls" : "csv";
  if (payload.sortDir) update.sortDir = payload.sortDir === "desc" ? "desc" : "asc";

  if (Array.isArray(payload.includeFields)) {
    const includeFields = uniqStrings(payload.includeFields);
    validateFieldsAgainstSlug(anagraficaSlug, includeFields);
    update.includeFields = includeFields;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "filterDateField")) {
    const field = payload.filterDateField?.trim() || null;
    validateDateField(anagraficaSlug, field, "INVALID_FILTER_DATE_FIELD");
    update.filterDateField = field;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "filterSelectField")) {
    const field = payload.filterSelectField?.trim() || null;
    validateSelectField(anagraficaSlug, field);
    update.filterSelectField = field;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sortDateField")) {
    const field = payload.sortDateField?.trim() || null;
    validateDateField(anagraficaSlug, field, "INVALID_SORT_DATE_FIELD");
    update.sortDateField = field;
  }

  if (payload.referenceExpansions && typeof payload.referenceExpansions === "object") {
    const normalized = normalizeReferenceExpansionsMap(
      anagraficaSlug,
      payload.referenceExpansions,
    );
    update.referenceExpansions = Object.fromEntries(
      Object.entries(normalized).map(([fieldKey, fields]) => [fieldKey, { fields }]),
    );
  }

  if (userId) update.updatedBy = userId;

  const updated = await Model.findOneAndUpdate(
    { anagraficaSlug, variantId },
    update,
    { new: true },
  ).lean();

  return updated ? toDTO(updated) : null;
}

export async function deleteExportVariant(params: {
  anagraficaSlug: string;
  variantId: string;
}): Promise<{ ok: boolean }> {
  await connectToDatabase();
  const Model = getExportVariantConfigModel();

  const result = await Model.deleteOne({
    anagraficaSlug: params.anagraficaSlug,
    variantId: params.variantId,
  });

  return { ok: (result.deletedCount || 0) > 0 };
}
