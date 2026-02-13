import { Suspense } from "react";

import { OverviewCardsGroup } from "./_components/overview-cards";
import { OverviewCardsSkeleton } from "@/app/(admin)/admin/_components/overview-cards/skeleton";

import { OverviewStatsGroup } from "./_components/overview-stats";
import { OverviewStatsSkeleton } from "./_components/overview-stats";

type PropsType = {
  searchParams: Promise<{ selected_time_frame?: string }>;
};

export default async function Home({ searchParams }: PropsType) {
  // per ora non lo usiamo, ma lo lasciamo pronto se ti serve dopo
  await searchParams;

  return (
    <>
      {/* HERO / Header */}
      <div className="mb-4 flex items-start justify-between md:mb-6 2xl:mb-9">
        <div>
          <h1 className="text-xl font-semibold text-dark dark:text-white">
            Dashboard Admin
          </h1>
          <p className="mt-1 text-sm text-dark-6">
            Azioni rapide e statistiche principali del sistema.
          </p>
        </div>
      </div>

      {/* AZIONI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark dark:text-white">
            Azioni rapide
          </h2>
        </div>

        <Suspense fallback={<OverviewCardsSkeleton />}>
          <OverviewCardsGroup />
        </Suspense>
      </section>

      {/* STATS */}
      <section className="mt-6 space-y-3 md:mt-8 2xl:mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark dark:text-white">
            Panoramica statistiche
          </h2>
        </div>

        <Suspense fallback={<OverviewStatsSkeleton />}>
          <OverviewStatsGroup />
        </Suspense>
      </section>
    </>
  );
}
