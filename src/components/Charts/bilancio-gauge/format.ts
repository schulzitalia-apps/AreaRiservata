export function euro(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

export function signedEuro(n: number) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+ " : v < 0 ? "- " : "";
  return sign + euro(Math.abs(v));
}
