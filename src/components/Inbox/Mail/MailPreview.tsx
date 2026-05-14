"use client";

import { cn } from "@/server-utils/lib/utils";

type Props = {
  templateKey: string;
  templateLabel?: string;
  subject: string;
  bodyText: string;
  placeholderRefs?: string[];
  suggestedVars?: Record<string, any>;
  hint?: string;
  onChangeSubject: (v: string) => void;
  onChangeBodyText: (v: string) => void;
  disabled?: boolean;
  draftMode?: "auto" | "generated" | "manual";
  onGenerate?: () => void;
  onResetTemplate?: () => void;
  onClearDraft?: () => void;
  generateDisabled?: boolean;
  canResetTemplate?: boolean;
  composing?: boolean;
};

export default function MailPreview(props: Props) {
  const hasContent = !!props.subject || !!props.bodyText;
  const suggestionEntries = Object.entries(props.suggestedVars || {}).filter(([, value]) => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value !== "object" || Object.keys(value).length > 0;
  });
  const modeLabel =
    props.draftMode === "generated"
      ? "Bozza AI"
      : props.draftMode === "manual"
        ? "Bozza manuale"
        : props.templateKey
          ? "Bozza da template"
          : "Bozza libera";

  return (
    <div className="rounded-[24px] border border-stroke/80 bg-white p-5 dark:border-dark-3/80 dark:bg-gray-dark">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-dark dark:text-white">Bozza mail</div>
          <div className="mt-1 text-sm text-dark/60 dark:text-white/60">
            Qui puoi lavorare in modo libero: template, AI e modifica manuale convivono nello stesso spazio.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-stroke px-2.5 py-1 font-semibold text-dark/70 dark:border-dark-3 dark:text-white/70">
              {modeLabel}
            </span>
            {props.templateKey ? (
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-medium text-primary">
                Template: {props.templateLabel || props.templateKey}
              </span>
            ) : (
              <span className="rounded-full border border-stroke px-2.5 py-1 font-medium text-dark/55 dark:border-dark-3 dark:text-white/55">
                Nessun template attivo
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {props.onResetTemplate ? (
            <button
              type="button"
              onClick={props.onResetTemplate}
              disabled={!props.canResetTemplate}
              className={cn(
                "rounded-xl border border-stroke px-3 py-2 text-xs font-semibold text-dark transition hover:bg-gray-1 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2",
                !props.canResetTemplate && "cursor-not-allowed opacity-50",
              )}
            >
              Ripristina template
            </button>
          ) : null}
          {props.onClearDraft ? (
            <button
              type="button"
              onClick={props.onClearDraft}
              className="rounded-xl border border-stroke px-3 py-2 text-xs font-semibold text-dark/70 transition hover:bg-gray-1 hover:text-dark dark:border-dark-3 dark:text-white/70 dark:hover:bg-dark-2 dark:hover:text-white"
            >
              Svuota bozza
            </button>
          ) : null}
          {props.onGenerate ? (
            <button
              type="button"
              onClick={props.onGenerate}
              disabled={props.generateDisabled}
              className={cn(
                "rounded-xl border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5",
                props.generateDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              {props.composing ? "Genero..." : "Genera con AI"}
            </button>
          ) : null}
        </div>
      </div>

      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-stroke/80 px-4 py-8 text-sm text-dark/60 dark:border-dark-3/80 dark:text-white/60">
          {props.hint || "Nessun contenuto disponibile."}
        </div>
      ) : (
        <div className="space-y-4">
          {props.placeholderRefs?.length ? (
            <div className="rounded-2xl border border-stroke/80 bg-gray-1/20 p-4 dark:border-dark-3/80 dark:bg-black/10">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-dark/50 dark:text-white/50">
                Riferimenti template
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.placeholderRefs.map((ref) => (
                  <span
                    key={ref}
                    className="rounded-full border border-stroke px-2.5 py-1 font-mono text-[11px] text-dark/70 dark:border-dark-3 dark:text-white/70"
                  >
                    {`{{${ref}}}`}
                  </span>
                ))}
              </div>
              {suggestionEntries.length ? (
                <div className="mt-4 grid gap-2">
                  {suggestionEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-stroke/70 bg-white px-3 py-2 text-xs text-dark dark:border-dark-3/70 dark:bg-dark-2/60 dark:text-white"
                    >
                      <span className="font-mono font-semibold">{key}</span>
                      <span className="mx-2 text-dark/35 dark:text-white/35">{"->"}</span>
                      <span>{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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
