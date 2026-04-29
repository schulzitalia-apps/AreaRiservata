"use client";

import { useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import type { UpcomingRow } from "./types";
import { euro } from "../format";

export function UpcomingTable({ rows }: { rows: UpcomingRow[] }) {
  const [openId, setOpenId] = useState<string | null>(
    rows[0] ? `${rows[0].title}-0` : null,
  );

  return (
    <div className="space-y-3 p-3">
      {rows.map((r, i) => {
        const rowId = `${r.title}-${i}`;
        const expanded = openId === rowId;

        return (
          <button
            key={rowId}
            type="button"
            onClick={() => setOpenId((current) => (current === rowId ? null : rowId))}
            className={cn(
              "w-full rounded-2xl border border-stroke bg-white/70 p-4 text-left shadow-sm transition",
              "hover:bg-white dark:border-dark-3 dark:bg-gray-dark/40 dark:hover:bg-dark-2/70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-base font-extrabold text-dark dark:text-white">
                  {r.title}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-500 dark:text-dark-6">
                  {r.dateLabel}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 pl-2">
                <div className="text-right">
                  <div className="whitespace-nowrap text-lg font-black text-dark dark:text-white">
                    {euro(r.amount)}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-lg font-black text-gray-500 transition-transform dark:text-dark-6",
                    expanded ? "rotate-180" : "",
                  )}
                >
                  ↓
                </div>
              </div>
            </div>

            {expanded ? (
              <div className="mt-4 grid gap-3 border-t border-stroke/70 pt-4 dark:border-dark-3/70">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-500 dark:text-dark-6">
                    Cliente
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold text-dark dark:text-white/85">
                    {r.customer || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gray-500 dark:text-dark-6">
                    Valore completo
                  </div>
                  <div className="mt-1 text-sm font-semibold text-dark dark:text-white/85">
                    {euro(r.amount)}
                  </div>
                </div>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
