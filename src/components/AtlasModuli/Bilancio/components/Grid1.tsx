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

  // centro: tachimetro
  gauge: BilancioGaugeData;

  // sinistra: donut destinazione (mock)
  destinazione: any[];
  destinazioneColors: string[];

  // destra: movimenti
  q: string;
  setQ: (v: string) => void;
  deferredQ: string;
  movimenti: BilancioMovimento[];
};

function MovimentoRow(props: { row: BilancioMovimento }) {
  const isIn = props.row.amount >= 0;
  const color = isIn ? "#22C55E" : "#EF4444";
  const sign = isIn ? "+ " : "- ";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-2 py-2",
        "hover:bg-white/5 dark:hover:bg-dark-2/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-dark dark:text-white">
            {props.row.title}
          </div>
          <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">
            {props.row.dateLabel}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-sm font-extrabold" style={{ color }}>
        {sign}
        {euro(Math.abs(props.row.amount))}
      </div>
    </div>
  );
}

export function Grid1(props: Props) {
  const spese = props.gauge.spese;
  const ricavi = props.gauge.ricavi;
  const profit = props.gauge.profit;

  const filtered = useMemo(() => {
    const q = props.deferredQ.trim().toLowerCase();
    if (!q) return props.movimenti;
    return props.movimenti.filter((m) => `${m.title} ${m.dateLabel}`.toLowerCase().includes(q));
  }, [props.deferredQ, props.movimenti]);

  const totalMovimenti = useMemo(
    () => filtered.reduce((a, r) => a + (Number(r.amount) || 0), 0),
    [filtered],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* sinistra: destinazione */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Destinazione utile annuale corrente"
            right={
              <button
                type="button"
                className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary hover:border-primary/35"
                title="Valori manuali (mock)"
              >
                Da inserire a mano
              </button>
            }
          />
          <div className="px-4 pb-5 pt-2">
            <ApexDonutChart
              height={240}
              data={props.destinazione}
              title="Totale"
              valueFormatter={(n) => euro(n)}
              colors={props.destinazioneColors as any}
              donutSize="78%"
              showLegend={false}
              glow
              className="-mx-2"
            />

            <div className="mt-3 space-y-2">
              {props.destinazione.map((d: any, i: number) => (
                <div key={`${d.label}-${i}`} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: props.destinazioneColors[i] ?? "#94A3B8" }}
                    />
                    <span className="truncate text-gray-600 dark:text-dark-6">{d.label}</span>
                  </div>
                  <span className="text-dark dark:text-white">{euro(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* centro: tachimetro */}
      <div className="lg:col-span-6">
        <Card className="h-full">
          <CardHeader
            title="% Margine profitto"
            subTitle={props.currentPeriodLabel}
            right={
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-extrabold",
                  profit >= 0
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/25 bg-red-500/10 text-red-400",
                )}
              >
                {signedEuro(profit)}
              </span>
            }
          />

          <div className="px-5 pb-6 pt-3">
            {/* sopra: spese sx + ricavi dx */}
            <div className="mb-3 flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold text-red-400/80">Spese</div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
                  {euro(spese)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-emerald-300/80">Ricavi</div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
                  {euro(ricavi)}
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[460px]">
              <BilancioTachimetro
                periodLabel={props.currentPeriodLabel}
                data={props.gauge as any}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* destra: ultimi movimenti */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Ultimi movimenti"
            right={
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
                Tot: {signedEuro(totalMovimenti)}
              </span>
            }
          />
          <div className="px-4 pb-5">
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-500 dark:text-dark-6">Cerca</label>
              <input
                value={props.q}
                onChange={(e) => props.setQ(e.target.value)}
                placeholder="Es. fattura, F24, affitto…"
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
                Nessun risultato per “{props.deferredQ}”.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
