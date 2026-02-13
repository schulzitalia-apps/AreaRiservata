export type BilancioGaugeData = {
  ricavi: number;
  spese: number;

  profit: number;
  isProfit: boolean;

  /** 0..∞ (es 1.10 => 110%) */
  relativePct: number;

  /** es "62%" / "110%" */
  relativePctLabel: string;
};

export type BilancioGaugeProps = {
  periodLabel: string;
  data: BilancioGaugeData;

  className?: string;

  goodFrom?: string;
  goodTo?: string;
  badFrom?: string;
  badTo?: string;
};
