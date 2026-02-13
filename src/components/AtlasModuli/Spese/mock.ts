import type { CategoryKey, PctSet, TimeKey, UpcomingExpense } from "./types";

export const TOTALS: Record<
  TimeKey,
  {
    current: { lordo: number; ivaRecuperata: number };
    prev: { lordo: number; ivaRecuperata: number };
  }
> = {
  mese: {
    current: { lordo: 41500, ivaRecuperata: 6200 },
    prev: { lordo: 47900, ivaRecuperata: 7400 },
  },
  trimestre: {
    current: { lordo: 98000, ivaRecuperata: 16000 },
    prev: { lordo: 85000, ivaRecuperata: 12000 },
  },
  semestre: {
    current: { lordo: 112000, ivaRecuperata: 18500 },
    prev: { lordo: 128000, ivaRecuperata: 22000 },
  },
  anno: {
    current: { lordo: 176000, ivaRecuperata: 34000 },
    prev: { lordo: 160000, ivaRecuperata: 28000 },
  },
  anno_fiscale: {
    current: { lordo: 1, ivaRecuperata: 3 },
    prev: { lordo: 1, ivaRecuperata: 2 },
  },
};

export const PCT_CURRENT_BY_TIME: Record<TimeKey, PctSet> = {
  mese: { magazzino3d: 0.22, stipendi: 0.33, f24: 0.16, energia: 0.14, software: 0.09, consulenze: 0.06 },
  trimestre: { magazzino3d: 0.38, stipendi: 0.21, f24: 0.12, energia: 0.07, software: 0.05, consulenze: 0.17 },
  semestre: { magazzino3d: 0.25, stipendi: 0.3, f24: 0.12, energia: 0.11, software: 0.12, consulenze: 0.1 },
  anno: { magazzino3d: 0.24, stipendi: 0.32, f24: 0.11, energia: 0.1, software: 0.1, consulenze: 0.13 },
  anno_fiscale: { magazzino3d: 0.24, stipendi: 0.32, f24: 0.11, energia: 0.1, software: 0.1, consulenze: 0.13 },
};

export const PCT_PREV_BY_TIME: Record<TimeKey, PctSet> = {
  mese: { magazzino3d: 0.29, stipendi: 0.29, f24: 0.15, energia: 0.1, software: 0.07, consulenze: 0.1 },
  trimestre: { magazzino3d: 0.3, stipendi: 0.25, f24: 0.14, energia: 0.1, software: 0.06, consulenze: 0.15 },
  semestre: { magazzino3d: 0.36, stipendi: 0.25, f24: 0.11, energia: 0.1, software: 0.06, consulenze: 0.12 },
  anno: { magazzino3d: 0.28, stipendi: 0.28, f24: 0.13, energia: 0.11, software: 0.07, consulenze: 0.13 },
  anno_fiscale: { magazzino3d: 0.28, stipendi: 0.28, f24: 0.13, energia: 0.11, software: 0.07, consulenze: 0.13 }
};

export const DONUT_COLORS = ["#5750F1", "#0ABEF9", "#5475E5", "#8099EC", "#ADBCF2", "#7C5CFF"];

export const CATEGORY_META: Record<CategoryKey, { label: string; color: string }> = {
  all: { label: "Tutte", color: "#0ABEF9" },
  f24: { label: "F24", color: "#ADBCF2" },
  consulenze: { label: "Commercialista", color: "#7C5CFF" },
  stipendi: { label: "Stipendi", color: "#0ABEF9" },
  magazzino3d: { label: "Magazzino", color: "#5750F1" },
  software: { label: "Abbonamenti", color: "#22C55E" },
  energia: { label: "Energia", color: "#FB923C" },
};

export const CATEGORY_TABS: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "Tutte" },
  { key: "f24", label: "F24" },
  { key: "consulenze", label: "commercialista" },
  { key: "stipendi", label: "Stipendi" },
  { key: "magazzino3d", label: "Magazzino" },
  { key: "software", label: "Abbonamenti" },
];

export const TIME_OPTIONS = [
  ["mese", "1 mese"],
  ["trimestre", "3 mesi"],
  ["semestre", "6 mesi"],
  ["anno", "12 mesi"],
  ["anno_fiscale", "Anno fiscale"],
] as const satisfies ReadonlyArray<readonly [TimeKey, string]>;

export const PERIOD_LABEL: Record<TimeKey, string> = {
  mese: "1 mese",
  trimestre: "3 mesi",
  semestre: "6 mesi",
  anno: "12 mesi",
  anno_fiscale: "a partire da gennaio"
};

export const SLICE_DEFS = [
  { key: "magazzino3d", label: "Magazzino / Stampa 3D" },
  { key: "stipendi", label: "Stipendi" },
  { key: "f24", label: "F24" },
  { key: "energia", label: "Energia / Utenze" },
  { key: "software", label: "Software / SaaS" },
  { key: "consulenze", label: "Consulenze / Varie" },
] as const satisfies ReadonlyArray<{ key: keyof PctSet; label: string }>;

export const SUPPLIERS = ["Amazon", "Bambulab", "Enel", "Aruba", "DHL", "RS Components", "Studio Rossi", "Ebay", "Aliexpress"];

export const TITLES: Record<keyof PctSet, string[]> = {
  magazzino3d: ["Filamenti PLA/PETG", "Resine (bulk)", "Piastre PEI", "Ugelli + hotend", "Materiali tecnici (CF)"],
  stipendi: ["Stipendi (tranche)", "Stipendi (saldo)", "Bonus straordinario"],
  f24: ["F24 - IVA e contributi", "F24 - ritenute e contributi"],
  energia: ["Energia elettrica laboratorio", "Contributo potenza + utenze"],
  software: ["Canoni CAD/CAM", "Hosting + servizi cloud", "Licenze SaaS / rinnovo"],
  consulenze: ["Commercialista (mensile)", "Consulenza marketing", "Consulenza legale"],
};

export const UPCOMING_BY_TIME: Record<TimeKey, UpcomingExpense[]> = {
  mese: [
    { title: "F24 - ritenute e contributi", dateLabel: "16 del mese", amount: 3900 },
    { title: "Stipendi (saldo)", dateLabel: "27 del mese", amount: 12100 },
    { title: "Energia elettrica laboratorio", dateLabel: "Fine mese", amount: 1480 },
    { title: "Filamenti PLA/PETG (stock)", dateLabel: "Tra 6 giorni", amount: 980 },
    { title: "Spedizioni + imballi", dateLabel: "Ordine programmato", amount: 610 },
    { title: "Sostituzione ugelli + manutenzione", dateLabel: "Tra 12 giorni", amount: 430 },
  ],
  trimestre: [
    { title: "F24 - IVA e contributi", dateLabel: "16 del mese", amount: 6900 },
    { title: "Stipendi (tranche)", dateLabel: "27 del mese", amount: 9800 },
    { title: "Resine / filamenti stampa 3D", dateLabel: "Prossima settimana", amount: 2650 },
    { title: "Consulenza marketing (campagna)", dateLabel: "Tra 10 giorni", amount: 1900 },
    { title: "Canoni CAD/CAM", dateLabel: "Rinnovo", amount: 1200 },
    { title: "Ricambi / hotend / ventole", dateLabel: "Tra 14 giorni", amount: 740 },
  ],
  semestre: [
    { title: "F24 - IVA e contributi", dateLabel: "16 del mese", amount: 7200 },
    { title: "Stipendi (tranche)", dateLabel: "27 del mese", amount: 10400 },
    { title: "Assicurazione macchinari", dateLabel: "Tra 3 settimane", amount: 2200 },
    { title: "Upgrade software + licenze", dateLabel: "Tra 2 settimane", amount: 3100 },
    { title: "Energia elettrica laboratorio", dateLabel: "Fine mese", amount: 1620 },
    { title: "Materiali speciali (nylon/CF)", dateLabel: "Ordine pianificato", amount: 1750 },
  ],
  anno: [
    { title: "F24 - IVA e contributi", dateLabel: "16 del mese", amount: 7800 },
    { title: "Stipendi (tranche)", dateLabel: "27 del mese", amount: 11200 },
    { title: "Consulenza fiscale + bilancio", dateLabel: "Tra 30 giorni", amount: 4200 },
    { title: "Manutenzione straordinaria stampanti", dateLabel: "Tra 3 settimane", amount: 3600 },
    { title: "Rinnovi SaaS / hosting", dateLabel: "Rinnovo annuale", amount: 2800 },
    { title: "Energia elettrica laboratorio", dateLabel: "Fine mese", amount: 1700 },
  ],
  anno_fiscale: [
    { title: "F24 - IVA e contributi", dateLabel: "16 del mese", amount: 7800 },
    { title: "Stipendi (tranche)", dateLabel: "27 del mese", amount: 11200 },
    { title: "Consulenza fiscale + bilancio", dateLabel: "Tra 30 giorni", amount: 4200 },
    { title: "Manutenzione straordinaria stampanti", dateLabel: "Tra 3 settimane", amount: 3600 },
    { title: "Rinnovi SaaS / hosting", dateLabel: "Rinnovo annuale", amount: 2800 },
    { title: "Energia elettrica laboratorio", dateLabel: "Fine mese", amount: 1700 },
  ],
};
