import type { StatusRow } from "./types";

const STATUS_ORDER = [
  "da_definire",
  "Taglio",
  "Vetraggio",
  "Ferramenta",
  "Accessori",
  "Imballaggio",
  "Pronto a Magazzino",
  "Spedizione",
  "Consegna Prevista",
] as const;

const STATUS_LABELS: Record<string, string> = {
  da_definire: "Da definire",
};

export function StatusList({ rows }: { rows: StatusRow[] }) {
  const counts = new Map(rows.map((row) => [row.stato, row.count]));

  const normalizedRows: StatusRow[] = STATUS_ORDER.map((stato) => ({
    stato,
    count: counts.get(stato) ?? 0,
  })).filter((row) => row.count > 0 || row.stato === "Accessori");

  const displayRows = normalizedRows.length ? normalizedRows : rows;

  return (
    <div className="space-y-2">
      {displayRows.map((r) => (
        <div
          key={r.stato}
          className="rounded-2xl border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-gray-dark"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-dark dark:text-white">
                {STATUS_LABELS[r.stato] ?? r.stato}
              </div>
              <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-dark-6">
                Numero commesse in questo stato
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-stroke bg-gray-50 px-3 py-2 text-sm font-black text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
              {r.count}
            </div>
          </div>
        </div>
      ))}

      {!displayRows.length ? (
        <div className="rounded-2xl border border-dashed border-stroke p-4 text-center text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-dark-6">
          Nessun dato stati disponibile.
        </div>
      ) : null}
    </div>
  );
}
