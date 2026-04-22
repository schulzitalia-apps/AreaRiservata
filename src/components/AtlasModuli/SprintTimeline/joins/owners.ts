"use client";

import type { AnagraficaFull } from "@/components/Store/models/anagrafiche";

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isMongoId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  try {
    const res = await fetch("/api/admin/users/list", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) return [];

    const json = await res.json().catch(() => null);
    return Array.isArray(json?.items) ? (json.items as AdminUserListItem[]) : [];
  } catch {
    return [];
  }
}

export async function resolveOwnerIdByName(
  ownerName?: string,
): Promise<string | undefined> {
  const normalized = ownerName?.trim();
  if (!normalized) return undefined;

  const users = await listAdminUsers();
  if (!users.length) return undefined;

  const normalizedLower = normalized.toLowerCase();

  const exact = users.find(
    (user) => user.name?.trim().toLowerCase() === normalizedLower,
  );

  if (exact?.id) return exact.id;

  const emailMatch = users.find(
    (user) => user.email?.trim().toLowerCase() === normalizedLower,
  );

  return emailMatch?.id;
}

export async function resolveOwnerNameMap(
  tasks: AnagraficaFull[],
): Promise<Record<string, string | null>> {
  const ownerIds = Array.from(
    new Set(
      tasks
        .map((task) => asString(task.data?.titolareTask))
        .filter((value): value is string => !!value && isMongoId(value)),
    ),
  );

  if (!ownerIds.length) return {};

  try {
    const users = await listAdminUsers();
    if (!users.length) return {};

    return Object.fromEntries(
      ownerIds.map((id) => {
        const user = users.find((item) => item.id === id);
        return [id, user?.name || null];
      }),
    );
  } catch {
    return {};
  }
}
