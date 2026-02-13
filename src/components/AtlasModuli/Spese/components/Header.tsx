"use client";

import Select from "@/components/ui/select";
import type { TimeKey } from "../types";

type Props = {
  currentPeriodLabel: string;

  timeKey: TimeKey;
  setTimeKey: (v: TimeKey) => void;

  setCatKeyAll: () => void;

  isPending: boolean;

  useMock: boolean;
  toggleUseMock: () => void;

  apiStatus?: string;
  apiError?: any;

  TIME_OPTIONS: any;

  insightLine: string;
};

export function Header(props: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold text-dark dark:text-white">Spese</h1>

          <span className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-extrabold text-primary">
            {props.currentPeriodLabel}
          </span>

          {/* Toggle Mock/API */}
          <button
            type="button"
            onClick={props.toggleUseMock}
            className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-700 hover:bg-white dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/80 dark:hover:bg-dark-2"
            title="Switch Mock/API"
          >
            {props.useMock ? "Mock" : "API"}
          </button>

          {!props.useMock && props.apiStatus === "loading" ? (
            <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-700 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/70">
              Caricamento…
            </span>
          ) : null}

          {!props.useMock && props.apiStatus === "failed" ? (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-extrabold text-red-500">
              Errore API
            </span>
          ) : null}

          {props.isPending ? (
            <span className="rounded-full border border-stroke bg-white/60 px-3 py-1 text-xs font-extrabold text-gray-700 dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/70">
              Aggiornamento…
            </span>
          ) : null}
        </div>

        <div className="mt-1 text-sm font-semibold text-gray-600 dark:text-dark-6">
          {props.insightLine}
        </div>

        {!props.useMock && props.apiError ? (
          <div className="mt-2 text-xs font-semibold text-red-500/90">
            {String(props.apiError)}
          </div>
        ) : null}
      </div>

      <div className="w-[220px]">
        <Select
          value={props.timeKey}
          onChange={(v) => {
            props.setTimeKey(v as TimeKey);
            props.setCatKeyAll();
          }}
          options={props.TIME_OPTIONS as any}
        />
      </div>
    </div>
  );
}
