export type FinancialsStatus = "idle" | "loading" | "succeeded" | "failed";

export type StatoFatturazione =
  | "ipotizzato"
  | "programmato"
  | "fatturato"
  | "pagato"
  | "stornato";

export type MoneySums = {
  lordo: number;
  netto: number;
  iva: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  byVariantId: Record<string, MoneySums>;
  totals: MoneySums;
};

/* =========================
 * SPESE
 * ========================= */

export type TopExpenseItem = {
  id: string;
  variantId: string;
  titolo: string;
  fornitore: string | null;
  statoFatturazione: StatoFatturazione;

  dataSpesa: string | null; // ISO
  dataFatturazione: string | null; // ISO
  dataPagamento: string | null; // ISO
  effectiveDate: string | null; // ISO (pagamento > fatturazione > spesa)

  lordo: number;
  netto: number;
  iva: number;
};

export type SpeseAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string; // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];
  top: {
    paidOrInvoicedRecent: Record<string, TopExpenseItem[]>;
    programmatoRecent: Record<string, TopExpenseItem[]>;
    programmatoTop: Record<string, TopExpenseItem[]>;
    ipotizzatoUpcoming: Record<string, TopExpenseItem[]>;
  };
};

/* =========================
 * RICAVI
 * ========================= */

export type TopRevenueItem = {
  id: string;
  variantId: string;

  titolo: string;
  cliente: string | null;
  statoFatturazione: StatoFatturazione | string;

  dataFatturazione: string | null; // ISO
  dataPagamento: string | null; // ISO
  effectiveDate: string | null; // ISO (pagamento > fatturazione)

  lordo: number;
  netto: number;
  iva: number;

  // opzionali utili per UI/tooltip (non obbligatori)
  numeroFattura?: string | null;
  categoriaRicavo?: string | null;
  ragioneSocialeRicavo?: string | null;
  provenienzaCliente?: string | null;
};

export type RicaviAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string; // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];
  top: {
    paidOrInvoicedRecent: Record<string, TopRevenueItem[]>;
    programmatoRecent: Record<string, TopRevenueItem[]>;
    programmatoTop: Record<string, TopRevenueItem[]>;
    ipotizzatoUpcoming: Record<string, TopRevenueItem[]>;
  };
};

/** Cache entry generico per qualunque "financials report" */
export type FinancialsEntry<T = any> = {
  status: FinancialsStatus;
  data?: T;
  error?: string | null;
  updatedAt?: string | null;
};
