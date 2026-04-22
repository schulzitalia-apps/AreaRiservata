import type { TimeKey } from "./types";
import type { CategoryMeta } from "./ricaviOverview.category";

export type TotalsLike = Record<
  TimeKey,
  {
    current: { lordo: number; ivaRecuperata: number };
    prev: { lordo: number; ivaRecuperata: number };
  }
>;

export const DONUT_COLORS = ["#5750F1", "#0ABEF9", "#5475E5", "#8099EC", "#ADBCF2", "#7C5CFF"];

export const CATEGORY_META: CategoryMeta = {
  all: { label: "Tutte", color: "#0ABEF9" },
  stampa3d: { label: "Stampa 3D", color: "#5750F1" },
  servizi: { label: "Servizi", color: "#0ABEF9" },
  vendita: { label: "Vendite", color: "#22C55E" },
  bandi: { label: "Bandi", color: "#FB923C" },
  altri: { label: "Altri", color: "#7C5CFF" },
};

export const TIME_OPTIONS = [
  ["mese", "1 mese"],
  ["trimestre", "3 mesi"],
  ["semestre", "6 mesi"],
  ["anno", "12 mesi"],
  ["anno_fiscale", "Anno fiscale (da gennaio)"],
] as const satisfies ReadonlyArray<readonly [TimeKey, string]>;

export const PERIOD_LABEL: Record<TimeKey, string> = {
  mese: "1 mese",
  trimestre: "3 mesi",
  semestre: "6 mesi",
  anno: "12 mesi",
  anno_fiscale: "da questo gennaio",
};

export function buildEmptyTotalsLike(): TotalsLike {
  return {
    mese: { current: { lordo: 0, ivaRecuperata: 0 }, prev: { lordo: 0, ivaRecuperata: 0 } },
    trimestre: { current: { lordo: 0, ivaRecuperata: 0 }, prev: { lordo: 0, ivaRecuperata: 0 } },
    semestre: { current: { lordo: 0, ivaRecuperata: 0 }, prev: { lordo: 0, ivaRecuperata: 0 } },
    anno: { current: { lordo: 0, ivaRecuperata: 0 }, prev: { lordo: 0, ivaRecuperata: 0 } },
    anno_fiscale: { current: { lordo: 0, ivaRecuperata: 0 }, prev: { lordo: 0, ivaRecuperata: 0 } },
  };
}
