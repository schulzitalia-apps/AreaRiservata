"use client";

import { cn } from "@/server-utils/lib/utils";

export type SenderOption = {
  id: string;
  label: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
};

type RecipientPill = {
  label: string;
  meta?: string; // es: "clienti · 66a..."
};

type Props = {
  disabled: boolean;

  to: string;
  onChangeTo: (v: string) => void;

  senderOptions: SenderOption[];
  senderIdentityId: string;
  onChangeSenderIdentityId: (id: string) => void;

  onOpenRecipientPicker: () => void;
  recipientPill?: RecipientPill | null;
  onClearRecipient?: () => void;
};

export default function MailComposer({
                                       disabled,
                                       to,
                                       onChangeTo,
                                       senderOptions,
                                       senderIdentityId,
                                       onChangeSenderIdentityId,
                                       onOpenRecipientPicker,
                                       recipientPill,
                                       onClearRecipient,
                                     }: Props) {
  const hardDisabled = disabled;

  return (
    <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-semibold text-dark dark:text-white">Componi</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-dark dark:text-white">To (destinatario)</label>

            <button
              onClick={onOpenRecipientPicker}
              disabled={hardDisabled}
              className={cn(
                "rounded-xl border border-stroke px-3 py-1 text-[11px] font-semibold text-dark hover:bg-gray-2",
                "dark:border-dark-3 dark:text-white dark:hover:bg-dark-2",
                hardDisabled && "opacity-60 cursor-not-allowed"
              )}
            >
              Cerca in anagrafiche
            </button>
          </div>

          <input
            value={to}
            onChange={(e) => onChangeTo(e.target.value)}
            placeholder="cliente@dominio.it"
            disabled={hardDisabled}
            className={cn(
              "mt-1 w-full rounded-2xl border-2 border-stroke bg-white px-4 py-2 text-sm text-dark outline-none focus:border-primary",
              "dark:border-dark-3 dark:bg-black dark:text-white",
              hardDisabled && "opacity-60"
            )}
          />

          {recipientPill ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary px-3 py-1 text-[11px] font-semibold text-primary dark:border-red-400 dark:text-red-400">
                <span className="truncate max-w-[220px]">{recipientPill.label}</span>
                {recipientPill.meta ? <span className="opacity-70">· {recipientPill.meta}</span> : null}
              </div>

              {onClearRecipient ? (
                <button
                  onClick={onClearRecipient}
                  className="text-[11px] font-semibold text-dark/70 hover:text-dark dark:text-white/70 dark:hover:text-white"
                >
                  Rimuovi
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60">
              Suggerimento: usa “Cerca in anagrafiche” per compilare automaticamente.
            </div>
          )}
        </div>

        <label className="text-xs text-dark dark:text-white">
          Mittente
          <select
            value={senderIdentityId}
            onChange={(e) => onChangeSenderIdentityId(e.target.value)}
            disabled={hardDisabled}
            className={cn(
              "mt-1 w-full rounded-2xl border-2 border-stroke bg-transparent px-4 py-2 text-sm outline-none focus:border-primary",
              "dark:border-dark-3 dark:text-white",
              hardDisabled && "opacity-60"
            )}
          >
            {senderOptions.length === 0 ? (
              <option value="">— nessun mittente disponibile —</option>
            ) : (
              senderOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.fromEmail}
                </option>
              ))
            )}
          </select>

          <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
            Il mittente è scelto dal tuo ruolo (o puoi cambiarlo se consentito).
          </div>
        </label>
      </div>
    </div>
  );
}
