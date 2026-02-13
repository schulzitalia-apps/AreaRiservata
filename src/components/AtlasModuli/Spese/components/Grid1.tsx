"use client";

import { cn } from "@/server-utils/lib/utils";
import { ApexDonutChart } from "@/components/Charts/ui/ApexDonutChart";
import { RadialGauge } from "@/components/Charts/radial-gauge";

import { Card, CardHeader, UpcomingTable } from "../ui";
import { euro } from "../format";
import { DONUT_COLORS } from "../mock";

type Props = {
  currentPeriodLabel: string;

  // prev donut
  categoriesPrev: any;

  // gauge
  gaugePercent: number;
  gaugeSubtitle: string;
  deltaIsUp: boolean;

  // current donut
  categoriesCurrent: any;
  donutColors: string[];

  // upcoming
  q: string;
  setQ: (v: string) => void;
  deferredQ: string;
  filteredUpcoming: any[];
  upcomingTotal: number;
};

export function Grid1(props: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* sinistra: prev + gauge */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader title="Periodo precedente" subTitle={props.currentPeriodLabel} />

          <div className="px-4 pb-4 pt-1">
            <ApexDonutChart
              height={250}
              data={props.categoriesPrev}
              title="Totale spese"
              valueFormatter={(n) => euro(n)}
              colors={DONUT_COLORS}
              donutSize="76%"
              showLegend={false}
              glow
              className="-mx-2"
            />
          </div>

          <div className="mx-5 my-1 h-px bg-stroke dark:bg-dark-3" />

          <div className="px-4 pb-5 pt-3">
            <div className="mb-2 text-sm font-extrabold text-dark dark:text-white">
              Avanzamento spese
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

      {/* centro: donut current */}
      <div className="lg:col-span-6">
        <Card className="h-full">
          <div className="px-5 pt-5">
            <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">
              Distribuzione spese
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
              title="Totale spese"
              valueFormatter={(n) => euro(n)}
              colors={props.donutColors as any}
              donutSize="86%"
              showLegend={false}
              glow
              className="-mx-3 sm:-mx-5"
            />
          </div>
        </Card>
      </div>

      {/* destra: upcoming */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Prossime spese"
            right={
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
                Tot: {euro(props.upcomingTotal)}
              </span>
            }
          />
          <div className="px-4 pb-4">
            <div className="mb-3">
              <label className="text-xs font-semibold text-gray-500 dark:text-dark-6">
                Cerca
              </label>
              <input
                value={props.q}
                onChange={(e) => props.setQ(e.target.value)}
                placeholder="Es. F24, stipendi, energia…"
                className={cn(
                  "mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none",
                  "focus:border-primary/40",
                  "dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50",
                )}
              />
            </div>

            <div className="max-h-[560px] overflow-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <UpcomingTable rows={props.filteredUpcoming as any} />
            </div>

            {!props.filteredUpcoming.length ? (
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
