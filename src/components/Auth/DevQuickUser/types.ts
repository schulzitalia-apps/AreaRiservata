import type { AppRole } from "@/types/roles";
import type { BarcodeActionId  } from "@/config/barcode.config";

export type Notice = { type: "success" | "error" | "info"; text: string } | null;

export type UserAdmin = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  approved?: boolean;
  pendingInviteExpiresAt?: string | null;
  pendingInviteExpired?: boolean;
};

export type InviteResult = {
  email: string;
  inviteLink: string;
  expiresAt: string;
  mailSent: boolean;
  userId?: string;
  mode?: "created" | "regenerated";
  messageId?: string | null; // ✅ nuovo (utile per debug)
};

export type BulkInviteSourceKind = "anagrafica" | "aula";

export type BulkInviteFieldOption = {
  key: string;
  label: string;
  type: string;
};

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

export type BulkInvitePreviewResult = {
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
  fieldOptions?: {
    emailFields: BulkInviteFieldOption[];
    nameFields: BulkInviteFieldOption[];
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

export type UserAnagraficaAssigned = {
  type: string;
  anagraficaId: string;
  displayName: string;
  subtitle: string | null;
  updatedAt: string | null;
};

export type AnagraficaSearchItem = {
  id: string;
  displayName: string;
  subtitle: string | null;
};

export type UserAulaAssigned = {
  type: string;
  aulaId: string;
  displayName: string;
  subtitle: string | null;
  updatedAt: string | null;
};

export type AulaSearchItem = {
  id: string;
  displayName: string;
  subtitle: string | null;
};

export type BarcodeAction = BarcodeActionId;
