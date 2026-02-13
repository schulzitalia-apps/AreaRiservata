// src/components/AtlasModuli/Ricavi/types.ts

export type TimeKey = "mese" | "trimestre" | "semestre" | "anno" | "anno_fiscale";

export type UpcomingExpense = {
  title: string;
  dateLabel: string;
  amount: number;
};

/**
 * MOCK PctSet per Ricavi:
 * qui mettiamo categorie "ragionevoli".
 * Se preferisci, puoi allinearle ai tuoi variantId reali.
 */
export type PctSet = {
  stampa3d: number;
  servizi: number;
  vendita: number;
  bandi: number;
  altri: number;
};

export type CategoryKey = "all" | keyof PctSet;

export type Txn = {
  id: string;
  title: string;
  supplier: string; // per ricavi lo useremo come "cliente"
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
