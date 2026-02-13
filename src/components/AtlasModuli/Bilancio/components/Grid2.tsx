"use client";

import Link from "next/link";
import { cn } from "@/server-utils/lib/utils";

import { ApexDonutChart } from "@/components/Charts/ui/ApexDonutChart";
import { ApexCinematicDualBarChart } from "@/components/Charts/ui/ApexCinematicDualBarChart";

import { Card, CardHeader } from "../ui";
import { euro } from "../format";

type Props = {
  currentPeriodLabel: string;

  // Donut Ricavi/Spese (prendiamo dai computed dei moduli)
  ricaviDonutData: any[];
  ricaviDonutColors: string[];
  speseDonutData: any[];
  speseDonutColors: string[];

  // Istogramma doppio
  barCategories: string[];
  barSeries: { name: string; data: number[] }[];
  barColors: string[];

  // mock extra “cose simili”
  notes: { label: string; value: string; hint?: string }[];
};

function MiniDonutLinkCard(props: {
  href: string;
  title: string;
  data: any[];
  colors: string[];
  valueLabel: string;
}) {
  return (
    <Link href={props.href} className="block">
      <Card
        className={cn(
          "group h-full cursor-pointer transition",
          "hover:border-primary/35 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_30px_90px_rgba(0,0,0,0.35)]",
        )}
      >
        <div className="px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">
                Vai a {props.title.toLowerCase()}
              </div>
              <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
                {props.title}
              </div>
            </div>

            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
              Apri →
            </span>
          </div>
        </div>

        <div className="px-4 pb-5 pt-1">
          <ApexDonutChart
            height={200}
            data={props.data}
            title={props.valueLabel}
            valueFormatter={(n) => euro(n)}
            colors={props.colors as any}
            donutSize="76%"
            showLegend={false}
            glow
            className="-mx-2"
          />
        </div>
      </Card>
    </Link>
  );
}

export function Grid2(props: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* SINISTRA: due donut cliccabili */}
      <div className="lg:col-span-3">
        <div className="grid gap-6">
          <MiniDonutLinkCard
            href="/ricavi"
            title="Ricavi"
            data={props.ricaviDonutData}
            colors={props.ricaviDonutColors}
            valueLabel="Totale ricavi"
          />

          <MiniDonutLinkCard
            href="/spese"
            title="Spese"
            data={props.speseDonutData}
            colors={props.speseDonutColors}
            valueLabel="Totale spese"
          />
        </div>
      </div>

      {/* CENTRO: istogramma doppio “cinema” */}
      <div className="lg:col-span-6">
        <Card className="h-full">
          <CardHeader title="Overview periodo selezionato" subTitle={props.currentPeriodLabel} />

          <div className="px-4 pb-5 pt-3">
            <ApexCinematicDualBarChart
              height={380}
              categories={props.barCategories}
              series={props.barSeries}
              colors={props.barColors}
              showLegend
              valueFormatter={(n) => euro(n)}
            />

            <div className="mt-3 text-sm font-semibold text-gray-600 dark:text-dark-6">
              Confronto <span className="font-extrabold text-dark dark:text-white">Ricavi</span> vs{" "}
              <span className="font-extrabold text-dark dark:text-white">Spese</span> nel periodo selezionato.
            </div>
          </div>
        </Card>
      </div>

      {/* DESTRA: “cose simili” (mock) */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader title="Indicatori" subTitle="Mock per ora" />
          <div className="px-4 pb-5 pt-2">
            <div className="space-y-3">
              {props.notes.map((r, i) => (
                <div
                  key={`${r.label}-${i}`}
                  className="rounded-2xl border border-stroke bg-white/60 p-3 dark:border-dark-3 dark:bg-gray-dark/40"
                >
                  <div className="text-xs font-semibold text-gray-500 dark:text-dark-6">{r.label}</div>
                  <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">{r.value}</div>
                  {r.hint ? (
                    <div className="mt-1 text-xs font-semibold text-gray-600 dark:text-dark-6">{r.hint}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
