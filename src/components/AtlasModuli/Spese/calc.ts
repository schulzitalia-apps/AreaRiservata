import type { PctSet, TimeKey } from "./types";
import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";

export function monthsCount(timeKey: TimeKey) {
  return timeKey === "mese" ? 1 : timeKey === "trimestre" ? 3 : timeKey === "semestre" ? 6 : 12;
}

export function buildDonut(
  total: number,
  pct: PctSet,
  sliceDefs: ReadonlyArray<{ key: keyof PctSet; label: string }>,
): DonutDatum[] {
  const T = Math.max(0, Math.round(total));
  const parts = sliceDefs.map((d) => ({ label: d.label, pct: pct[d.key] }));
  const sumPct = parts.reduce((a, p) => a + p.pct, 0) || 1;

  const normalized = parts.map((p) => ({ ...p, pct: p.pct / sumPct }));

  const raw = normalized.map((p) => T * p.pct);
  const base = raw.map((v) => Math.floor(v));
  let remainder = T - base.reduce((a, b) => a + b, 0);

  const order = raw.map((v, i) => ({ i, frac: v - base[i] })).sort((a, b) => b.frac - a.frac);

  const values = [...base];
  for (let k = 0; k < remainder; k++) {
    const idx = order[k % order.length]?.i ?? 0;
    values[idx] += 1;
  }

  return normalized.map((p, i) => ({ label: p.label, value: values[i] ?? 0 }));
}

export function pickTopCategory(data: DonutDatum[]) {
  return [...data].sort((a, b) => b.value - a.value)[0] ?? data[0];
}

/* -----------------------------
 * Monthly breakdown (puro)
 * ----------------------------- */
function noise01(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function allocateRounded(total: number, weights: number[]) {
  const T = Math.max(0, Math.round(total));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;

  const raw = weights.map((w) => (T * w) / sumW);
  const base = raw.map((v) => Math.floor(v));
  let remainder = T - base.reduce((a, b) => a + b, 0);

  const order = raw.map((v, i) => ({ i, frac: v - base[i] })).sort((a, b) => b.frac - a.frac);

  const out = [...base];
  for (let k = 0; k < remainder; k++) {
    const idx = order[k % order.length]?.i ?? 0;
    out[idx] += 1;
  }
  return out;
}

function monthLabelIt(d: Date) {
  const fmt = new Intl.DateTimeFormat("it-IT", { month: "short" });
  const s = fmt.format(d).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildMonthDates(n: number) {
  const now = new Date();
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return out;
}

export function buildMonthly(timeKey: TimeKey, periodTotal: number, basePct: PctSet) {
  const n = monthsCount(timeKey);
  const dates = buildMonthDates(n);

  const weights = dates.map((_, i) => {
    const t = i / Math.max(1, n - 1);
    const seasonal =
      timeKey === "anno"
        ? 0.38 * Math.sin(t * Math.PI * 2 - Math.PI / 2)
        : 0.16 * Math.sin(t * Math.PI * 2);
    const spiky = (noise01(100 + i * 17 + n * 31) - 0.5) * 0.32;
    return Math.max(0.35, 1 + seasonal + spiky);
  });

  const totals = allocateRounded(periodTotal, weights);

  const amp =
    timeKey === "mese" ? 0.10 : timeKey === "trimestre" ? 0.24 : timeKey === "semestre" ? 0.18 : 0.14;

  const cats: Array<keyof PctSet> = ["magazzino3d", "stipendi", "f24", "energia", "software", "consulenze"];

  return dates.map((date, i) => {
    const monthTotal = totals[i] ?? 0;

    const monthNum = date.getMonth();
    const winterBoost = monthNum === 11 || monthNum === 0 || monthNum === 1 ? 0.25 : 0;
    const summerBoost = monthNum === 6 || monthNum === 7 ? 0.12 : 0;

    const rawShares: Record<keyof PctSet, number> = { ...basePct };

    cats.forEach((k, idx) => {
      const r = noise01(900 + i * 101 + idx * 37 + n * 19);
      const mult = 1 + (r - 0.5) * 2 * amp;

      let m = mult;
      if (k === "energia") m = mult * (1 + winterBoost + summerBoost);
      if (k === "software" && (monthNum === 0 || monthNum === 6)) m = mult * 1.18;

      rawShares[k] = Math.max(0.001, basePct[k] * m);
    });

    const sumS = cats.reduce((a, k) => a + rawShares[k], 0) || 1;
    const shares = cats.map((k) => rawShares[k] / sumS);

    const values = allocateRounded(monthTotal, shares);

    const byCategory: Record<keyof PctSet, number> = {
      magazzino3d: values[0] ?? 0,
      stipendi: values[1] ?? 0,
      f24: values[2] ?? 0,
      energia: values[3] ?? 0,
      software: values[4] ?? 0,
      consulenze: values[5] ?? 0,
    };

    return {
      date,
      label: monthLabelIt(date),
      total: monthTotal,
      byCategory,
    };
  });
}
