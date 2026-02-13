"use client";

import { cn } from "@/server-utils/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Props = {
  templateKey: string;

  subject: string;
  bodyText: string;

  hint?: string;

  onChangeSubject: (v: string) => void;
  onChangeBodyText: (v: string) => void;

  disabled?: boolean;
};

export default function MailPreview({
                                      templateKey,
                                      subject,
                                      bodyText,
                                      hint,
                                      onChangeSubject,
                                      onChangeBodyText,
                                      disabled,
                                    }: Props) {
  const hasPreview = !!subject || !!bodyText;

  const [localSubject, setLocalSubject] = useState(subject || "");
  const [localBody, setLocalBody] = useState(bodyText || "");

  // keep in sync quando cambiano da fuori (auto/generata)
  useEffect(() => setLocalSubject(subject || ""), [subject]);
  useEffect(() => setLocalBody(bodyText || ""), [bodyText]);

  const disabledFinal = !!disabled;

  const badge = useMemo(() => {
    if (!hasPreview) return "—";
    return "EDITABILE";
  }, [hasPreview]);

  return (
    <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-dark dark:text-white">Anteprima</div>
          <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
            Template: <span className="font-mono">{templateKey || "—"}</span>{" "}
            <span className="ml-2 rounded-full bg-gray-2 px-2 py-0.5 text-[11px] font-semibold text-dark dark:bg-dark-2 dark:text-white">
              {badge}
            </span>
          </div>
        </div>
      </div>

      {!hasPreview ? (
        <div className="rounded-md bg-gray-1/40 p-4 text-sm text-dark/70 dark:bg-dark-2/50 dark:text-white/70">
          {hint || "Nessuna anteprima disponibile."}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-stroke p-3 dark:border-dark-3">
            <div className="text-[11px] font-semibold text-dark/70 dark:text-white/70">Oggetto</div>

            <input
              value={localSubject}
              disabled={disabledFinal}
              onChange={(e) => {
                const v = e.target.value;
                setLocalSubject(v);
                onChangeSubject(v);
              }}
              className={cn(
                "mt-2 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary",
                "dark:border-dark-3 dark:text-white",
                disabledFinal && "opacity-60 cursor-not-allowed"
              )}
              placeholder="Oggetto email…"
            />
          </div>

          <div className="rounded-md border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-dark/70 dark:text-white/70">Corpo email</div>
              <div className="text-[11px] text-dark/50 dark:text-white/50">
                Scrivi qui dentro: questa è la bozza che verrà inviata.
              </div>
            </div>

            <textarea
              value={localBody}
              disabled={disabledFinal}
              onChange={(e) => {
                const v = e.target.value;
                setLocalBody(v);
                onChangeBodyText(v);
              }}
              className={cn(
                "min-h-[220px] w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-[13px] leading-6 text-dark outline-none focus:border-primary",
                "dark:border-dark-3 dark:text-white",
                disabledFinal && "opacity-60 cursor-not-allowed"
              )}
              placeholder="Testo email…"
              spellCheck={false}
            />

            <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60">
              (Il testo verrà convertito in HTML semplice: paragrafi + a capo.)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
