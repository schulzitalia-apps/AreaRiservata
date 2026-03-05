"use client";

import { ApexBarChart } from "@/components/Charts/ui/ApexBarChart";
import { Card, CardHeader, TopTenList, StatusList } from "../ui";
import { euro } from "../format";
import type { CatKey } from "../types";

type Props = {
  // opzionale: top (se lo usi)
  top10?: any[];
  catLabel: string;

  // bar chart + tabs
  currentPeriodLabel: string;
  catKey: CatKey;
  setCatKey: (v: CatKey) => void;
  categoryTabItems: any[];
  barSeries: any[];
  barColors: string[];
  barStacked: boolean;
  catColor: string;

  // ✅ stati avanzamento (al posto dei memo)
  statusBreakdown: Array<{ stato: string; count: number }>;

  // tabs component esterno
  CategoryTabsDyn: React.ComponentType<{
    value: any;
    onChange: (v: any) => void;
    items: any[];
  }>;
};

export function Grid2(props: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* Top 5 (opzionale) */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Top 5 conferme più alte"
            right={
              <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-700 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/80">
                {props.catLabel}
              </span>
            }
          />
          <div className="px-4 pb-5 pt-2">
            <div className="mt-1 space-y-3">
              <TopTenList rows={(props.top10 ?? []) as any} />
            </div>
          </div>
        </Card>
      </div>

      {/* Bar + tabs */}
      <div className="lg:col-span-6">
        <Card className="h-full">
          <div className="px-5 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">
                  Valore conferme per mese nel periodo selezionato
                </div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
                  Mese per mese{" "}
                  <span className="ml-2 text-sm font-semibold text-gray-500 dark:text-dark-6">
                    ({props.currentPeriodLabel})
                  </span>
                </div>
              </div>

              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
                Seleziona un cliente
              </span>
            </div>

            <div className="mt-4">
              <props.CategoryTabsDyn
                value={props.catKey}
                onChange={props.setCatKey}
                items={props.categoryTabItems}
              />
            </div>
          </div>

          <div className="px-4 pb-5 pt-3">
            <ApexBarChart
              height={360}
              series={props.barSeries as any}
              colors={props.barColors as any}
              stacked={props.barStacked}
              showLegend={false}
              distributed={false}
              glow
              valueFormatter={(n) => euro(n)}
              className="-mx-2 sm:-mx-3"
              options={{
                tooltip: {
                  y: { formatter: (v: number) => euro(Number(v)) },
                },
              }}
            />

            <div className="mt-3 text-sm font-semibold text-gray-600 dark:text-dark-6">
              {props.catKey === "all" ? (
                <>
                  Baseline:{" "}
                  <span className="font-extrabold text-dark dark:text-white">Totale</span>
                </>
              ) : (
                <>
                  Baseline:{" "}
                  <span className="font-extrabold text-dark dark:text-white">Totale</span>
                  <span className="mx-2 text-gray-400">·</span>
                  Riempimento:{" "}
                  <span
                    className="font-extrabold text-dark dark:text-white"
                    style={{ color: props.catColor }}
                  >
                    {props.catLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Stati avanzamento */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Stato avanzamento commesse"
            subTitle="Conteggio per stato"
          />
          <div className="px-4 pb-5 pt-2">
            <StatusList rows={props.statusBreakdown as any} />
          </div>
        </Card>
      </div>
    </div>
  );
}