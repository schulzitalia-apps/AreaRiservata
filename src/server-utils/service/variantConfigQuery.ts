import { connectToDatabase } from "../lib/mongoose-connection";
import { getVariantConfigModel } from "../models/variantConfig.model";
import type { FieldOverride } from "../models/variantConfig.schema";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*                         HELPERS / VALIDATION                       */
/* ------------------------------------------------------------------ */

function uniqStrings(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr || []) {
    const s = String(x || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function validateFieldsAgainstSlug(slug: string, includeFields: string[]) {
  // Valida che i fields esistano nella definizione di quello slug
  const def = getAnagraficaDef(slug);
  const allowed = new Set(Object.keys(def.fields || {}));
  const bad = (includeFields || []).filter((f) => !allowed.has(f));
  if (bad.length) {
    const msg = `INVALID_FIELDS: ${bad.join(", ")}`;
    const err = new Error(msg);
    (err as any).code = "INVALID_FIELDS";
    throw err;
  }
}

function validateOverridesAgainstInclude(
  includeFields: string[],
  fieldOverrides?: Record<string, FieldOverride>,
) {
  if (!fieldOverrides) return;

  const includeSet = new Set(includeFields || []);
  const badKeys = Object.keys(fieldOverrides).filter((k) => !includeSet.has(k));
  if (badKeys.length) {
    const msg = `OVERRIDES_NOT_INCLUDED: ${badKeys.join(", ")}`;
    const err = new Error(msg);
    (err as any).code = "OVERRIDES_NOT_INCLUDED";
    throw err;
  }
}

function toDTO(d: any): VariantConfigDTO {
  return {
    id: String(d._id),
    anagraficaSlug: d.anagraficaSlug,
    variantId: d.variantId,
    label: d.label,
    includeFields: d.includeFields || [],
    // Map -> plain object
    fieldOverrides:
      d.fieldOverrides instanceof Map
        ? Object.fromEntries(d.fieldOverrides.entries())
        : (d.fieldOverrides || {}),
    createdAt: new Date(d.createdAt).toISOString(),
    updatedAt: new Date(d.updatedAt).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*                               QUERIES                              */
/* ------------------------------------------------------------------ */

export async function listVariants(params: {
  anagraficaSlug: string;
}): Promise<VariantConfigDTO[]> {
  const { anagraficaSlug } = params;

  await connectToDatabase();
  const Model = getVariantConfigModel();

  const docs = await Model.find({ anagraficaSlug })
    .sort({ variantId: 1 })
    .lean();

  return docs.map(toDTO);
}

export async function getVariant(params: {
  anagraficaSlug: string;
  variantId: string;
}): Promise<VariantConfigDTO | null> {
  const { anagraficaSlug, variantId } = params;

  await connectToDatabase();
  const Model = getVariantConfigModel();

  const doc = await Model.findOne({ anagraficaSlug, variantId }).lean();
  return doc ? toDTO(doc) : null;
}

export async function createVariant(params: {
  anagraficaSlug: string;
  payload: CreateVariantPayload;
  userId?: string;
}): Promise<VariantConfigDTO> {
  const { anagraficaSlug, payload, userId } = params;

  await connectToDatabase();
  const Model = getVariantConfigModel();

  const variantId = String(payload.variantId || "").trim();
  if (!variantId) throw new Error("VARIANT_ID_REQUIRED");

  const includeFields = uniqStrings(payload.includeFields || []);
  validateFieldsAgainstSlug(anagraficaSlug, includeFields);
  validateOverridesAgainstInclude(includeFields, payload.fieldOverrides);

  const created = await Model.create({
    anagraficaSlug,
    variantId,
    label: String(payload.label || variantId).trim(),
    includeFields,
    fieldOverrides: payload.fieldOverrides || {},
    createdBy: userId ? userId : null,
    updatedBy: userId ? userId : null,
  });

  return toDTO(created.toObject());
}

export async function updateVariant(params: {
  anagraficaSlug: string;
  variantId: string;
  payload: UpdateVariantPayload;
  userId?: string;
}): Promise<VariantConfigDTO | null> {
  const { anagraficaSlug, variantId, payload, userId } = params;

  await connectToDatabase();
  const Model = getVariantConfigModel();

  const existing = await Model.findOne({ anagraficaSlug, variantId }).lean<any>();
  if (!existing) return null;

  const update: any = {};
  if (typeof payload.label === "string") update.label = payload.label.trim();

  let includeFields = existing.includeFields || [];
  if (Array.isArray(payload.includeFields)) {
    includeFields = uniqStrings(payload.includeFields);
    validateFieldsAgainstSlug(anagraficaSlug, includeFields);
    update.includeFields = includeFields;
  }

  if (payload.fieldOverrides && typeof payload.fieldOverrides === "object") {
    validateOverridesAgainstInclude(includeFields, payload.fieldOverrides);
    update.fieldOverrides = payload.fieldOverrides;
  }

  if (userId) update.updatedBy = userId;

  const updated = await Model.findOneAndUpdate(
    { anagraficaSlug, variantId },
    update,
    { new: true },
  ).lean();

  return updated ? toDTO(updated) : null;
}

export async function deleteVariant(params: {
  anagraficaSlug: string;
  variantId: string;
}): Promise<{ ok: boolean }> {
  const { anagraficaSlug, variantId } = params;

  await connectToDatabase();
  const Model = getVariantConfigModel();

  const res = await Model.deleteOne({ anagraficaSlug, variantId });
  return { ok: (res.deletedCount || 0) > 0 };
}
