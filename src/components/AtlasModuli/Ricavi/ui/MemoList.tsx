import type { Memo } from "../types";
import { euro } from "../format";

export function MemoList({ rows }: { rows: Memo[] }) {
  return (
    <div className="space-y-2">
      {rows.map((m) => (
        <div
          key={m.id}
          className="rounded-2xl border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-dark dark:text-white">{m.title}</div>
            <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-dark-6">
              {m.date} · <span className="text-gray-700 dark:text-white/80">{euro(m.amount)}</span>
            </div>
          </div>
        </div>
      ))}

      {!rows.length ? (
        <div className="rounded-2xl border border-dashed border-stroke p-4 text-center text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-dark-6">
          Nessuna MemoSpesa. Premi “+ Aggiungi”.
        </div>
      ) : null}
    </div>
  );
}
