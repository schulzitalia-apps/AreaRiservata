import mongoose from "mongoose";
import type {
  UpdateAnagraficaParams,
  CreateAnagraficaParams,
  DeleteAnagraficaParams,
} from "../../types";

/**
 * Builder: normalize/validate input
 * --------------------------------
 * Regole comuni:
 * - type deve essere una stringa non vuota (slug)
 *
 * Nota:
 * - qui non leggiamo config o DB: è un check “cheap”
 * - eventuale whitelist su registry è responsabilità di chi chiama getAnagraficaDef/getAnagraficaModel
 */

/* ----------------------------------- UPDATE -------------------------------- */

export function normalizeUpdateInput(params: UpdateAnagraficaParams): {
  type: string;
  id: string;
  updatedById: string;
} {
  if (!params?.type || typeof params.type !== "string") {
    throw new Error("INVALID_TYPE");
  }

  if (!params?.id || typeof params.id !== "string" || !mongoose.isValidObjectId(params.id)) {
    throw new Error("INVALID_ID");
  }

  if (
    !params?.updatedById ||
    typeof params.updatedById !== "string" ||
    !mongoose.isValidObjectId(params.updatedById)
  ) {
    throw new Error("INVALID_UPDATED_BY");
  }

  return {
    type: params.type,
    id: params.id,
    updatedById: params.updatedById,
  };
}

/* ----------------------------------- CREATE -------------------------------- */

/**
 * CREATE: input base
 * ------------------
 * Regole:
 * - userId deve essere ObjectId valido (owner/createdBy/updatedBy)
 * - data deve essere oggetto (se non lo è -> {})
 * - visibilityRoles (se presente) deve essere array di string
 */
export function normalizeCreateInput(params: CreateAnagraficaParams): {
  type: string;
  userId: string;
  data: Record<string, any>;
  visibilityRoles: string[];
} {
  if (!params?.type || typeof params.type !== "string") {
    throw new Error("INVALID_TYPE");
  }

  if (!params?.userId || typeof params.userId !== "string" || !mongoose.isValidObjectId(params.userId)) {
    throw new Error("INVALID_USER_ID");
  }

  const data =
    params?.data && typeof params.data === "object" && !Array.isArray(params.data)
      ? (params.data as Record<string, any>)
      : {};

  const visibilityRoles = Array.isArray(params.visibilityRoles)
    ? params.visibilityRoles.filter((r) => typeof r === "string" && r.trim() !== "")
    : [];

  return {
    type: params.type,
    userId: params.userId,
    data,
    visibilityRoles,
  };
}

/* ----------------------------------- DELETE -------------------------------- */

/**
 * DELETE: input base
 * ------------------
 * Regole:
 * - id deve essere ObjectId valido
 */
export function normalizeDeleteInput(params: DeleteAnagraficaParams): {
  type: string;
  id: string;
} {
  if (!params?.type || typeof params.type !== "string") {
    throw new Error("INVALID_TYPE");
  }

  if (!params?.id || typeof params.id !== "string" || !mongoose.isValidObjectId(params.id)) {
    throw new Error("INVALID_ID");
  }

  return {
    type: params.type,
    id: params.id,
  };
}
