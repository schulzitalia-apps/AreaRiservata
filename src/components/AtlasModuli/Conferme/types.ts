// src/components/AtlasModuli/ConfermeOrdine/types.ts

export type TimeKey = "mese" | "trimestre" | "semestre" | "anno" | "anno_fiscale";

/** Chiave categoria = cliente (o "all") */
export type CatKey = "all" | string;

export type ValueSums = {
  valore: number; // valoreCommessa
  count: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  byVariantId: Record<string, ValueSums>; // qui "variantId" = CLIENTE (chiave)
  totals: ValueSums;
};

export type TopOrderItem = {
  id: string;
  variantId: string; // qui può essere cliente-key se backend la usa

  riferimento: string;
  codiceCliente: string | null;

  numeroOrdine: string | null;
  statoAvanzamento: string;

  inizioConsegna: string | null; // ISO
  fineConsegna: string | null; // ISO
  effectiveDate: string | null; // ISO (qui useremo INIZIO per i grafici)

  valore: number; // valoreCommessa
};

export type ConfermeOrdineAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string; // "YYYY-MM"
    monthsBack: number;
  };
  /** lista dei clienti/keys effettive presenti */
  variantIds: string[];
  months: MonthRow[];
  top: {
    recent: Record<string, TopOrderItem[]>;
    upcoming: Record<string, TopOrderItem[]>;
    topValue: Record<string, TopOrderItem[]>;
  };
};

export type StatusBreakdownRow = {
  stato: string;
  count: number;
};
