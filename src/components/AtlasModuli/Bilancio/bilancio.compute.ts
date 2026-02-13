import type { BilancioGaugeData, BilancioTotals } from "./types";

function pctLabel(v01OrMore: number) {
  const safe = Number.isFinite(v01OrMore) ? v01OrMore : 0;
  return `${Math.round(safe * 100)}%`;
}

export function computeBilancioGauge(totals: BilancioTotals): BilancioGaugeData {
  const ricavi = Math.max(0, Math.round(Number(totals.ricavi || 0)));
  const spese = Math.max(0, Math.round(Number(totals.spese || 0)));

  const profit = Math.round(ricavi - spese);
  const isProfit = profit >= 0;

  const denom = isProfit ? ricavi : spese;
  const relativePct = denom > 0 ? Math.abs(profit) / denom : 0;

  return {
    ricavi,
    spese,
    profit,
    isProfit,
    relativePct,
    relativePctLabel: pctLabel(relativePct),
  };
}
