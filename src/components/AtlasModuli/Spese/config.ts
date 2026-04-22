import type { TimeKey } from "./types";
import type { CategoryMeta } from "./speseOverview.category";

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
  f24: { label: "F24", color: "#ADBCF2" },
  consulenze: { label: "Commercialista", color: "#7C5CFF" },
  stipendi: { label: "Stipendi", color: "#0ABEF9" },
  magazzino3d: { label: "Magazzino", color: "#5750F1" },
  software: { label: "Abbonamenti", color: "#22C55E" },
  energia: { label: "Energia", color: "#FB923C" },
};

export const TIME_OPTIONS = [
  ["mese", "1 mese"],
  ["trimestre", "3 mesi"],
  ["semestre", "6 mesi"],
  ["anno", "12 mesi"],
  ["anno_fiscale", "Anno fiscale"],
] as const satisfies ReadonlyArray<readonly [TimeKey, string]>;

export const PERIOD_LABEL: Record<TimeKey, string> = {
  mese: "1 mese",
  trimestre: "3 mesi",
  semestre: "6 mesi",
  anno: "12 mesi",
  anno_fiscale: "a partire da gennaio",
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
