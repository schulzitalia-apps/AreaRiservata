"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import Select from "@/components/ui/select";
import { SprintTimelineQuickAdd } from "./SprintTimelineQuickAdd";
import { TASK_TYPE_OPTIONS } from "./SprintTimeline.helpers";
import type {
  SprintTimelineBoardData,
  SprintTimelineFilters,
  SprintTimelineZoom,
} from "./SprintTimeline.types";

const zoomOptions: Array<{ value: SprintTimelineZoom; label: string; hint: string }> = [
  { value: "roadmap", label: "Roadmap", hint: "panorama" },
  { value: "month", label: "Mese", hint: "28 giorni" },
  { value: "sprint-focus", label: "Sprint focus", hint: "centrata" },
  { value: "week", label: "Settimana", hint: "7 giorni" },
];

const signalOptions = [
  { value: "", label: "Tutti i semafori" },
  { value: "red", label: "Bloccati / rosso" },
  { value: "orange", label: "A rischio / arancio" },
  { value: "yellow", label: "Checkpoint aperti / giallo" },
  { value: "purple", label: "Validazione / viola" },
  { value: "blue", label: "In corso / blu" },
  { value: "green", label: "Completati / verde" },
  { value: "gray", label: "Pianificati / grigio" },
];

function SectionShell({
                        eyebrow,
                        title,
                        children,
                        className,
                      }: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-[22px] border border-primary/12 bg-white/65 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur dark:border-dark-3 dark:bg-gray-dark/45",
        className,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dark/42 dark:text-white/42">
        {eyebrow}
      </div>
      <div className="mt-1 text-sm font-semibold text-dark dark:text-white">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
      {label}
    </span>
  );
}

export function SprintTimelineToolbar({
                                        data,
                                        filters,
                                        zoom,
                                        totalVisible,
                                        viewportTitle,
                                        todayLabel,
                                        activeFilterCount,
                                        onFiltersChange,
                                        onZoomChange,
                                        onMoveViewport,
                                        onResetViewport,
                                        onClearFilters,
                                        onQuickAdd,
                                        onOpenScrumMaster,
                                      }: {
  data: SprintTimelineBoardData;
  filters: SprintTimelineFilters;
  zoom: SprintTimelineZoom;
  totalVisible: number;
  viewportTitle: string;
  todayLabel: string;
  activeFilterCount: number;
  onFiltersChange: (next: SprintTimelineFilters) => void;
  onZoomChange: (next: SprintTimelineZoom) => void;
  onMoveViewport: (direction: -1 | 1) => void;
  onResetViewport: () => void;
  onClearFilters: () => void;
  onQuickAdd: () => void;
  onOpenScrumMaster?: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.query.trim()) chips.push(`ricerca: ${filters.query.trim()}`);
    if (filters.signal) {
      const label = signalOptions.find((item) => item.value === filters.signal)?.label;
      if (label) chips.push(label);
    }
    if (filters.taskType) {
      const label = TASK_TYPE_OPTIONS.find((item) => item.value === filters.taskType)?.label;
      if (label) chips.push(label);
    }
    if (filters.visibilityMode === "mine") chips.push("solo miei");
    if (filters.visibilityMode === "reviewer") chips.push("come revisore");
    return chips;
  }, [filters]);

  const taskTypeOptions = useMemo(
    () => TASK_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );

  return (
    <div className="min-w-0 rounded-[28px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.08),transparent_28%),rgba(255,255,255,0.78)] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur dark:border-dark-3 dark:bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_28%),rgba(17,24,39,0.62)]">
      <div className="space-y-4">
        <div className="flex min-w-0 flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-lg font-bold text-primary transition hover:-translate-y-0.5 hover:bg-primary/20"
                title="Torna alla Home di Atlas"
              >
                ←
              </Link>
              <h1 className="truncate text-2xl font-semibold text-dark dark:text-white">
                {data.sprint.label}
              </h1>

              <FilterChip label={`${totalVisible} task visibili`} />
              <FilterChip label={viewportTitle} />

              {data.sprint.statoAvanzamento ? (
                <span className="rounded-full border border-stroke bg-white/70 px-3 py-1 text-[11px] text-dark/70 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white/70">
                  Stato board: <span className="font-semibold">{data.sprint.statoAvanzamento}</span>
                </span>
              ) : null}
            </div>

            {data.sprint.description ? (
              <p className="mt-2 max-w-5xl text-sm text-dark/62 dark:text-white/62">
                {data.sprint.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:w-[820px] 2xl:grid-cols-3">
            <SectionShell eyebrow="Navigazione" title="Range timeline">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMoveViewport(-1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-white/75 text-lg font-semibold text-dark transition hover:-translate-y-0.5 hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/55 dark:text-white"
                  title="Vai indietro"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={onResetViewport}
                  className="group relative flex-1 overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(0,224,168,0.16),rgba(255,255,255,0.72))] px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,224,168,0.14)] dark:bg-[linear-gradient(135deg,rgba(0,224,168,0.18),rgba(17,24,39,0.72))]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                    Vai a oggi
                  </div>
                  <div className="mt-1 text-sm font-semibold text-dark dark:text-white">{todayLabel}</div>
                  <div className="mt-1 text-xs text-dark/55 dark:text-white/55">
                    centra il range e riallinea la board
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onMoveViewport(1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stroke bg-white/75 text-lg font-semibold text-dark transition hover:-translate-y-0.5 hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/55 dark:text-white"
                  title="Vai avanti"
                >
                  →
                </button>
              </div>
            </SectionShell>

            <SectionShell eyebrow="Vista" title="Zoom operativo">
              <div className="grid grid-cols-2 gap-2">
                {zoomOptions.map((option) => {
                  const active = zoom === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onZoomChange(option.value)}
                      className={clsx(
                        "rounded-2xl border px-3 py-2.5 text-left transition",
                        active
                          ? "border-primary/25 bg-primary text-white shadow-[0_12px_28px_rgba(0,224,168,0.18)]"
                          : "border-stroke bg-white/75 text-dark hover:-translate-y-0.5 hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/55 dark:text-white",
                      )}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div
                        className={clsx(
                          "mt-1 text-[11px]",
                          active ? "text-white/75" : "text-dark/55 dark:text-white/55",
                        )}
                      >
                        {option.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionShell>

            <SectionShell eyebrow="Azioni" title="Board controls">
              <div className="flex flex-wrap items-center gap-2">
                {onOpenScrumMaster ? (
                  <button
                    type="button"
                    onClick={onOpenScrumMaster}
                    className="inline-flex flex-1 min-w-[150px] items-center justify-center rounded-2xl border border-primary/18 bg-white/72 px-3 py-3 text-sm font-semibold text-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/10 dark:border-primary/20 dark:bg-gray-dark/55"
                  >
                    Scrum Master board
                  </button>
                ) : null}

                <SprintTimelineQuickAdd
                  onAction={(action) => {
                    if (action === "new-task") onQuickAdd();
                  }}
                  label={
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-base leading-none">
                        +
                      </span>
                      Nuovo task
                    </span>
                  }
                  title="Nuovo task rapido"
                  items={[
                    {
                      key: "new-task",
                      label: "Nuovo task rapido",
                      hint: "Crea solo titolo e descrizione nel backlog.",
                    },
                  ]}
                />
              </div>
            </SectionShell>
          </div>
        </div>

        <div className="rounded-[24px] border border-primary/12 bg-white/68 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-dark-3 dark:bg-gray-dark/45">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke/70 px-4 py-3 dark:border-dark-3/70">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/42 dark:text-white/42">
                Filtri
              </div>
              <div className="mt-1 text-sm font-semibold text-dark dark:text-white">
                Precisione operativa{activeFilterCount ? ` · ${activeFilterCount} attivi` : " · puliti"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeFilterCount ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-full border border-stroke bg-white/75 px-3 py-1.5 text-xs font-medium text-dark transition hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/55 dark:text-white"
                >
                  Reset filtri
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/15 lg:hidden"
              >
                {showFilters ? "Chiudi filtri" : "Apri filtri"}
              </button>
            </div>
          </div>

          <div className={clsx("border-t-0 px-4 py-4", showFilters ? "block" : "hidden lg:block")}>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.3fr)_220px_220px_220px_auto]">
              <div className="min-w-0">
                <input
                  value={filters.query}
                  onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
                  placeholder="Cerca task, owner, checklist, note, validatori..."
                  className={clsx(
                    "w-full rounded-2xl border border-stroke bg-white/80 px-3 py-3 text-sm text-dark shadow-sm backdrop-blur outline-none",
                    "focus:border-primary focus:ring-2 focus:ring-primary/15",
                    "dark:border-dark-3 dark:bg-gray-dark/55 dark:text-white",
                  )}
                />
              </div>

              <Select
                value={filters.signal}
                onChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    signal: value as SprintTimelineFilters["signal"],
                  })
                }
                options={signalOptions}
                placeholder="Semaforo"
              />

              <Select
                value={filters.taskType}
                onChange={(value) => onFiltersChange({ ...filters, taskType: value })}
                options={taskTypeOptions}
                placeholder="Tipo task"
              />

              <div className="rounded-2xl border border-stroke bg-white/75 px-3 py-3 dark:border-dark-3 dark:bg-gray-dark/55">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark/42 dark:text-white/42">
                  Visibilità
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, visibilityMode: "all" })}
                    className={clsx(
                      "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
                      filters.visibilityMode === "all"
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-dark/60 hover:bg-slate-200 dark:bg-white/5 dark:text-white/60",
                    )}
                  >
                    Tutti
                  </button>
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, visibilityMode: "mine" })}
                    className={clsx(
                      "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
                      filters.visibilityMode === "mine"
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-dark/60 hover:bg-slate-200 dark:bg-white/5 dark:text-white/60",
                    )}
                  >
                    Miei
                  </button>
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, visibilityMode: "reviewer" })}
                    className={clsx(
                      "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
                      filters.visibilityMode === "reviewer"
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-dark/60 hover:bg-slate-200 dark:bg-white/5 dark:text-white/60",
                    )}
                  >
                    Rev.
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/12 bg-primary/[0.05] px-3 py-3 text-sm text-dark/65 dark:text-white/65">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark/42 dark:text-white/42">
                  Stato filtri
                </div>
                <div className="mt-2">
                  {activeFilterCount ? `${activeFilterCount} filtri attivi` : "Nessun filtro attivo"}
                </div>
                <div className="mt-1 text-xs">query, semaforo, tipo task, ownership</div>
              </div>
            </div>

            {activeFilterChips.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <FilterChip key={chip} label={chip} />
                ))}
              </div>
            ) : (
              <div className="mt-3 text-xs text-dark/48 dark:text-white/48">
                Nessun filtro attivo: vedi l intera board con ordinamento automatico per criticita.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}