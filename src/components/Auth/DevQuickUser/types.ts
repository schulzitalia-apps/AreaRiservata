import type { AppRole } from "@/types/roles";
import type { BarcodeActionId  } from "@/config/barcode.config";

export type Notice = { type: "success" | "error" | "info"; text: string } | null;

export type UserAdmin = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  // opzionale, se in futuro lo aggiungi alla API list
  approved?: boolean;
};

export type InviteResult = {
  email: string;
  inviteLink: string;
  expiresAt: string;
  mailSent: boolean;
  messageId?: string | null; // ✅ nuovo (utile per debug)
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

export type BarcodeAction = BarcodeActionId;
