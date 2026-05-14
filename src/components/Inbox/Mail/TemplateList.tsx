"use client";

import { useMemo, useState } from "react";
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
  html?: string;
  description?: string;
  eventAuto?: MailEventAutoConfig;
};

type Props = {
  items: MailTemplateLite[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  onStartBlank?: () => void;
  onClearSelection?: () => void;
  className?: string;
  variant?: "sidebar" | "panel";
};

export default function TemplateList(props: Props) {
  const [query, setQuery] = useState("");
  const variant = props.variant ?? "sidebar";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.items;

    return props.items.filter((item) =>
      `${item.name} ${item.key} ${item.subject} ${item.description || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [props.items, query]);

  return (
    <aside
      className={cn(
        variant === "sidebar"
          ? "w-full max-w-[22rem] border-l border-stroke/80 bg-white dark:border-dark-3/80 dark:bg-gray-dark"
          : "w-full rounded-2xl border border-stroke/80 bg-white dark:border-dark-3/80 dark:bg-gray-dark",
        props.className,
      )}
    >
      <div className="border-b border-stroke/80 px-4 py-4 dark:border-dark-3/80">
        <div className="text-base font-semibold text-dark dark:text-white">
          {variant === "sidebar" ? "Template" : "Template opzionale"}
        </div>
        <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
          Selezionandolo, soggetto e corpo si aggiornano subito. Se vuoi, puoi anche scrivere la mail da zero.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.onStartBlank ? (
            <button
              type="button"
              onClick={props.onStartBlank}
              className="rounded-xl border border-stroke px-3 py-2 text-xs font-semibold text-dark transition hover:bg-gray-1 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Nuova mail libera
            </button>
          ) : null}
          {props.onClearSelection && props.selectedKey ? (
            <button
              type="button"
              onClick={props.onClearSelection}
              className="rounded-xl border border-stroke px-3 py-2 text-xs font-semibold text-dark/70 transition hover:bg-gray-1 hover:text-dark dark:border-dark-3 dark:text-white/70 dark:hover:bg-dark-2 dark:hover:text-white"
            >
              Togli template
            </button>
          ) : null}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca template..."
          className="mt-3 w-full rounded-xl border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-black/20 dark:text-white"
        />
      </div>

      <ul
        className={cn(
          "space-y-2 overflow-y-auto p-4",
          variant === "sidebar" ? "max-h-[calc(100vh-230px)]" : "max-h-[420px]",
        )}
      >
        {filtered.map((template) => {
          const isSelected = props.selectedKey === template.key;

          return (
            <li key={template.key}>
              <button
                onClick={() => props.onSelect(template.key)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition",
                  "border-stroke/80 bg-white hover:border-primary/30 hover:bg-gray-1 dark:border-dark-3/80 dark:bg-transparent dark:hover:bg-dark-2/60",
                  isSelected && "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(245,32,32,0.08)]",
                )}
              >
                  <div className="truncate text-sm font-semibold text-dark dark:text-white">
                    {template.name}
                  </div>
                  {template.description ? (
                    <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-dark/60 dark:text-white/60">
                      {template.description}
                    </div>
                  ) : null}
                  <div className="mt-2 truncate text-xs text-dark/60 dark:text-white/60">
                    {template.subject}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-dark/45 dark:text-white/45">{template.key}</span>
                    {isSelected ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        Attivo
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
        })}

        {filtered.length === 0 ? (
          <li className="rounded-xl border border-dashed border-stroke/80 px-3 py-6 text-center text-sm text-dark/60 dark:border-dark-3/80 dark:text-white/60">
            Nessun template trovato.
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
