const IT_MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"] as const;

type Parsed = { monthIndex: number; year: number } | null;

function norm(s: string) {
  return String(s || "").trim();
}

function parseYearLike(y: string): number | null {
  const s = norm(y);
  if (/^\d{4}$/.test(s)) return Number(s);
  if (/^\d{2}$/.test(s)) return Number(`20${s}`);
  return null;
}

function monthIndexFromName(m: string): number {
  const mm = norm(m).slice(0, 3).toLowerCase();
  return IT_MONTHS.findIndex((x) => x.toLowerCase() === mm);
}

/**
 * Supporta:
 * - "Set 25" / "Set 2025"
 * - "Set" (senza anno) -> inferenza rolling vs currentYear
 * - "2026-01" / "2026-01-15"
 * - "01/2026" / "1/26"
 */
export function parseMonthLabelSmart(label: string, now = new Date()): Parsed {
  const s = norm(label);
  if (!s) return null;

  // ISO: 2026-01 o 2026-01-15
  const iso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (iso) {
    const year = Number(iso[1]);
    const monthIndex = Number(iso[2]) - 1;
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
    return { year, monthIndex };
  }

  // Slash: 01/2026 o 1/26
  const sl = s.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (sl) {
    const monthIndex = Number(sl[1]) - 1;
    const year = parseYearLike(sl[2]);
    if (!year || monthIndex < 0 || monthIndex > 11) return null;
    return { year, monthIndex };
  }

  // Nome mese: "Set 25" oppure "Set"
  const parts = s.split(/\s+/);
  const mi = monthIndexFromName(parts[0]);
  if (mi < 0) return null;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // con anno esplicito
  if (parts.length >= 2) {
    const year = parseYearLike(parts[1]);
    if (!year) return null;
    return { year, monthIndex: mi };
  }

  /**
   * Senza anno:
   * - se il mese è <= mese corrente -> assumo anno corrente
   * - se il mese è > mese corrente -> assumo anno precedente (rolling 12)
   */
  const year = mi <= currentMonth ? currentYear : currentYear - 1;
  return { year, monthIndex: mi };
}

function extractMonthlyArray(monthly: any[]): { label: string; value: number }[] {
  if (!Array.isArray(monthly)) return [];
  return monthly
    .map((it: any) => {
      const label =
        it?.x ?? it?.label ?? it?.monthLabel ?? it?.month ?? it?.name ?? it?.period ?? "";
      const v = it?.y ?? it?.value ?? it?.amount ?? it?.total ?? it?.lordo ?? 0;
      return { label: String(label), value: Math.round(Number(v) || 0) };
    })
    .filter((r) => r.label && Number.isFinite(r.value));
}

/**
 * ✅ Totali anno fiscale (YTD): Gennaio -> mese corrente (incluso) dell’anno corrente.
 * - Funziona anche se monthly è rolling 12 o se le label non hanno anno.
 */
export function computeFiscalYearTotalsFromMonthly(args: {
  ricaviMonthly: any[];
  speseMonthly: any[];
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const r = extractMonthlyArray(args.ricaviMonthly);
  const s = extractMonthlyArray(args.speseMonthly);

  let ricavi = 0;
  let spese = 0;

  for (const item of r) {
    const p = parseMonthLabelSmart(item.label, now);
    if (!p) continue;
    if (p.year !== currentYear) continue;
    if (p.monthIndex >= 0 && p.monthIndex <= currentMonth) ricavi += item.value;
  }

  for (const item of s) {
    const p = parseMonthLabelSmart(item.label, now);
    if (!p) continue;
    if (p.year !== currentYear) continue;
    if (p.monthIndex >= 0 && p.monthIndex <= currentMonth) spese += item.value;
  }

  return { ricavi, spese };
}

/**
 * ✅ Costruisce le categorie mese-per-mese dell’anno fiscale:
 * - ritorna sempre: ["Gen 26","Feb 26", ... fino al mese corrente]
 * - e valori agganciati dai monthly (qualunque formato label)
 */
export function buildFiscalYearSeriesFromMonthly(args: {
  ricaviMonthly: any[];
  speseMonthly: any[];
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const r = extractMonthlyArray(args.ricaviMonthly);
  const s = extractMonthlyArray(args.speseMonthly);

  const mapR = new Map<number, number>(); // monthIndex -> value
  const mapS = new Map<number, number>();

  for (const item of r) {
    const p = parseMonthLabelSmart(item.label, now);
    if (!p) continue;
    if (p.year !== currentYear) continue;
    if (p.monthIndex >= 0 && p.monthIndex <= currentMonth) mapR.set(p.monthIndex, item.value);
  }

  for (const item of s) {
    const p = parseMonthLabelSmart(item.label, now);
    if (!p) continue;
    if (p.year !== currentYear) continue;
    if (p.monthIndex >= 0 && p.monthIndex <= currentMonth) mapS.set(p.monthIndex, item.value);
  }

  const yy = String(currentYear).slice(2);
  const categories: string[] = [];
  const ricavi: number[] = [];
  const spese: number[] = [];

  for (let m = 0; m <= currentMonth; m++) {
    categories.push(`${IT_MONTHS[m]} ${yy}`);
    ricavi.push(mapR.get(m) ?? 0);
    spese.push(mapS.get(m) ?? 0);
  }

  return { categories, ricavi, spese };
}
