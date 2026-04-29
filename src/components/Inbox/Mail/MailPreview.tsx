"use client";

import { cn } from "@/server-utils/lib/utils";

type Props = {
  templateKey: string;
  subject: string;
  bodyText: string;
  hint?: string;
  onChangeSubject: (v: string) => void;
  onChangeBodyText: (v: string) => void;
  disabled?: boolean;
};

export default function MailPreview(props: Props) {
  const hasContent = !!props.subject || !!props.bodyText;

  return (
    <div className="rounded-2xl border border-stroke/80 bg-white p-4 dark:border-dark-3/80 dark:bg-gray-dark">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-dark dark:text-white">Testo mail</div>
          <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
            Template: <span className="font-mono">{props.templateKey || "-"}</span>
          </div>
        </div>
      </div>

      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-stroke/80 px-4 py-8 text-sm text-dark/60 dark:border-dark-3/80 dark:text-white/60">
          {props.hint || "Nessun contenuto disponibile."}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-dark dark:text-white">
              Oggetto
            </label>
            <input
              value={props.subject || ""}
              disabled={props.disabled}
              onChange={(e) => props.onChangeSubject(e.target.value)}
              className={cn(
                "w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary",
                "dark:border-dark-3 dark:bg-black/20 dark:text-white",
                props.disabled && "opacity-60",
              )}
              placeholder="Oggetto email..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-dark dark:text-white">
              Corpo
            </label>
            <textarea
              value={props.bodyText || ""}
              disabled={props.disabled}
              onChange={(e) => props.onChangeBodyText(e.target.value)}
              className={cn(
                "min-h-[460px] w-full resize-y rounded-xl border border-stroke bg-white px-4 py-3 text-sm leading-7 text-dark outline-none transition focus:border-primary xl:min-h-[540px]",
                "dark:border-dark-3 dark:bg-black/20 dark:text-white",
                props.disabled && "opacity-60",
              )}
              placeholder="Scrivi il testo della mail..."
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
