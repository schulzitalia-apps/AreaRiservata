import type { PctSet, TimeKey, Txn, UpcomingExpense } from "./types";

/**
 * Random deterministico 0..1 (stabile tra SSR e client).
 */
function noise01(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Date formatting deterministico (NO Intl) -> evita hydration mismatch.
 * Ritorna "dd/mm/yy".
 */
function fmtDateShort(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Base deterministica per i mock (NO Date.now()).
 * Così la generazione è identica SSR/client.
 */
function baseMonthDate(mi: number) {
  // 2024-01-01 + mi mesi (stabile)
  return new Date(2024, 0 + mi, 1);
}

function coerceDate(m: { date?: Date | string }, mi: number): Date {
  const d = m?.date;

  if (d instanceof Date && Number.isFinite(d.getTime())) return d;

  if (typeof d === "string") {
    const parsed = new Date(d);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }

  return baseMonthDate(mi);
}

/**
 * Spezzetta un totale in 1..N chunk "umani".
 * - non obbliga migliaia: può fare anche decine/centinaia
 * - deterministico
 */
function splitAmount(total: number, seed: number): number[] {
  const t = Math.max(0, Math.round(total));
  if (t <= 0) return [];

  // soglie "umane"
  const chunks = t < 250 ? 1 : t < 1200 ? 2 : 3;

  if (chunks === 1) return [t];

  const r1 = 0.45 + noise01(seed + 11) * 0.25; // 0.45..0.70
  const a1 = Math.max(1, Math.round(t * r1));

  if (chunks === 2) return [a1, Math.max(1, t - a1)];

  const r2 = 0.2 + noise01(seed + 29) * 0.2; // 0.20..0.40
  const a2 = Math.max(1, Math.round((t - a1) * r2));
  const a3 = Math.max(1, t - a1 - a2);
  return [a1, a2, a3];
}

type MonthlyRow = {
  date?: Date | string;
  byCategory: Partial<Record<keyof PctSet, number>>;
};

export function buildTransactions(
  monthly: MonthlyRow[],
  opts: {
    suppliers: string[];
    titlesByCategory: Record<keyof PctSet, string[]>;
  },
): Txn[] {
  const cats = Object.keys(opts.titlesByCategory) as Array<keyof PctSet>;
  const out: Txn[] = [];

  monthly.forEach((m, mi) => {
    const monthDate = coerceDate({ date: m.date }, mi);

    cats.forEach((k, ki) => {
      const totalRaw = m.byCategory?.[k];
      const total = Number.isFinite(totalRaw as number) ? Number(totalRaw) : 0;
      if (total <= 0) return;

      const parts = splitAmount(total, 9000 + mi * 73 + ki * 41);

      parts.forEach((amount, c) => {
        const r = noise01(3000 + mi * 73 + ki * 41 + c * 19);

        const titleArr = opts.titlesByCategory[k] || [];
        const supplier =
          opts.suppliers[
            Math.floor(
              noise01(5000 + mi * 31 + ki * 17 + c * 7) * opts.suppliers.length,
            )
            ] ?? "Fornitore";

        const t = titleArr[Math.floor(r * titleArr.length)] ?? "Spesa";

        // giorno 4..27 del mese (deterministico)
        const day = 4 + Math.floor(r * 24);
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);

        out.push({
          id: `${mi}-${String(k)}-${c}-${Math.round(amount)}`, // stabile
          title: t,
          supplier,
          dateLabel: fmtDateShort(date),
          amount: Math.round(amount),
          category: k,
        });
      });
    });
  });

  return out;
}

export function buildUpcoming(
  timeKey: TimeKey,
  upcomingByTime: Record<TimeKey, UpcomingExpense[]>,
): UpcomingExpense[] {
  const rows = Array.isArray(upcomingByTime?.[timeKey]) ? upcomingByTime[timeKey] : [];
  return rows.map((r) => ({ ...r, amount: Math.round(Number(r.amount) || 0) }));
}
