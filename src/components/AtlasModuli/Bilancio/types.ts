export type BilancioTimeKey =
  | "anno_fiscale" // ✅ nuovo (YTD da gennaio)
  | "tutto"
  | "anno"
  | "semestre"
  | "trimestre"
  | "mese";

export type BilancioTotals = {
  ricavi: number;
  spese: number;
};

export type BilancioGaugeData = {
  ricavi: number;
  spese: number;

  profit: number;
  isProfit: boolean;

  relativePct: number; // 0..1
  relativePctLabel: string; // es "12%"
};

export type BilancioMovimento = {
  id: string;
  title: string;
  dateLabel: string;
  amount: number; // + entrata, - uscita
};
