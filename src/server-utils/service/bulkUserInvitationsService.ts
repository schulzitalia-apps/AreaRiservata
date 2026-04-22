import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import UserModel from "@/server-utils/models/User";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { getAulaDef } from "@/config/aule.registry";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import { getAulaModel } from "@/server-utils/models/aule.factory";
import type { AppRole } from "@/types/roles";
import type { FieldInputType } from "@/config/anagrafiche.fields.catalog";
import type { AulaFieldInputType } from "@/config/aule.fields.catalog";
import {
  createOrRegenerateInvitation,
  resolveInviteBaseUrl,
} from "@/server-utils/service/userInvitationService";
import { createUserAnagraficaKey } from "@/server-utils/service/anagraficheKeysQuery";
import { createUserAulaKey } from "@/server-utils/service/auleKeysQuery";

export type BulkInviteSourceKind = "anagrafica" | "aula";

export type BulkInvitePreviewItemStatus =
  | "ready_create"
  | "ready_regenerate"
  | "missing_email"
  | "invalid_email"
  | "duplicate_email"
  | "active_user_conflict";

export type BulkInvitePreviewItem = {
  sourceId: string;
  displayName: string;
  subtitle: string | null;
  email: string | null;
  normalizedEmail: string | null;
  username: string | null;
  status: BulkInvitePreviewItemStatus;
  reason: string | null;
  existingUserId: string | null;
};

export type BulkInvitePreview = {
  items: BulkInvitePreviewItem[];
  summary: {
    total: number;
    readyCreate: number;
    readyRegenerate: number;
    missingEmail: number;
    invalidEmail: number;
    duplicateEmail: number;
    activeUserConflict: number;
  };
};

export type BulkInviteCreateResultItem = BulkInvitePreviewItem & {
  outcome: "created" | "regenerated" | "skipped" | "failed";
  inviteLink?: string | null;
  expiresAt?: string | null;
  messageId?: string | null;
  assignedPermission?: boolean;
  error?: string | null;
};

export type BulkInviteCreateResult = {
  items: BulkInviteCreateResultItem[];
  summary: {
    total: number;
    created: number;
    regenerated: number;
    skipped: number;
    failed: number;
  };
};

type BulkSourceInput = {
  sourceKind: BulkInviteSourceKind;
  sourceType: string;
  sourceIds: string[];
  emailFieldKey: string;
  nameFieldKey: string;
};

type ResolvedSourceRecord = {
  sourceId: string;
  displayName: string;
  subtitle: string | null;
  data: Record<string, unknown>;
};

const EMAIL_RE = /.+\@.+\..+/i;

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email || null;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function joinPreview(data: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => normalizeText(data[key]))
    .filter((value): value is string => !!value)
    .join(" ");
}

function joinSubtitle(data: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => normalizeText(data[key]))
    .filter((value): value is string => !!value)
    .join(" · ");
}

function ensureIds(sourceIds: string[]) {
  return Array.from(
    new Set(
      sourceIds
        .map((value) => String(value || "").trim())
        .filter((value) => mongoose.isValidObjectId(value)),
    ),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveSourceRecords(input: BulkSourceInput): Promise<ResolvedSourceRecord[]> {
  const safeIds = ensureIds(input.sourceIds);
  if (!safeIds.length) return [];

  if (input.sourceKind === "anagrafica") {
    const def = getAnagraficaDef(input.sourceType);
    const Model = getAnagraficaModel(input.sourceType);
    const docs = await Model.find({
      _id: { $in: safeIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select({ data: 1 })
      .lean();

    const byId = new Map<string, ResolvedSourceRecord>();
    for (const doc of docs as any[]) {
      const data = (doc.data || {}) as Record<string, unknown>;
      byId.set(String(doc._id), {
        sourceId: String(doc._id),
        displayName: joinPreview(data, def.preview.title) || "(senza titolo)",
        subtitle: joinSubtitle(data, def.preview.subtitle) || null,
        data,
      });
    }
    return safeIds.map((id) => byId.get(id)).filter((item): item is ResolvedSourceRecord => !!item);
  }

  const def = getAulaDef(input.sourceType);
  const Model = getAulaModel(input.sourceType);
  const docs = await Model.find({
    _id: { $in: safeIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select({ dati: 1 })
    .lean();

  const byId = new Map<string, ResolvedSourceRecord>();
  for (const doc of docs as any[]) {
    const data = (doc.dati || {}) as Record<string, unknown>;
    byId.set(String(doc._id), {
      sourceId: String(doc._id),
      displayName: joinPreview(data, def.preview.title) || "(senza titolo)",
      subtitle: joinSubtitle(data, def.preview.subtitle) || null,
      data,
    });
  }
  return safeIds.map((id) => byId.get(id)).filter((item): item is ResolvedSourceRecord => !!item);
}

export function getBulkInviteFieldOptions(sourceKind: BulkInviteSourceKind, sourceType: string) {
  if (sourceKind === "anagrafica") {
    const def = getAnagraficaDef(sourceType);
    const emailFields = Object.entries(def.fields)
      .filter(([, field]) => ["email", "text"].includes(field.type as FieldInputType))
      .map(([key, field]) => ({ key, label: field.label, type: field.type }));
    const nameFields = Object.entries(def.fields)
      .filter(([, field]) => ["text", "email", "tel"].includes(field.type as FieldInputType))
      .map(([key, field]) => ({ key, label: field.label, type: field.type }));
    return { emailFields, nameFields };
  }

  const def = getAulaDef(sourceType);
  const emailFields = Object.entries(def.fields)
    .filter(([, field]) => ["text"].includes(field.type as AulaFieldInputType))
    .map(([key, field]) => ({ key, label: field.label, type: field.type }));
  const nameFields = Object.entries(def.fields)
    .filter(([, field]) => ["text"].includes(field.type as AulaFieldInputType))
    .map(([key, field]) => ({ key, label: field.label, type: field.type }));
  return { emailFields, nameFields };
}

export async function previewBulkUserInvitations(input: BulkSourceInput): Promise<BulkInvitePreview> {
  await connectToDatabase();
  const records = await resolveSourceRecords(input);

  const normalizedEmails = records
    .map((record) => normalizeEmail(record.data[input.emailFieldKey]))
    .filter((email): email is string => !!email);
  const duplicateEmails = new Set(
    normalizedEmails.filter((email, index) => normalizedEmails.indexOf(email) !== index),
  );

  const existingUsers = normalizedEmails.length
    ? await UserModel.find({ email: { $in: normalizedEmails } })
        .select({ email: 1, approved: 1 })
        .select("+password")
        .lean()
    : [];
  const existingByEmail = new Map(
    (existingUsers as any[]).map((user) => [String(user.email).toLowerCase(), user]),
  );

  const items = records.map((record): BulkInvitePreviewItem => {
    const normalizedEmail = normalizeEmail(record.data[input.emailFieldKey]);
    const username = normalizeText(record.data[input.nameFieldKey]);

    if (!normalizedEmail) {
      return {
        sourceId: record.sourceId,
        displayName: record.displayName,
        subtitle: record.subtitle,
        email: null,
        normalizedEmail: null,
        username,
        status: "missing_email",
        reason: "Campo email vuoto",
        existingUserId: null,
      };
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      return {
        sourceId: record.sourceId,
        displayName: record.displayName,
        subtitle: record.subtitle,
        email: normalizeText(record.data[input.emailFieldKey]),
        normalizedEmail,
        username,
        status: "invalid_email",
        reason: "Email non valida",
        existingUserId: null,
      };
    }

    if (duplicateEmails.has(normalizedEmail)) {
      return {
        sourceId: record.sourceId,
        displayName: record.displayName,
        subtitle: record.subtitle,
        email: normalizeText(record.data[input.emailFieldKey]),
        normalizedEmail,
        username,
        status: "duplicate_email",
        reason: "Email duplicata nella selezione bulk",
        existingUserId: String(existingByEmail.get(normalizedEmail)?._id || ""),
      };
    }

    const existingUser = existingByEmail.get(normalizedEmail);
    if (existingUser?.password) {
      return {
        sourceId: record.sourceId,
        displayName: record.displayName,
        subtitle: record.subtitle,
        email: normalizeText(record.data[input.emailFieldKey]),
        normalizedEmail,
        username,
        status: "active_user_conflict",
        reason: "Esiste già un utente attivo con questa email",
        existingUserId: String(existingUser._id),
      };
    }

    return {
      sourceId: record.sourceId,
      displayName: record.displayName,
      subtitle: record.subtitle,
      email: normalizeText(record.data[input.emailFieldKey]),
      normalizedEmail,
      username,
      status: existingUser ? "ready_regenerate" : "ready_create",
      reason: existingUser ? "Verrà rigenerato l'invito esistente" : "Pronto alla creazione",
      existingUserId: existingUser ? String(existingUser._id) : null,
    };
  });

  return {
    items,
    summary: {
      total: items.length,
      readyCreate: items.filter((item) => item.status === "ready_create").length,
      readyRegenerate: items.filter((item) => item.status === "ready_regenerate").length,
      missingEmail: items.filter((item) => item.status === "missing_email").length,
      invalidEmail: items.filter((item) => item.status === "invalid_email").length,
      duplicateEmail: items.filter((item) => item.status === "duplicate_email").length,
      activeUserConflict: items.filter((item) => item.status === "active_user_conflict").length,
    },
  };
}

async function assignSourcePermission(params: {
  userId: string;
  sourceKind: BulkInviteSourceKind;
  sourceType: string;
  sourceId: string;
}) {
  try {
    if (params.sourceKind === "anagrafica") {
      await createUserAnagraficaKey({
        userId: params.userId,
        anagraficaType: params.sourceType as any,
        anagraficaId: params.sourceId,
      });
    } else {
      await createUserAulaKey({
        userId: params.userId,
        aulaType: params.sourceType as any,
        aulaId: params.sourceId,
      });
    }
    return true;
  } catch (error: any) {
    if (error?.code === 11000 || String(error?.message || "").includes("duplicate key")) {
      return true;
    }
    throw error;
  }
}

export async function createBulkUserInvitations(params: BulkSourceInput & {
  role: AppRole;
  expiresInHours: number;
  sendEmail: boolean;
  throttleMs?: number;
  createdByUserId?: string | null;
  req: NextRequest;
}): Promise<BulkInviteCreateResult> {
  await connectToDatabase();
  const preview = await previewBulkUserInvitations(params);
  const actionable = new Set<BulkInvitePreviewItemStatus>(["ready_create", "ready_regenerate"]);
  const throttleMs = params.sendEmail ? Math.max(0, params.throttleMs ?? 1500) : 0;
  const items: BulkInviteCreateResultItem[] = [];

  for (const item of preview.items) {
    if (!actionable.has(item.status)) {
      items.push({ ...item, outcome: "skipped", error: item.reason, assignedPermission: false });
      continue;
    }

    try {
      const result = await createOrRegenerateInvitation({
        email: item.normalizedEmail || "",
        role: params.role,
        name: item.username || undefined,
        expiresInHours: params.expiresInHours,
        sendEmail: params.sendEmail,
        createdByUserId: params.createdByUserId,
        baseUrl: resolveInviteBaseUrl(params.req),
      });

      const assignedPermission = await assignSourcePermission({
        userId: result.userId,
        sourceKind: params.sourceKind,
        sourceType: params.sourceType,
        sourceId: item.sourceId,
      });

      items.push({
        ...item,
        outcome: result.mode === "created" ? "created" : "regenerated",
        inviteLink: result.inviteLink,
        expiresAt: result.expiresAt,
        messageId: result.messageId,
        assignedPermission,
        error: null,
      });

      if (throttleMs > 0) {
        await sleep(throttleMs);
      }
    } catch (error: any) {
      items.push({
        ...item,
        outcome: "failed",
        inviteLink: null,
        expiresAt: null,
        messageId: null,
        assignedPermission: false,
        error: error?.message || "Errore bulk non gestito",
      });
    }
  }

  return {
    items,
    summary: {
      total: items.length,
      created: items.filter((item) => item.outcome === "created").length,
      regenerated: items.filter((item) => item.outcome === "regenerated").length,
      skipped: items.filter((item) => item.outcome === "skipped").length,
      failed: items.filter((item) => item.outcome === "failed").length,
    },
  };
}
