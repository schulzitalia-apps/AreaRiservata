"use client";

import { useMemo } from "react";
import { cn } from "@/server-utils/lib/utils";
import { ApexDonutChart } from "@/components/Charts/ui/ApexDonutChart";
import { BilancioTachimetro } from "@/components/Charts/bilancio-gauge";
import type { BilancioGaugeData, BilancioMovimento } from "../types";
import { euro, signedEuro } from "../format";
import { Card, CardHeader } from "../ui";

type Props = {
  currentPeriodLabel: string;
  gauge: BilancioGaugeData;
  destinazione: any[];
  destinazioneColors: string[];
  q: string;
  setQ: (value: string) => void;
  deferredQ: string;
  movimenti: BilancioMovimento[];
};

function MovimentoRow({ row }: { row: BilancioMovimento }) {
  const isIn = row.amount >= 0;
  const color = isIn ? "#22C55E" : "#EF4444";
  const sign = isIn ? "+ " : "- ";

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        "hover:bg-white/5 dark:hover:bg-dark-2/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-dark dark:text-white">{row.title}</div>
          <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">{row.dateLabel}</div>
        </div>
      </div>

      <div className="pl-6 text-sm font-extrabold sm:shrink-0 sm:pl-0" style={{ color }}>
        {sign}
        {euro(Math.abs(row.amount))}
      </div>
    </div>
  );
}

export function Grid1(props: Props) {
  const { spese, ricavi, profit } = props.gauge;

  const filtered = useMemo(() => {
    const query = props.deferredQ.trim().toLowerCase();
    if (!query) return props.movimenti;
    return props.movimenti.filter((item) => `${item.title} ${item.dateLabel}`.toLowerCase().includes(query));
  }, [props.deferredQ, props.movimenti]);

  const totalMovimenti = useMemo(() => filtered.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [filtered]);

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      <div className="min-w-0 lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Destinazione utile annuale corrente"
            right={
              <button
                type="button"
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary hover:border-primary/35"
                title="Regole fiscali attive"
              >
                Schema utile
              </button>
            }
          />
          <div className="px-3 pb-5 pt-2 sm:px-4">
            <ApexDonutChart
              height={176}
              data={props.destinazione}
              title="Totale"
              valueFormatter={(value) => euro(value)}
              colors={props.destinazioneColors as any}
              donutSize="70%"
              showLegend={false}
              glow
              className="mx-auto max-w-[220px]"
            />

            <div className="mt-3 space-y-2">
              {props.destinazione.map((item: any, index: number) => (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 text-xs font-semibold">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: props.destinazioneColors[index] ?? "#94A3B8" }} />
                    <span className="truncate text-gray-600 dark:text-dark-6">{item.label}</span>
                  </div>
                  <span className="shrink-0 text-dark dark:text-white">{euro(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="min-w-0 lg:col-span-6">
        <Card className="h-full">
          <CardHeader
            title="% Margine profitto"
            subTitle={props.currentPeriodLabel}
            right={
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-extrabold",
                  profit >= 0 ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-400",
                )}
              >
                {signedEuro(profit)}
              </span>
            }
          />

          <div className="px-4 pb-6 pt-3 sm:px-5">
            <div className="mb-3 grid gap-3 sm:grid-cols-2 sm:gap-6">
              <div>
                <div className="text-xs font-semibold text-red-400/80">Spese</div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">{euro(spese)}</div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs font-semibold text-emerald-300/80">Ricavi</div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">{euro(ricavi)}</div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[220px] sm:max-w-[420px]">
              <BilancioTachimetro periodLabel={props.currentPeriodLabel} data={props.gauge as any} />
            </div>
          </div>
        </Card>
      </div>

      <div className="min-w-0 lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Ultimi movimenti"
            right={<span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">Tot: {signedEuro(totalMovimenti)}</span>}
          />
          <div className="px-4 pb-5">
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-500 dark:text-dark-6">Cerca</label>
              <input
                value={props.q}
                onChange={(event) => props.setQ(event.target.value)}
                placeholder="Es. fattura, F24, affitto..."
                className={cn(
                  "mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none",
                  "focus:border-primary/40",
                  "dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50",
                )}
              />
            </div>

            <div className="max-h-[520px] space-y-1 overflow-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filtered.map((row) => (
                <MovimentoRow key={row.id} row={row} />
              ))}
            </div>

            {!filtered.length ? (
              <div className="mt-3 rounded-lg border border-dashed border-stroke p-3 text-center text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-dark-6">
                Nessun risultato per &quot;{props.deferredQ}&quot;.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
