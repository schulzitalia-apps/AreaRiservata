"use client";

import { cn } from "@/server-utils/lib/utils";

export type MailEventAutoConfig = {
  enabled: boolean;
  eventoType: string;
  timeKind: "point" | "interval" | "deadline" | "recurring_master";
  startAtSource: "now" | "var";
  startAtVarPath?: string;
  endAtSource?: "var";
  endAtVarPath?: string;
  allDay?: boolean;
  visibilityRole?: string | null;
  dataPreset?: Record<string, any>;
  partecipante?: {
    anagraficaType?: string;
    anagraficaIdVarPath?: string;
    role?: string | null;
    status?: string | null;
    quantity?: number | null;
    note?: string | null;
  };
  gruppo?: {
    gruppoType?: string;
    gruppoIdVarPath?: string;
  };
};

export type MailTemplateLite = {
  key: string;
  name: string;
  subject: string;
  description?: string;

  // ✅ IMPORTANTISSIMO: il client deve riceverlo dal bootstrap
  eventAuto?: MailEventAutoConfig;
};

type Props = {
  items: MailTemplateLite[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  className?: string;
};

export default function TemplateList({ items, selectedKey, onSelect, className }: Props) {
  return (
    <aside
      className={cn(
        "w-full max-w-[22rem] border-l-2 border-stroke dark:border-dark-3",
        "bg-white dark:bg-gray-dark",
        className
      )}
    >
      <div className="px-6 py-4 border-b-2 border-stroke dark:border-dark-3">
        <h3 className="text-xl font-bold text-dark dark:text-white">Template</h3>
        <div className="mt-1 text-xs text-dark/60 dark:text-white/60">Seleziona un template per comporre l’email</div>
      </div>

      <ul className="custom-scrollbar max-h-[calc(100vh-240px)] overflow-y-auto p-4 space-y-3">
        {items.map((t) => {
          const hasAutoEvent = !!t.eventAuto?.enabled;

          return (
            <li key={t.key}>
              <button
                onClick={() => onSelect(t.key)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                  "border-stroke dark:border-dark-3",
                  selectedKey === t.key
                    ? "bg-red-100/60 border-primary dark:bg-red-900/30"
                    : "hover:bg-gray-2 dark:hover:bg-neutral-900"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-base font-semibold text-dark dark:text-white">{t.name}</span>

                  {hasAutoEvent ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary dark:text-red-400">
                      AUTOEVENT
                    </span>
                  ) : null}
                </div>

                <span className="truncate text-xs text-dark/70 dark:text-white/70 font-mono">{t.key}</span>
                <span className="truncate text-xs text-dark/70 dark:text-white/70">Oggetto: {t.subject}</span>

                {!!t.description && (
                  <span className="truncate text-xs text-dark/60 dark:text-white/60">{t.description}</span>
                )}

                {hasAutoEvent ? (
                  <span className="truncate text-[11px] text-dark/60 dark:text-white/60">
                    Evento: <span className="font-mono">{t.eventAuto?.eventoType || "—"}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}

        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-dark/60 dark:text-white/60">Nessun template disponibile.</li>
        )}
      </ul>
    </aside>
  );
}
