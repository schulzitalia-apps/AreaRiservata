import type { BilancioTimeKey } from "./types";

export type MonthlySeriesPack = {
  categories: string[]; // ["Mar 25", "Apr 25", ...]
  series: { name: string; data: number[] }[];
  colors: string[];
};

function monthNamesItShort() {
  return ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Ritorna N labels mese, andando indietro dal mese corrente incluso.
 * Formato: "Feb 25"
 */
export function buildMonthLabels(count: number, now = new Date()) {
  const m = monthNamesItShort();
  const out: string[] = [];

  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const yy = String(d.getFullYear()).slice(2);
    out.push(`${m[d.getMonth()]} ${yy}`);
  }

  return out;
}

/**
 * Quanti mesi mostrare per timeKey.
 * NB: anche "mese" mostra mesi (default 12).
 */
export function monthsCountForTimeKey(timeKey: BilancioTimeKey, opts?: { tuttoMonths?: number }) {
  switch (timeKey) {
    case "trimestre":
      return 3;
    case "semestre":
      return 6;
    case "anno":
      return 12;
    case "mese":
      return 12; // ✅ richiesto: anche se filtro 1 mese, grafico per mesi (12 mesi)
    case "tutto":
    default:
      return Math.max(12, opts?.tuttoMonths ?? 36); // mock: 36 mesi “tutto”
  }
}

/**
 * Mock “cinematic”: genera due serie (Ricavi/Spese) coerenti con totals.
 * - Mantiene la somma ~ totale (senza essere identica al centesimo)
 * - Crea andamento realistico (trend + rumore)
 */
export function buildMonthlyMockFromTotals(args: {
  timeKey: BilancioTimeKey;
  totals: { ricavi: number; spese: number };
  colors?: string[];
  tuttoMonths?: number;
  now?: Date;
}): MonthlySeriesPack {
  const { timeKey, totals } = args;

  const months = monthsCountForTimeKey(timeKey, { tuttoMonths: args.tuttoMonths });
  const categories = buildMonthLabels(months, args.now);

  const ricaviTot = Math.max(0, Math.round(Number(totals.ricavi) || 0));
  const speseTot = Math.max(0, Math.round(Number(totals.spese) || 0));

  // Distribuzione: trend + wave + noise
  function buildSeries(total: number, bias: number) {
    if (months <= 0) return [];

    const base = total / months;
    const arr = new Array(months).fill(0).map((_, i) => {
      const t = i / Math.max(1, months - 1);

      // trend (leggero)
      const trend = 1 + (t - 0.5) * 0.16 * bias;

      // wave (stagionalità)
      const wave = 1 + Math.sin((i / Math.max(1, months)) * Math.PI * 2) * 0.08;

      // noise deterministico (no Math.random per evitare flicker)
      const noise = 1 + (Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 * 0.06 - 0.03;

      const v = base * trend * wave * noise;
      return Math.max(0, v);
    });

    // normalizza per tornare vicino al totale
    const sum = arr.reduce((a, v) => a + v, 0) || 1;
    const k = total / sum;
    return arr.map((v) => Math.round(v * k));
  }

  const ricavi = buildSeries(ricaviTot, +1);
  const spese = buildSeries(speseTot, -1);

  return {
    categories,
    series: [
      { name: "Ricavi", data: ricavi },
      { name: "Spese", data: spese },
    ],
    colors: args.colors ?? ["#22C55E", "#EF4444"],
  };
}
