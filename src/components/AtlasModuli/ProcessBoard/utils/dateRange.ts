function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoZ(d: Date) {
  // ISO UTC "Z" (coerente con monthBounds del calendario)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours(),
  )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`;
}

/**
 * Range simmetrico: oggi -windowDays ... oggi +windowDays
 * (se vuoi solo passato: basta mettere end = now)
 */
export function buildWindowRange(windowDays: number) {
  const now = new Date();

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - windowDays);

  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  end.setUTCDate(end.getUTCDate() + windowDays);

  return { timeFrom: toIsoZ(start), timeTo: toIsoZ(end) };
}

export function cmpIso(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
