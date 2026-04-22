"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { Notice, UserAdmin } from "../types";
import type { AppRole } from "@/types/roles";

import RoleSelect from "../ui/RoleSelect";
import UserAnagraficaManager from "../modals/UserAnagraficaManager";
import UserAulaManager from "../modals/UserAulaManager";
import UserBarcodeActionManager from "../modals/UserBarcodeActionManager";

import { apiDeleteUser, apiListUsers, apiRegenerateInvite, apiUpdateUserRole } from "../api";
import { ResourceListBox, Column } from "@/components/AtlasModuli/common/ResourceListBox"; // <-- adatta se serve

export default function UsersListBox({
  onNotice,
  refreshToken,
}: {
  onNotice: (n: Notice) => void;
  refreshToken?: number;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  function formatInviteCountdown(user: UserAdmin) {
    if (user.approved !== false) return null;
    if (!user.pendingInviteExpiresAt) return "Invito non ancora generato";
    if (user.pendingInviteExpired) return "Invito scaduto";

    const diffMs = new Date(user.pendingInviteExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return "Invito scaduto";

    const totalMinutes = Math.ceil(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `Invito: scade tra ${days}g ${hours}h`;
    if (hours > 0) return `Invito: scade tra ${hours}h ${minutes}m`;
    return `Invito: scade tra ${minutes}m`;
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const items = await apiListUsers();
      setUsers(items);
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore caricamento utenti" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        (u.email || "").toLowerCase().includes(q) ||
        (u.name || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  async function handleChangeRole(id: string, newRole: AppRole) {
    if (updatingId || deletingId || regeneratingId) return;
    setUpdatingId(id);

    try {
      await apiUpdateUserRole(id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
      onNotice({ type: "success", text: "Ruolo aggiornato" });
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore aggiornamento ruolo" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteUser(u: UserAdmin) {
    if (u.role === "Super") return;

    const ok = confirm("Sicuro di voler eliminare? È definitivo.");
    if (!ok) return;

    setDeletingId(u.id);
    try {
      await apiDeleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      onNotice({ type: "success", text: `Utente eliminato: ${u.email}` });
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore eliminazione utente" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRegenerateInvite(u: UserAdmin, sendEmail: boolean) {
    if (updatingId || deletingId || regeneratingId) return;

    setRegeneratingId(u.id);
    try {
      const result = await apiRegenerateInvite({
        userId: u.id,
        expiresInHours: 48,
        sendEmail,
      });

      setUsers((prev) =>
        prev.map((item) =>
          item.id === u.id
            ? {
                ...item,
                approved: false,
                pendingInviteExpiresAt: result.expiresAt,
                pendingInviteExpired: false,
              }
            : item,
        ),
      );

      onNotice({
        type: "success",
        text: sendEmail ? "Invito rigenerato e inviato." : "Invito rigenerato.",
      });
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore rigenerazione invito" });
    } finally {
      setRegeneratingId(null);
    }
  }

  const columns: Column<UserAdmin>[] = [
    {
      id: "main",
      header: "Utente",
      isMain: true,
      className: "col-span-5",
      render: (u) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-dark dark:text-white">{u.name}</div>
          <div className="truncate text-[12px] text-dark/70 dark:text-white/70">{u.email}</div>
          <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
            ID: <span className="break-all font-mono text-[10px]">{u.id}</span>
          </div>
          {u.approved === false ? (
            <div
              className={clsx(
                "mt-1 text-[11px]",
                u.pendingInviteExpired
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              {formatInviteCountdown(u)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "role",
      header: "Ruolo",
      className: "col-span-3",
      render: (u) => (
        <div className="min-w-0 max-w-[220px]">
          <RoleSelect
            value={u.role}
            onChange={(r) => handleChangeRole(u.id, r)}
            disabled={
              u.role === "Super" ||
              updatingId === u.id ||
              deletingId === u.id ||
              regeneratingId === u.id
            }
            size="sm"
          />
        </div>
      ),
    },
    {
      id: "status",
      header: "Stato",
      className: "col-span-2 hidden md:block",
      render: (u) => (
        <span
          className={clsx(
            "inline-flex rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap",
            u.approved === false
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
          )}
        >
          {u.approved === false ? "In attesa" : "Attivo"}
        </span>
      ),
    },
  ];

  return (
    <ResourceListBox<UserAdmin>
      title="Utenti"
      searchPlaceholder="Cerca per nome, email o ruolo…"
      query={query}
      setQuery={setQuery}
      loading={loading}
      items={filtered}
      emptyMessage="Nessun utente trovato."
      columns={columns}
      getKey={(u) => u.id}
      toolbarRight={
        <button
          type="button"
          onClick={loadUsers}
          className="rounded-md border border-stroke px-3 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
        >
          Aggiorna
        </button>
      }
      renderActions={(u) => {
        const isBusyRow = updatingId === u.id || deletingId === u.id || regeneratingId === u.id;
        const isSuper = u.role === "Super";

        return (
          <div className="flex flex-wrap justify-end gap-2">
            <UserAnagraficaManager user={u} onNotice={onNotice} />
            <UserAulaManager user={u} onNotice={onNotice} />
            <UserBarcodeActionManager user={u} onNotice={onNotice} />

            {u.approved === false ? (
              <>
                <button
                  type="button"
                  disabled={isBusyRow}
                  onClick={() => handleRegenerateInvite(u, false)}
                  className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition-opacity hover:bg-amber-50 disabled:opacity-40 dark:border-amber-700/70 dark:text-amber-200 dark:hover:bg-amber-900/20"
                >
                  {regeneratingId === u.id ? "..." : "Rigenera invito"}
                </button>

                <button
                  type="button"
                  disabled={isBusyRow}
                  onClick={() => handleRegenerateInvite(u, true)}
                  className="rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-opacity hover:bg-primary/5 disabled:opacity-40 dark:border-blue-400/40 dark:text-blue-200 dark:hover:bg-blue-400/10"
                >
                  {regeneratingId === u.id ? "..." : "Rigenera e invia"}
                </button>
              </>
            ) : null}

            <button
              type="button"
              disabled={isSuper || isBusyRow}
              onClick={() => handleDeleteUser(u)}
              className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              title={isSuper ? "Gli utenti Super non possono essere eliminati" : "Elimina utente"}
            >
              {deletingId === u.id ? "..." : "Delete"}
            </button>
          </div>
        );
      }}
      actionsColumnClassName="col-span-2"
    />
  );
}
