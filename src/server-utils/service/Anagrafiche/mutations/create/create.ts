import mongoose from "mongoose";

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

import type { CreateAnagraficaParams } from "../../types";

import { normalizeCreateInput } from "../builders/input";
import { buildAuditCreateFields } from "../builders/audit";
import { buildCreateDataObject } from "../builders/data";

import { writeCreateAnagrafica } from "../writers/create";

/**
 * Mutation: createAnagrafica
 * -------------------------
 * Crea una nuova anagrafica per slug (collection dinamica).
 *
 * Pipeline:
 * 1) validate input (cheap)
 * 2) connect DB
 * 3) resolve model dinamico
 * 4) cast + sparse data (no chiavi vuote salvate)
 * 5) audit fields (owner/createdBy/updatedBy)
 * 6) write create
 *
 * Output:
 * - per ora torniamo solo {id} (come facevi prima).
 * - se vuoi un "create-return-full", basta:
 *   - fare `return mapToAnagraficaFull(created)` ma occhio: aumenta payload.
 */
export async function createAnagrafica(
  params: CreateAnagraficaParams,
): Promise<{ id: string }> {
  const { type, userId, data, visibilityRoles } = normalizeCreateInput(params);

  await connectToDatabase();

  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  // Casting serio + sparse (chiavi vuote => omit)
  const castedData = buildCreateDataObject(slug, data);

  // Audit standard Atlas (core fuori da data)
  const audit = buildAuditCreateFields(userId);

  const created = await writeCreateAnagrafica(Model, {
    data: castedData,
    visibilityRoles,
    ...audit,
  });

  return { id: String(created._id) };
}
