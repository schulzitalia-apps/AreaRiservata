import type { BilancioTimeKey } from "./types";

export const BILANCIO_TIME_OPTIONS = [
  ["anno_fiscale", "Anno fiscale"],
  ["anno", "Anno"],
  ["semestre", "6 mesi"],
  ["trimestre", "3 mesi"],
  ["mese", "1 mese"],
  ["tutto", "Tutto"],
] as const satisfies ReadonlyArray<readonly [BilancioTimeKey, string]>;

export const PERIOD_LABEL: Record<BilancioTimeKey, string> = {
  anno_fiscale: "Anno fiscale (da gennaio)",
  tutto: "Da sempre",
  anno: "12 mesi",
  semestre: "6 mesi",
  trimestre: "3 mesi",
  mese: "1 mese",
};
