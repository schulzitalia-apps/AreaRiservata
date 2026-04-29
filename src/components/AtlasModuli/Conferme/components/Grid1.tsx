"use client";

import { cn } from "@/server-utils/lib/utils";
import { ApexDonutChart } from "@/components/Charts/ui/ApexDonutChart";
import { RadialGauge } from "@/components/Charts/radial-gauge";

import { Card, CardHeader, UpcomingTable } from "../ui";
import { euro } from "../format";

const FALLBACK_DONUT_COLORS = [
  "#5750F1",
  "#0ABEF9",
  "#22C55E",
  "#FB923C",
  "#EF4444",
  "#A855F7",
  "#14B8A6",
  "#F59E0B",
];

type Props = {
  currentPeriodLabel: string;
  categoriesPrev: any;
  gaugePercent: number;
  gaugeSubtitle: string;
  deltaIsUp: boolean;
  categoriesCurrent: any;
  donutColors: string[];
  q: string;
  setQ: (v: string) => void;
  deferredQ: string;
  filteredUpcoming: any[];
  upcomingTotal: number;
};

export function Grid1(props: Props) {
  const donutColorsSafe =
    props.donutColors?.length ? props.donutColors : FALLBACK_DONUT_COLORS;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      <div className="lg:col-span-3">
        <Card className="h-full overflow-visible">
          <CardHeader title="Periodo precedente" subTitle={props.currentPeriodLabel} />

          <div className="px-4 pb-4 pt-1">
            <ApexDonutChart
              height={250}
              data={props.categoriesPrev}
              title="Valore conferme"
              valueFormatter={(n) => euro(n)}
              colors={donutColorsSafe as any}
              donutSize="76%"
              showLegend={false}
              glow
              className="-mx-2"
              options={{ tooltip: { enabled: true } }}
            />
          </div>

          <div className="mx-5 my-1 h-px bg-stroke dark:bg-dark-3" />

          <div className="px-4 pb-5 pt-3">
            <div className="mb-2 text-sm font-extrabold text-dark dark:text-white">
              Avanzamento conferme
            </div>

            <RadialGauge<"periodo">
              showHeader={false}
              options={[
                {
                  key: "periodo",
                  label: props.currentPeriodLabel,
                  subLabel: props.currentPeriodLabel,
                },
              ]}
              data={{
                periodo: { value: props.gaugePercent, subtitle: props.gaugeSubtitle },
              }}
              defaultKey="periodo"
              size="large"
              colorFrom={props.deltaIsUp ? "#FB923C" : "#22C55E"}
              colorTo={props.deltaIsUp ? "#EF4444" : "#0ABEF9"}
              className="-mx-2"
            />

            <div className="mt-2 text-center text-sm font-semibold text-gray-600 dark:text-dark-6">
              {props.gaugeSubtitle}
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-6">
        <Card className="h-full overflow-visible">
          <div className="px-5 pt-5">
            <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">
              Distribuzione per cliente
            </div>
            <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
              Periodo corrente{" "}
              <span className="ml-2 text-sm font-semibold text-gray-500 dark:text-dark-6">
                ({props.currentPeriodLabel})
              </span>
            </div>
          </div>

          <div className="px-3 pb-6 pt-2">
            <ApexDonutChart
              height={560}
              data={props.categoriesCurrent}
              title="Valore conferme"
              valueFormatter={(n) => euro(n)}
              colors={donutColorsSafe as any}
              donutSize="86%"
              showLegend={false}
              glow
              className="-mx-3 sm:-mx-5"
              options={{ tooltip: { enabled: true } }}
            />
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card className="h-full">
          <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
            <div className="flex flex-col gap-2">
              <div className="text-base font-extrabold text-dark dark:text-white">
                Prossime consegne
              </div>
              <div className="flex items-center justify-start">
                <span className="inline-flex max-w-full items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
                  Totale: {euro(props.upcomingTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-dark-6">
                Cerca
              </label>
              <input
                value={props.q}
                onChange={(e) => props.setQ(e.target.value)}
                placeholder="Es. Rossi, ordine 123, consegna..."
                className={cn(
                  "mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none",
                  "focus:border-primary/40",
                  "dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50",
                )}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-stroke/70 dark:border-dark-3/70">
              <div className="max-h-[560px] overflow-auto pr-1 [scrollbar-width:thin]">
                <UpcomingTable rows={props.filteredUpcoming as any} />
              </div>
            </div>

            {!props.filteredUpcoming.length ? (
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
