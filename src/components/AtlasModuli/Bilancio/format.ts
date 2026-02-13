export function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function signedEuro(n: number) {
  const v = Math.round(Number(n) || 0);
  const sign = v > 0 ? "+ " : v < 0 ? "- " : "";
  return sign + euro(Math.abs(v));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function pct(n01: number, digits = 0) {
  const v = Number.isFinite(n01) ? n01 : 0;
  return `${(v * 100).toFixed(digits)}%`;
}
