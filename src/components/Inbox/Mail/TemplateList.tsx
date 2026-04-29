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
  description?: string;
  eventAuto?: MailEventAutoConfig;
};

type Props = {
  items: MailTemplateLite[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  className?: string;
};

export default function TemplateList(props: Props) {
  const [query, setQuery] = useState("");

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
        "w-full max-w-[22rem] border-l border-stroke/80 bg-white dark:border-dark-3/80 dark:bg-gray-dark",
        props.className,
      )}
    >
      <div className="border-b border-stroke/80 px-4 py-4 dark:border-dark-3/80">
        <div className="text-base font-semibold text-dark dark:text-white">Template</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca template..."
          className="mt-3 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-black/20 dark:text-white"
        />
      </div>

      <ul className="max-h-[calc(100vh-230px)] space-y-2 overflow-y-auto p-4">
        {filtered.map((template) => {
          const isSelected = props.selectedKey === template.key;

          return (
            <li key={template.key}>
              <button
                onClick={() => props.onSelect(template.key)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  "border-stroke/80 bg-white hover:bg-gray-1 dark:border-dark-3/80 dark:bg-transparent dark:hover:bg-dark-2/60",
                  isSelected && "border-primary bg-primary/5",
                )}
              >
                <div className="truncate text-sm font-semibold text-dark dark:text-white">
                  {template.name}
                </div>
                <div className="mt-1 truncate text-xs text-dark/60 dark:text-white/60">
                  {template.subject}
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
