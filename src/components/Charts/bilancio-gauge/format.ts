export function euro(n: number) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("it-IT") + " €";
}

export function signedEuro(n: number) {
  const v = Math.round(Number(n) || 0);
  const sign = v > 0 ? "+ " : v < 0 ? "- " : "";
  return sign + euro(Math.abs(v));
}
