import type { Txn } from "../types";
import { euro } from "../format";

export function TopTenList({ rows }: { rows: Txn[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r, idx) => (
        <div
          key={r.id}
          className="rounded-2xl border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="min-w-0">
            <div className="text-sm font-black text-dark dark:text-white">
              {idx + 1}) {r.title} <span className="text-gray-600 dark:text-dark-6">{euro(r.amount)}</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-dark-6">
              Fornitore: <span className="text-gray-700 dark:text-white/80">{r.supplier}</span> · Data:{" "}
              <span className="text-gray-700 dark:text-white/80">{r.dateLabel}</span>
            </div>
          </div>
        </div>
      ))}

      {!rows.length ? (
        <div className="rounded-2xl border border-dashed border-stroke p-4 text-center text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-dark-6">
          Nessuna voce per questo filtro.
        </div>
      ) : null}
    </div>
  );
}
