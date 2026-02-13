import type { AppRole } from "@/types/roles";
import type { UserAdmin, InviteResult, UserAnagraficaAssigned } from "./types";
import type { BarcodeActionId } from "@/config/barcode.config";

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Errore richiesta");
  return json;
}

export async function apiListUsers(): Promise<UserAdmin[]> {
  const res = await fetch("/api/admin/users/list", { credentials: "include" });
  const json = await readJson(res);
  const items = (json.items || []) as any[];

  return items.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as AppRole,
    approved: u.approved,
  }));
}

export async function apiUpdateUserRole(userId: string, role: AppRole): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  await readJson(res);
}

export async function apiDeleteUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  await readJson(res);
}

export async function apiCreateInvite(args: {
  email: string;
  name?: string;
  role: AppRole;
  expiresInHours: number;
  sendEmail: boolean;
}): Promise<InviteResult> {
  const res = await fetch("/api/admin/invitations/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(args),
  });
  const json = await readJson(res);

  return {
    email: json.email,
    inviteLink: json.inviteLink,
    expiresAt: json.expiresAt,
    mailSent: !!json.mailSent,
    messageId: json.messageId ?? null, // ✅ nuovo (se presente)
  };
}

export async function apiListAssignedAnagrafiche(userId: string): Promise<UserAnagraficaAssigned[]> {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(userId)}/anagrafiche-keys`,
    { credentials: "include" }
  );
  const json = await readJson(res);
  const items = (json.items || []) as any[];

  return items.map((it) => ({
    type: it.type,
    anagraficaId: it.anagraficaId,
    displayName: it.displayName,
    subtitle: it.subtitle ?? null,
    updatedAt: it.updatedAt ?? null,
  }));
}

export async function apiAttachAnagrafica(args: {
  userId: string;
  anagraficaType: string;
  anagraficaId: string;
}): Promise<void> {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(args.userId)}/anagrafiche-keys`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        anagraficaType: args.anagraficaType,
        anagraficaId: args.anagraficaId,
      }),
    }
  );
  await readJson(res);
}

export async function apiDetachAnagrafica(args: {
  userId: string;
  anagraficaType: string;
  anagraficaId: string;
}): Promise<void> {
  const res = await fetch(
    `/api/admin/users/${encodeURIComponent(args.userId)}/anagrafiche-keys`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        anagraficaType: args.anagraficaType,
        anagraficaId: args.anagraficaId,
      }),
    }
  );
  await readJson(res);
}

export async function apiSearchAnagrafiche(args: {
  typeSlug: string;
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<{ id: string; displayName: string; subtitle: string | null }[]> {
  const params = new URLSearchParams();
  if (args.query.trim()) params.set("query", args.query.trim());
  params.set("page", String(args.page ?? 1));
  params.set("pageSize", String(args.pageSize ?? 20));

  const res = await fetch(
    `/api/anagrafiche/${encodeURIComponent(args.typeSlug)}?${params.toString()}`,
    { credentials: "include" }
  );
  const json = await readJson(res);
  const items = (json.items || []) as any[];

  return items.map((m) => ({
    id: m.id,
    displayName: m.displayName || "(senza titolo)",
    subtitle: m.subtitle ?? null,
  }));
}

/**
 * ✅ NUOVO:
 * Legge l'azione già associata all'utente (per pre-selezionare nel modal admin)
 * GET /api/barcodes/action-by-user/:userId
 */
export async function apiGetBarcodeActionByUser(userId: string): Promise<{
  userId: string;
  actionId: BarcodeActionId | null;
  actionLabel: string | null;
}> {
  const res = await fetch(
    `/api/barcodes/action-by-user/${encodeURIComponent(userId)}`,
    { credentials: "include" }
  );
  return await readJson(res);
}

/**
 * ✅ aggiornato:
 * - prima: { userId, action: string }
 * - ora:   { userId, actionId: BarcodeActionId }
 *
 * Lato API server conviene accettare anche il legacy "action"
 * (actionId || action) per non rompere nulla.
 */
export async function apiSetBarcodeAction(args: {
  userId: string;
  actionId: BarcodeActionId;
}): Promise<{ id: string | null }> {
  const res = await fetch("/api/barcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: args.userId, actionId: args.actionId }),
  });
  const json = await readJson(res);
  return { id: json.id || null };
}
