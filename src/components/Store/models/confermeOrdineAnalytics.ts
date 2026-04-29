export type AnalyticsStatus = "idle" | "loading" | "succeeded" | "failed";

export type ValueSums = {
  valore: number; // valoreCommessa
  count: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  byVariantId: Record<string, ValueSums>;
  totals: ValueSums;
};

export type TopOrderItem = {
  id: string;
  variantId: string;

  riferimento: string;
  codiceCliente: string | null;

  numeroOrdine: string | null;
  statoAvanzamento: string;

  inizioConsegna: string | null; // ISO
  fineConsegna: string | null;   // ISO
  effectiveDate: string | null;  // ISO (fine > inizio, secondo pipeline)

  valore: number; // valoreCommessa
};

export type ConfermeOrdineAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string;   // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];
  top: {
    recent: Record<string, TopOrderItem[]>;
    upcoming: Record<string, TopOrderItem[]>;
    topValue: Record<string, TopOrderItem[]>;
  };
};

/** Cache entry generico per analytics conferme-ordine */
export type ConfermeOrdineAnalyticsEntry<T = any> = {
  status: AnalyticsStatus;
  data?: T;
  error?: string | null;
  updatedAt?: string | null;
};
