// src/components/AtlasModuli/Spese/types.ts

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

export type CategoryKey = "all" | keyof PctSet;

export type Txn = {
  id: string;
  title: string;
  supplier: string;
  dateLabel: string;
  amount: number;
  category: keyof PctSet;
};

export type Memo = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  amount: number;
};
