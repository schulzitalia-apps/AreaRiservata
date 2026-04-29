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
  meta?: string;
};

type CcRecipientPill = {
  key: string;
  label: string;
  email: string;
  meta?: string;
};

type Props = {
  disabled: boolean;
  to: string;
  onChangeTo: (v: string) => void;
  ccRecipients: CcRecipientPill[];
  onOpenCcPicker: () => void;
  onRemoveCcRecipient: (key: string) => void;
  senderOptions: SenderOption[];
  senderIdentityId: string;
  onChangeSenderIdentityId: (id: string) => void;
  onOpenRecipientPicker: () => void;
  recipientPill?: RecipientPill | null;
  onClearRecipient?: () => void;
};

export default function MailComposer(props: Props) {
  const hardDisabled = props.disabled;

  return (
    <div className="rounded-2xl border border-stroke/80 bg-white p-4 dark:border-dark-3/80 dark:bg-gray-dark">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-dark dark:text-white">
              Destinatario
            </label>
            <button
              onClick={props.onOpenRecipientPicker}
              disabled={hardDisabled}
              className={cn(
                "rounded-xl border border-stroke px-3 py-1.5 text-xs font-semibold text-dark transition hover:bg-gray-1",
                "dark:border-dark-3 dark:text-white dark:hover:bg-dark-2",
                hardDisabled && "cursor-not-allowed opacity-60",
              )}
            >
              Cerca in anagrafiche
            </button>
          </div>

          <input
            value={props.to}
            onChange={(e) => props.onChangeTo(e.target.value)}
            placeholder="cliente@dominio.it"
            disabled={hardDisabled}
            className={cn(
              "w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary",
              "dark:border-dark-3 dark:bg-black/20 dark:text-white",
              hardDisabled && "opacity-60",
            )}
          />

          {props.recipientPill ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-1 px-3 py-1 text-xs font-medium text-dark dark:bg-dark-2 dark:text-white">
                <span>{props.recipientPill.label}</span>
                {props.recipientPill.meta ? (
                  <span className="text-dark/50 dark:text-white/50">{props.recipientPill.meta}</span>
                ) : null}
              </div>

              {props.onClearRecipient ? (
                <button
                  onClick={props.onClearRecipient}
                  className="text-xs font-semibold text-dark/60 hover:text-dark dark:text-white/60 dark:hover:text-white"
                >
                  Rimuovi
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm font-semibold text-dark dark:text-white">
                    Copia
                  </label>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                      props.ccRecipients.length
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-1 text-dark/55 dark:bg-dark-2 dark:text-white/55",
                    )}
                  >
                    {props.ccRecipients.length
                      ? `${props.ccRecipients.length} email`
                      : "Nessuna email"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                  {props.ccRecipients.length
                    ? "Questi destinatari riceveranno la mail in copia, senza influenzare la generazione del testo."
                    : "I destinatari in copia non influenzano il testo generato."}
                </div>
              </div>
              <button
                onClick={props.onOpenCcPicker}
                disabled={hardDisabled}
                className={cn(
                  "rounded-xl border border-stroke px-3 py-1.5 text-xs font-semibold text-dark transition hover:bg-gray-1",
                  "dark:border-dark-3 dark:text-white dark:hover:bg-dark-2",
                  hardDisabled && "cursor-not-allowed opacity-60",
                )}
              >
                Aggiungi copia
              </button>
            </div>

            {props.ccRecipients.length ? (
              <div className="rounded-2xl border border-stroke/80 bg-gray-1/40 p-3 dark:border-dark-3/80 dark:bg-black/10">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/50 dark:text-white/50">
                    Destinatari in copia
                  </div>
                  <div className="text-[11px] text-dark/45 dark:text-white/45">
                    Verifica sempre le email prima dell&apos;invio
                  </div>
                </div>

                <div className="grid gap-2">
                  {props.ccRecipients.map((recipient) => (
                    <div
                      key={recipient.key}
                      className="rounded-2xl border border-stroke/70 bg-white px-3 py-3 dark:border-dark-3/70 dark:bg-dark-2/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-dark dark:text-white">
                            {recipient.label}
                          </div>
                          {recipient.meta ? (
                            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-dark/45 dark:text-white/45">
                              {recipient.meta}
                            </div>
                          ) : null}
                        </div>

                        <button
                          onClick={() => props.onRemoveCcRecipient(recipient.key)}
                          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-dark/50 transition hover:bg-gray-1 hover:text-dark dark:text-white/50 dark:hover:bg-dark-3 dark:hover:text-white"
                          aria-label={`Rimuovi ${recipient.email}`}
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="mt-3 rounded-xl border border-stroke/70 bg-gray-1/60 px-3 py-2 text-sm font-medium text-dark dark:border-dark-3/70 dark:bg-black/20 dark:text-white">
                        {recipient.email}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stroke/80 bg-gray-1/20 px-4 py-4 dark:border-dark-3/80 dark:bg-black/10">
                <div className="text-sm font-medium text-dark dark:text-white">
                  Nessuna email in copia selezionata
                </div>
                <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                  Usa il pulsante &quot;Aggiungi copia&quot; per cercare altri destinatari in anagrafiche o nelle aule.
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-dark dark:text-white">
            Mittente
          </label>
          <select
            value={props.senderIdentityId}
            onChange={(e) => props.onChangeSenderIdentityId(e.target.value)}
            disabled={hardDisabled}
            className={cn(
              "w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm outline-none transition focus:border-primary",
              "dark:border-dark-3 dark:text-white",
              hardDisabled && "opacity-60",
            )}
          >
            {props.senderOptions.length === 0 ? (
              <option value="">- nessun mittente disponibile -</option>
            ) : (
              props.senderOptions.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.label} - {sender.fromEmail}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
