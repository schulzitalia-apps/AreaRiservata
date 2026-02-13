"use client";

import { ApexBarChart } from "@/components/Charts/ui/ApexBarChart";
import { Card, CardHeader, MemoList, TopTenList } from "../ui";
import { euro } from "../format";
import { CategoryTabsDyn } from "../CategoryTabsDyn";
import type { CatKey } from "../speseOverview.category";

type Props = {
  // top5
  top10: any[];
  catLabel: string;

  // bar chart + tabs
  currentPeriodLabel: string;
  catKey: CatKey;
  setCatKey: (v: CatKey) => void;
  categoryTabItems: any[];
  barSeries: any[];
  barColors: string[];
  catColor: string;

  // memos
  memos: any[];
  memoOpen: boolean;
  setMemoOpen: (v: boolean | ((p: boolean) => boolean)) => void;

  memoTitle: string;
  setMemoTitle: (v: string) => void;
  memoDate: string;
  setMemoDate: (v: string) => void;
  memoAmount: number;
  setMemoAmount: (v: number) => void;

  onAddMemo: () => void;
};

export function Grid2(props: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* Top 5 */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="Top 5 spese più alte"
            right={
              <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-700 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/80">
                {props.catLabel}
              </span>
            }
          />
          <div className="px-4 pb-5 pt-2">
            <div className="mt-1 space-y-3">
              <TopTenList rows={props.top10 as any} />
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
                  Spese per mese nel periodo selezionato
                </div>
                <div className="mt-1 text-lg font-extrabold text-dark dark:text-white">
                  Mese per mese{" "}
                  <span className="ml-2 text-sm font-semibold text-gray-500 dark:text-dark-6">
                    ({props.currentPeriodLabel})
                  </span>
                </div>
              </div>

              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
                Seleziona una categoria
              </span>
            </div>

            <div className="mt-4">
              <CategoryTabsDyn
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
              stacked={props.catKey !== "all"}
              showLegend={false}
              distributed={false}
              glow
              valueFormatter={(n) => euro(n)}
              className="-mx-2 sm:-mx-3"
              options={{
                tooltip: {
                  y: {
                    formatter: (v: number) => euro(Number(v)),
                  },
                },
              }}
            />

            <div className="mt-3 text-sm font-semibold text-gray-600 dark:text-dark-6">
              {props.catKey === "all" ? (
                <>
                  Baseline:{" "}
                  <span className="font-extrabold text-dark dark:text-white">
                    Totale
                  </span>
                </>
              ) : (
                <>
                  Baseline:{" "}
                  <span className="font-extrabold text-dark dark:text-white">
                    Totale
                  </span>
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

      {/* Memo */}
      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader
            title="MemoSpese"
            right={
              <button
                type="button"
                onClick={() => props.setMemoOpen((v: boolean) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary hover:border-primary/35"
              >
                <span className="text-lg leading-none">+</span> Aggiungi
              </button>
            }
          />

          <div className="px-4 pb-5">
            {props.memoOpen ? (
              <div className="mb-4 rounded-2xl border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-gray-dark">
                <div className="grid gap-2">
                  <input
                    value={props.memoTitle}
                    onChange={(e) => props.setMemoTitle(e.target.value)}
                    placeholder="Titolo"
                    className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none focus:border-primary/40 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={props.memoDate}
                      onChange={(e) => props.setMemoDate(e.target.value)}
                      className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none focus:border-primary/40 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50"
                    />
                    <input
                      type="number"
                      value={props.memoAmount || ""}
                      onChange={(e) => props.setMemoAmount(Number(e.target.value))}
                      placeholder="Importo"
                      className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark outline-none focus:border-primary/40 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:focus:border-primary/50"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={props.onAddMemo}
                      className="flex-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-extrabold text-primary hover:bg-primary/15"
                    >
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => props.setMemoOpen(false)}
                      className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-extrabold text-gray-700 hover:bg-gray-50 dark:border-dark-3 dark:bg-gray-dark dark:text-white/80 dark:hover:bg-dark-2"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <MemoList rows={props.memos as any} />
          </div>
        </Card>
      </div>
    </div>
  );
}
