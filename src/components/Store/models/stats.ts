export type StatsStatus = "idle" | "loading" | "succeeded" | "failed";

/**
 * Risposta dal backend:
 * POST /api/stats/anagrafiche/:type/field
 */
export type StatsKind = "select" | "date" | "number";

export type SelectStatsResponse = {
  kind: "select";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    counts: { value: string; count: number }[];
    myValue: string;
    myCount: number;
    myPercent: number;
    othersCount: number;
    othersPercent: number;
  };
};

export type DateStatsResponse = {
  kind: "date";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    pivotIso: string;
    beforeCount: number;
    afterCount: number;
    equalCount: number;
  };
};

export type NumberStatsResponse = {
  kind: "number";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    pivot: number;
    lessCount: number;
    greaterCount: number;
    equalCount: number;
    avg: number | null;
  };
};

export type AnagraficheFieldStatsResponse =
  | SelectStatsResponse
  | DateStatsResponse
  | NumberStatsResponse;

/** Cache entry generico per qualunque "stat" */
export type StatsEntry<T = any> = {
  status: StatsStatus;
  data?: T;
  error?: string | null;
  updatedAt?: string | null;
};
