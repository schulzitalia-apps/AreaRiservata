import type { DestinazioneItem } from "./bilancio.config";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeMoney(n: number) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/** Normalizza le pct se non sommano a 1 */
function normalize(items: DestinazioneItem[]) {
  const sum = items.reduce((a, i) => a + clamp01(i.pct), 0);
  const denom = sum > 0 ? sum : 1;
  return items.map((i) => ({ ...i, pct: clamp01(i.pct) / denom }));
}

/**
 * Donut data compatibile con ApexDonutChart: { label, value }
 * Base = utile annuale positivo, altrimenti 0.
 */
export function computeDestinazioneFromUtile(args: {
  utileAnnuale: number; // può essere negativo
  config: DestinazioneItem[];
}) {
  const base = safeMoney(Math.max(0, args.utileAnnuale));
  const normalized = normalize(args.config);

  const rows = normalized.map((i) => ({
    key: i.key,
    label: i.label,
    value: Math.round(base * i.pct),
    color: i.color,
    pct: i.pct,
  }));

  // aggiusta eventuale rounding diff sul primo elemento
  const sum = rows.reduce((a, r) => a + r.value, 0);
  const diff = base - sum;
  if (rows.length && diff !== 0) rows[0].value = Math.max(0, rows[0].value + diff);

  return {
    total: base,
    rows: rows.map((r) => ({ label: r.label, value: r.value })),
    colors: rows.map((r) => r.color),
  };
}

/**
 * Tassa utile = rate (0..1) dell’utile annuale positivo, altrimenti 0.
 */
export function computeTaxFromUtile(args: { utileAnnuale: number; rate: number }) {
  const utilePos = safeMoney(Math.max(0, args.utileAnnuale));
  const tax = Math.round(utilePos * clamp01(args.rate));
  return { utilePos, tax };
}
