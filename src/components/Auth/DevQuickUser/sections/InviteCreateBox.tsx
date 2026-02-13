"use client";

import { useMemo, useState } from "react";
import type { InviteResult, Notice } from "../types";
import RoleSelect from "../ui/RoleSelect";
import { apiCreateInvite } from "../api";
import { ROLES, type AppRole } from "@/types/roles";

export default function InviteCreateBox({
                                          onNotice,
                                          onAfterInvite,
                                        }: {
  onNotice: (n: Notice) => void;
  onAfterInvite?: () => void;
}) {
  const [email, setEmail] = useState("demo@example.com");
  const [name, setName] = useState("Demo User");

  const DEFAULT_ROLE: AppRole =
    ROLES.includes("Cliente" as AppRole) ? ("Cliente" as AppRole) : (ROLES[0] as AppRole);
  const [role, setRole] = useState<AppRole>(DEFAULT_ROLE);

  const [expiresInHours, setExpiresInHours] = useState<number>(48);

  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const canCreate = useMemo(() => {
    return email.trim().length > 3 && !busy;
  }, [email, busy]);

  async function createInvite(sendEmail: boolean) {
    if (!canCreate) return;

    setBusy(true);
    try {
      const result = await apiCreateInvite({
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        expiresInHours,
        sendEmail,
      });

      setInvite(result);

      onNotice({
        type: "success",
        text: sendEmail ? "Invito creato e inviato via mail." : "Invito creato. Copia il link.",
      });

      onAfterInvite?.();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore creazione invito" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="border-b border-stroke p-4 dark:border-dark-3">
        <h2 className="text-base font-semibold text-dark dark:text-white">Crea invito</h2>
        <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
          Crea un utente “stub” non approvato e genera un link di attivazione. L’utente imposta la password da solo.
        </p>
      </div>

      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-dark dark:text-white">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="text-sm text-dark dark:text-white">
            Nome (opzionale)
            <input
              className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>

          <RoleSelect label="Ruolo" value={role} onChange={setRole} />

          <label className="text-sm text-dark dark:text-white">
            Scadenza invito (ore)
            <input
              className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              type="number"
              min={1}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value || 48))}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={() => createInvite(false)}
            disabled={!canCreate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
          >
            {busy && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Genera link
          </button>

          <button
            onClick={() => createInvite(true)}
            disabled={!canCreate}
            className="inline-flex items-center justify-center rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Genera e invia mail
          </button>
        </div>

        {invite && (
          <div className="mt-4 rounded-lg border border-stroke bg-white p-3 text-xs dark:border-dark-3 dark:bg-gray-dark/40">
            <div className="font-semibold text-dark dark:text-white">Link di attivazione</div>

            <div className="mt-1 text-[11px] text-dark/70 dark:text-white/70">
              Email: <span className="font-mono">{invite.email}</span> · Scade:{" "}
              <span className="font-mono">{new Date(invite.expiresAt).toLocaleString()}</span>
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                readOnly
                value={invite.inviteLink}
                className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-[11px] font-mono text-dark outline-none dark:border-dark-3 dark:text-white"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(invite.inviteLink);
                    onNotice({ type: "success", text: "Link copiato negli appunti" });
                  }}
                  className="rounded-md border border-stroke px-3 py-1.5 text-[11px] font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                >
                  Copia
                </button>

                <a
                  href={invite.inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90"
                >
                  Apri
                </a>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60">
              {invite.mailSent ? "Mail: inviata." : "Mail: non inviata."}
              {invite.messageId ? (
                <>
                  {" "}
                  · messageId: <span className="font-mono">{invite.messageId}</span>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
