export type TimeKey = "mese" | "trimestre" | "semestre" | "anno" | "anno_fiscale";

export type UpcomingExpense = {
  title: string;
  dateLabel: string;
  amount: number;
};

export type PctSet = {
  magazzino3d: number;
  stipendi: number;
  f24: number;
  energia: number;
  software: number;
  consulenze: number;
};

export type CategoryKey = "all" | string;

export type Txn = {
  id: string;
  title: string;
  supplier: string;
  dateLabel: string;
  amount: number;
  category: string;
};

export type Memo = {
  id: string;
  title: string;
  date: string;
  amount: number;
};
