/**
 * Formatter deterministico (NO Intl) -> evita mismatch SSR/client.
 * Output: "7.800 €" (punti migliaia, nessun decimale)
 */
export function euro(n: number) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  const s = String(abs);
  // inserisce '.' ogni 3 cifre da destra
  const withDots = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${withDots} €`;
}

export function clamp(n: number, min = 0, max = 100) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, v));
}

export function formatPct(n: number, digits = 0) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}
