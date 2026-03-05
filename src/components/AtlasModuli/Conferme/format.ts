export function euro(n: number) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const s = String(abs);
  const withDots = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${withDots} €`;
}

export function formatPct(n: number, digits = 0) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

// ✅ aggiungi questo
export function clamp(n: number, min = 0, max = 100) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, v));
}