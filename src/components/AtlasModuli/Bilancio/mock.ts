import type { BilancioMovimento, BilancioTimeKey, BilancioTotals } from "./types";

export const BILANCIO_TIME_OPTIONS = [
  ["anno_fiscale", "Anno fiscale"],
  ["anno", "Anno"],
  ["semestre", "6 mesi"],
  ["trimestre", "3 mesi"],
  ["mese", "1 mese"],
  ["tutto", "Tutto"],
] as const satisfies ReadonlyArray<readonly [BilancioTimeKey, string]>;

export const PERIOD_LABEL: Record<BilancioTimeKey, string> = {
  anno_fiscale: "Anno fiscale (da Gennaio)",
  tutto: "Da sempre",
  anno: "12 mesi",
  semestre: "6 mesi",
  trimestre: "3 mesi",
  mese: "1 mese",
};

export const BILANCIO_TOTALS_MOCK: Record<BilancioTimeKey, BilancioTotals> = {
  // ✅ anno fiscale: esempio YTD (da Gennaio a oggi) — mock
  anno_fiscale: { ricavi: 142000, spese: 129857 },

  tutto: { ricavi: 1250000, spese: 2000000 },
  anno: { ricavi: 575000, spese: 510000 },
  semestre: { ricavi: 292000, spese: 268000 },
  trimestre: { ricavi: 148000, spese: 131000 },
  mese: { ricavi: 52000, spese: 90000 },
};

/**
 * Mock: Ultimi movimenti (entrate + uscite) — legato al timeKey.
 */
export const BILANCIO_MOVIMENTI_MOCK: Record<BilancioTimeKey, BilancioMovimento[]> = {
  anno_fiscale: [
    { id: "fy1", title: "Fattura incassata #1930", dateLabel: "Gen", amount: +22850 },
    { id: "fy2", title: "F24", dateLabel: "Gen", amount: -3920 },
    { id: "fy3", title: "Fornitore materiali", dateLabel: "Feb", amount: -5150 },
    { id: "fy4", title: "Incasso POS", dateLabel: "Mar", amount: +1790 },
    { id: "fy5", title: "Energia elettrica", dateLabel: "Apr", amount: -610 },
  ],
  mese: [
    { id: "m1", title: "Fattura incassata #1842", dateLabel: "10 Feb", amount: +12850 },
    { id: "m2", title: "F24", dateLabel: "08 Feb", amount: -3920 },
    { id: "m3", title: "Pagamento fornitore", dateLabel: "06 Feb", amount: -2650 },
    { id: "m4", title: "Incasso POS", dateLabel: "05 Feb", amount: +1790 },
    { id: "m5", title: "Energia elettrica", dateLabel: "03 Feb", amount: -610 },
  ],
  trimestre: [
    { id: "t1", title: "Fattura incassata #1721", dateLabel: "Gen", amount: +22400 },
    { id: "t2", title: "Stipendi", dateLabel: "Gen", amount: -12800 },
    { id: "t3", title: "Affitto", dateLabel: "Feb", amount: -2400 },
    { id: "t4", title: "Incasso bonifico", dateLabel: "Mar", amount: +9700 },
    { id: "t5", title: "Fornitore materiali", dateLabel: "Mar", amount: -5150 },
  ],
  semestre: [
    { id: "s1", title: "Incasso contratto", dateLabel: "Ott", amount: +42000 },
    { id: "s2", title: "Stipendi", dateLabel: "Nov", amount: -18500 },
    { id: "s3", title: "IVA", dateLabel: "Dic", amount: -6200 },
    { id: "s4", title: "Incasso POS", dateLabel: "Gen", amount: +9400 },
    { id: "s5", title: "Assicurazione", dateLabel: "Feb", amount: -980 },
  ],
  anno: [
    { id: "a1", title: "Incasso progetto A", dateLabel: "Apr", amount: +68000 },
    { id: "a2", title: "Stipendi", dateLabel: "Mag", amount: -24000 },
    { id: "a3", title: "F24", dateLabel: "Giu", amount: -7800 },
    { id: "a4", title: "Incasso ricorrente", dateLabel: "Set", amount: +19500 },
    { id: "a5", title: "Fornitori", dateLabel: "Nov", amount: -12200 },
  ],
  tutto: [
    { id: "x1", title: "Incasso storico", dateLabel: "2023", amount: +125000 },
    { id: "x2", title: "Investimento attrezzatura", dateLabel: "2023", amount: -54000 },
    { id: "x3", title: "Incasso storico", dateLabel: "2024", amount: +98000 },
    { id: "x4", title: "Tasse", dateLabel: "2024", amount: -31000 },
    { id: "x5", title: "Incasso storico", dateLabel: "2025", amount: +74000 },
  ],
};

export const BILANCIO_TILES_MOCK: Record<
  BilancioTimeKey,
  { k1: number; k2: number; k3: number; k4: number }
> = {
  anno_fiscale: { k1: 12000, k2: 6000, k3: 4000, k4: 8000 },
  mese: { k1: 1500, k2: 600, k3: 450, k4: 1200 },
  trimestre: { k1: 6000, k2: 2400, k3: 1800, k4: 4000 },
  semestre: { k1: 12000, k2: 5200, k3: 3600, k4: 7800 },
  anno: { k1: 18000, k2: 8600, k3: 5400, k4: 11000 },
  tutto: { k1: 24000, k2: 12000, k3: 8000, k4: 14000 },
};
