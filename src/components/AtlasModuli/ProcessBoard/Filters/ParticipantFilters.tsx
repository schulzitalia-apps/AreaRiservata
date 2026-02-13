"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import type { WhiteboardParticipant } from "../types";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";

type Props = {
  participants: WhiteboardParticipant[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

export default function ParticipantFilters({
                                             participants,
                                             selectedKeys,
                                             onToggle,
                                             onSelectAll,
                                             onSelectNone,
                                           }: Props) {
  const [open, setOpen] = useState(false);

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    for (const p of participants) {
      const t = String(p.anagraficaType ?? "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [participants]);

  // null = nessun filtro -> tutti visibili
  const [visibleTypes, setVisibleTypes] = useState<string[] | null>(null);

  const isTypeVisible = (t: string) => {
    if (!visibleTypes || visibleTypes.length === 0) return true;
    return visibleTypes.includes(t);
  };

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) =>
      isTypeVisible(String(p.anagraficaType ?? "").trim()),
    );
  }, [participants, visibleTypes]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const toggleVisibleType = (t: string) => {
    setVisibleTypes((prev) => {
      const cur = prev ?? allTypes;
      const set = new Set(cur);

      if (set.has(t)) set.delete(t);
      else set.add(t);

      const next = Array.from(set);

      const allSelected =
        next.length === allTypes.length && allTypes.every((x) => set.has(x));
      return allSelected ? null : next;
    });
  };

  const setOnlyType = (t: string) => setVisibleTypes([t]);
  const clearTypeFilter = () => setVisibleTypes(null);

  const selectAllVisible = () => {
    const keys = filteredParticipants.map((p) => p.key);
    const missing = keys.filter((k) => !selectedSet.has(k));
    missing.forEach((k) => onToggle(k));
  };

  const selectNoneVisible = () => {
    const keys = filteredParticipants.map((p) => p.key);
    const present = keys.filter((k) => selectedSet.has(k));
    present.forEach((k) => onToggle(k));
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        // ✅ SOLO classi esistenti nel tuo tailwind
        "border-stroke bg-white text-dark",
        "dark:bg-dark dark:text-white dark:border-dark-3",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm font-bold">Partecipanti</div>

        <div className="ml-auto flex items-center gap-2">
          <Dropdown isOpen={open} setIsOpen={setOpen}>
            <DropdownTrigger
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold",
                "border-stroke bg-white text-dark hover:bg-gray",
                "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:hover:bg-dark-3",
              )}
            >
              Filtra slug
            </DropdownTrigger>

            <DropdownContent
              align="end"
              className={cn(
                "w-[260px] rounded-2xl border p-2 shadow-2xl",
                "border-stroke bg-white text-dark ring-1 ring-black/10",
                "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:ring-white/10",
              )}
            >
              <div className="px-2 py-1.5 text-[11px] font-bold opacity-80">
                Mostra solo:
              </div>

              <div className="flex flex-wrap gap-2 px-2 pb-2">
                <button
                  type="button"
                  onClick={clearTypeFilter}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                    "border-stroke text-dark hover:bg-gray",
                    !visibleTypes ? "bg-gray border-primary text-primary" : "bg-white",
                    "dark:border-dark-3 dark:text-white dark:hover:bg-dark-3",
                    !visibleTypes ? "dark:bg-dark-3 dark:border-primary" : "dark:bg-dark-4",
                  )}
                >
                  Tutti
                </button>

                {allTypes.map((t) => {
                  const active = isTypeVisible(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleVisibleType(t)}
                      onDoubleClick={() => setOnlyType(t)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                        "border-stroke text-dark hover:bg-gray",
                        active ? "bg-gray border-primary text-primary" : "bg-white",
                        "dark:border-dark-3 dark:text-white dark:hover:bg-dark-3",
                        active ? "dark:bg-dark-3 dark:border-primary" : "dark:bg-dark-4",
                      )}
                      title="Click = toggle, doppio click = solo questo"
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-stroke px-2 py-2 dark:border-dark-3">
                <div className="text-[10px] font-semibold opacity-70">
                  Tip: doppio click su uno slug = “solo quello”.
                </div>
              </div>
            </DropdownContent>
          </Dropdown>

          <button
            type="button"
            onClick={() => {
              if (!visibleTypes) onSelectAll();
              else selectAllVisible();
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              "border-stroke bg-white text-dark hover:bg-gray",
              "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:hover:bg-dark-3",
            )}
          >
            Tutti
          </button>

          <button
            type="button"
            onClick={() => {
              if (!visibleTypes) onSelectNone();
              else selectNoneVisible();
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              "border-stroke bg-white text-dark hover:bg-gray",
              "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:hover:bg-dark-3",
            )}
          >
            Nessuno
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filteredParticipants.map((p) => {
          const checked = selectedSet.has(p.key);

          return (
            <label
              key={p.key}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs select-none transition",
                "border-stroke bg-white text-dark hover:bg-gray",
                "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:hover:bg-dark-3",
                checked ? "border-primary text-primary bg-gray" : "",
                checked ? "dark:border-primary dark:bg-dark-3 dark:text-white" : "",
              )}
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={checked}
                onChange={() => onToggle(p.key)}
              />

              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  "border-stroke bg-gray text-dark",
                  "dark:border-dark-3 dark:bg-dark-3 dark:text-white",
                )}
              >
                {p.anagraficaType}
              </span>

              <span className="whitespace-nowrap font-semibold">
                {p.displayName}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
