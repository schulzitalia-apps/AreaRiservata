// src/components/AtlasModuli/Ricavi/mock.ts
import type { CategoryKey, PctSet, TimeKey, UpcomingExpense } from "./types";

export const TOTALS: Record<
  TimeKey,
  {
    current: { lordo: number; ivaRecuperata: number };
    prev: { lordo: number; ivaRecuperata: number };
  }
> = {
  mese: {
    current: { lordo: 52000, ivaRecuperata: 9400 },
    prev: { lordo: 47000, ivaRecuperata: 8600 },
  },
  trimestre: {
    current: { lordo: 148000, ivaRecuperata: 26800 },
    prev: { lordo: 131000, ivaRecuperata: 23800 },
  },
  semestre: {
    current: { lordo: 292000, ivaRecuperata: 53000 },
    prev: { lordo: 268000, ivaRecuperata: 48700 },
  },
  anno: {
    current: { lordo: 575000, ivaRecuperata: 104000 },
    prev: { lordo: 523000, ivaRecuperata: 95000 },
  },
  anno_fiscale: {
    current: { lordo: 5, ivaRecuperata: 2 },
    prev: { lordo: 5, ivaRecuperata: 2 },
  },
};

export const PCT_CURRENT_BY_TIME: Record<TimeKey, PctSet> = {
  mese: { stampa3d: 0.34, servizi: 0.26, bandi: 0.12, vendita: 0.18, altri: 0.10 },
  trimestre: { stampa3d: 0.38, servizi: 0.22, bandi: 0.10, vendita: 0.20, altri: 0.10 },
  semestre: { stampa3d: 0.31, servizi: 0.24, bandi: 0.17, vendita: 0.18, altri: 0.10 },
  anno: { stampa3d: 0.33, servizi: 0.23, bandi: 0.14, vendita: 0.20, altri: 0.10 },
  anno_fiscale: { stampa3d: 0.33, servizi: 0.23, bandi: 0.14, vendita: 0.20, altri: 0.10 },
};

export const PCT_PREV_BY_TIME: Record<TimeKey, PctSet> = {
  mese: { stampa3d: 0.31, servizi: 0.28, bandi: 0.08, vendita: 0.22, altri: 0.11 },
  trimestre: { stampa3d: 0.35, servizi: 0.25, bandi: 0.09, vendita: 0.20, altri: 0.11 },
  semestre: { stampa3d: 0.29, servizi: 0.26, bandi: 0.15, vendita: 0.18, altri: 0.12 },
  anno: { stampa3d: 0.30, servizi: 0.25, bandi: 0.13, vendita: 0.19, altri: 0.13 },
  anno_fiscale: { stampa3d: 0.33, servizi: 0.23, bandi: 0.14, vendita: 0.20, altri: 0.10 },
};

export const DONUT_COLORS = ["#5750F1", "#0ABEF9", "#5475E5", "#8099EC", "#ADBCF2", "#7C5CFF"];

export const CATEGORY_META: Record<CategoryKey, { label: string; color: string }> = {
  all: { label: "Tutte", color: "#0ABEF9" },
  stampa3d: { label: "Stampa 3D", color: "#5750F1" },
  servizi: { label: "Servizi", color: "#0ABEF9" },
  vendita: { label: "Vendite", color: "#22C55E" },
  bandi: { label: "Bandi", color: "#FB923C" },
  altri: { label: "Altri", color: "#7C5CFF" },
};

export const CATEGORY_TABS: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "Tutte" },
  { key: "stampa3d", label: "Stampa 3D" },
  { key: "servizi", label: "Servizi" },
  { key: "vendita", label: "Vendite" },
  { key: "bandi", label: "Bandi" },
  { key: "altri", label: "Altri" },
];

export const TIME_OPTIONS = [
  ["mese", "1 mese"],
  ["trimestre", "3 mesi"],
  ["semestre", "6 mesi"],
  ["anno", "12 mesi"],
  ["anno_fiscale", "Anno fiscale (da gennaio)"],
] as const satisfies ReadonlyArray<readonly [TimeKey, string]>;

export const PERIOD_LABEL: Record<TimeKey, string> = {
  mese: "1 mese",
  trimestre: "3 mesi",
  semestre: "6 mesi",
  anno: "12 mesi",
  anno_fiscale: "da questo Gennaio"
};

export const SLICE_DEFS = [
  { key: "stampa3d", label: "Stampa 3D" },
  { key: "servizi", label: "Servizi" },
  { key: "vendita", label: "Vendite" },
  { key: "bandi", label: "Bandi / Finanziamenti" },
  { key: "altri", label: "Altri ricavi" },
] as const satisfies ReadonlyArray<{ key: keyof PctSet; label: string }>;

/** opzionali ma utili per fallback txns */
export const SUPPLIERS = ["Cliente A", "Cliente B", "Cliente C", "PA", "Azienda X"];

export const TITLES: Record<keyof PctSet, string[]> = {
  stampa3d: ["Commessa stampa 3D", "Lotto prototipi", "Produzione small-batch"],
  servizi: ["Servizi (mensile)", "Consulenza tecnica", "Assistenza post-vendita"],
  vendita: ["Vendita componenti", "Ordine e-commerce", "Kit / ricambi"],
  bandi: ["Erogazione bando", "Saldo contributo", "Acconto finanziamento"],
  altri: ["Altro ricavo", "Rimborso", "Nota credito"],
};

export const UPCOMING_BY_TIME: Record<TimeKey, UpcomingExpense[]> = {
  mese: [
    { title: "Fattura Cliente A (ipotizzato)", dateLabel: "Tra 6 giorni", amount: 8400 },
    { title: "Saldo commessa stampa 3D", dateLabel: "Tra 10 giorni", amount: 5200 },
    { title: "Incasso servizi (mensile)", dateLabel: "Fine mese", amount: 3100 },
  ],
  trimestre: [
    { title: "Fatture ricorrenti (servizi)", dateLabel: "Tra 2 settimane", amount: 12400 },
    { title: "Vendite e-commerce (stima)", dateLabel: "Tra 1 mese", amount: 9800 },
    { title: "Bando (erogazione stimata)", dateLabel: "Tra 6 settimane", amount: 15000 },
  ],
  semestre: [
    { title: "Servizi (contratto)", dateLabel: "Tra 2 mesi", amount: 22000 },
    { title: "Stampa 3D (commessa)", dateLabel: "Tra 10 settimane", amount: 17500 },
    { title: "Vendite (stima)", dateLabel: "Tra 3 mesi", amount: 14500 },
  ],
  anno: [
    { title: "Contratto servizi (annuale)", dateLabel: "Tra 4 mesi", amount: 48000 },
    { title: "Bando (saldo)", dateLabel: "Tra 7 mesi", amount: 30000 },
    { title: "Vendite (stima)", dateLabel: "Tra 2 mesi", amount: 22000 },
  ],
  anno_fiscale: [
    { title: "Contratto servizi (annuale)", dateLabel: "Tra 4 mesi", amount: 148000 },
    { title: "Bando (saldo)", dateLabel: "Tra 7 mesi", amount: 130000 },
    { title: "Vendite (stima)", dateLabel: "Tra 2 mesi", amount: 122000 },
  ],
};
