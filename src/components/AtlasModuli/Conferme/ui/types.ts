export type CatKey = "all" | string;

export type UpcomingRow = {
  title: string;
  dateLabel: string;
  amount: number;
};

export type TxnRow = {
  id: string;
  title: string;
  supplier: string; // per conferme = cliente (seconda riga)
  dateLabel: string;
  amount: number;
  category: string; // clienteKey
};

export type StatusRow = {
  stato: string;
  count: number;
};