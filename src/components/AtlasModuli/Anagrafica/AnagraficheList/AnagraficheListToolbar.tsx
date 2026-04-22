// src/components/AtlasModuli/anagrafiche/AnagraficheList/AnagraficheListToolbar.tsx
"use client";

import clsx from "clsx";

import { AppButton, AppLinkButton, AppPagination, AppPanel, AppSelect } from "@/components/ui";
import { Select } from "@/components/ui/select";
import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";

import type { AnagraficheListConfig, SortIndex } from "./helpers";

export function AnagraficheListToolbar({
                                         def,
                                         cfg,
                                         total,
                                         loading,
                                         canCreate,
                                         type,

                                         query,
                                         searching,
                                         docType,
                                         ownerOnly,

                                         sortKey,
                                         sortDir,
                                         sortIndex,

                                         page,
                                         totalPages,
                                         pageSize,

                                         onQueryChange,
                                         onSearch,
                                         onDocTypeChange,
                                         onOwnerOnlyChange,
                                         onSortByKey,
                                         onPageChange,

                                         toolbarRight,
                                       }: {
  def: any;
  cfg: AnagraficheListConfig;
  total: number;
  loading: boolean;
  canCreate: boolean;
  type: string;

  query: string;
  searching?: boolean;
  docType: string;
  ownerOnly: boolean;

  sortKey: string;
  sortDir: "asc" | "desc";
  sortIndex: SortIndex;

  page: number;
  totalPages: number;
  pageSize: number;

  onQueryChange: (v: string) => void;
  onSearch: () => void;
  onDocTypeChange: (v: string) => void;
  onOwnerOnlyChange: (v: boolean) => void;
  onSortByKey: (k: string) => void;
  onPageChange: (p: number) => void;

  toolbarRight?: React.ReactNode;
}) {
  const variant = cfg.variant ?? "comfortable";
  const showDocType = cfg.controls?.docType ?? true;
  const visibilityMode = cfg.controls?.visibility ?? false;
  const showSortDropdown = cfg.controls?.sort ?? false;

  const sortLabel = sortKey ? sortIndex.labelByKey[sortKey] ?? sortKey : "";
  const sortArrow = sortKey ? (sortDir === "asc" ? "↑" : "↓") : "";

  const docTypeOptions: [string, string][] = (def.documentTypes ?? []).map(
    (t: string) => [t, t] as [string, string],
  );

  const densityInput = variant === "compact" ? "py-2" : "py-2.5";

  return (
    <AppPanel className="space-y-3 rounded-[18px]">
        {/* TOP ROW */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-dark dark:text-white">
                {def.label}
              </h1>

              <InfoPill tone="neutral" className="px-3 py-1 text-[11px]">
                {loading ? "Caricamento…" : `${total} risultati`}
              </InfoPill>

              {sortKey ? (
                <button
                  type="button"
                  className="group"
                  onClick={() => onSortByKey("")}
                  title="Reset ordine"
                >
                  <InfoPill
                    tone="neutral"
                    className={clsx(
                      "px-3 py-1 text-[11px]",
                      "transition-colors group-hover:bg-primary/10 dark:group-hover:bg-primary/20",
                    )}
                  >
                    Ordine: <span className="font-semibold">{sortLabel}</span>{" "}
                    <span className="font-semibold">{sortArrow}</span>{" "}
                    <span className="ml-1 opacity-60">×</span>
                  </InfoPill>
                </button>
              ) : null}

              {ownerOnly ? (
                <InfoPill tone="neutral" className="px-3 py-1 text-[11px]">
                  Solo proprietario
                </InfoPill>
              ) : null}

              {docType ? (
                <InfoPill tone="neutral" className="px-3 py-1 text-[11px]">
                  Tipo: <span className="font-semibold">{docType}</span>
                </InfoPill>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-dark/60 dark:text-white/60">
              Colonne dinamiche da config. Ordina dalle intestazioni (se supportato) o dal dropdown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {toolbarRight ? <div className="hidden sm:block">{toolbarRight}</div> : null}

            {canCreate ? (
              <AppLinkButton
                href={`/anagrafiche/${type}/new`}
                variant="outline"
                tone="neutral"
                className="font-semibold backdrop-blur-sm"
              >
                + Nuova scheda
              </AppLinkButton>
            ) : null}
          </div>
        </div>

        {/* SEARCH */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-[700px]">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark/35 dark:text-white/35">
              ⌕
            </div>
                <input
              className={clsx(
                "w-full rounded-2xl border border-stroke bg-white/70 pl-10 pr-3 text-sm text-dark shadow-sm backdrop-blur outline-none",
                "focus:border-primary focus:ring-2 focus:ring-primary/15",
                "dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white",
                densityInput,
              )}
              placeholder="Cerca…"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSearch();
                    }
                  }}
                />
              </div>

              <GlowButton
                color="neutral"
                size="sm"
                type="button"
                className="shrink-0 px-4"
                onClick={onSearch}
              >
                {searching ? "Cerca…" : "Cerca"}
              </GlowButton>
            </div>
          </div>

          {toolbarRight ? <div className="sm:hidden">{toolbarRight}</div> : null}
        </div>

        {/* FILTERS + PAGINATION */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {showDocType ? (
              <div className="w-full text-sm sm:w-64">
                <Select
                  value={docType}
                  onChange={onDocTypeChange}
                  options={docTypeOptions}
                  placeholder="Tutti i tipi"
                />
              </div>
            ) : null}

            {visibilityMode === "checkbox" ? (
              <label
                className={clsx(
                  "flex cursor-pointer select-none items-center gap-2 rounded-2xl border border-stroke bg-white/70 px-3 py-2 text-sm text-dark shadow-sm backdrop-blur",
                  "hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white dark:hover:bg-dark-2/70",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={ownerOnly}
                  onChange={(e) => onOwnerOnlyChange(e.target.checked)}
                />
                Solo proprietario
              </label>
            ) : null}

            {showSortDropdown ? (
              <div className="w-full text-sm sm:w-64">
                <AppSelect
                  value={sortKey}
                  onChange={onSortByKey}
                  options={sortIndex.options.map(([value, label]) => ({ value, label }))}
                />
              </div>
            ) : null}
          </div>

          {totalPages > 1 ? (
            <div className="rounded-2xl bg-white/60 p-1.5 shadow-sm backdrop-blur dark:bg-gray-dark/40">
              <AppPagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={onPageChange}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between sm:hidden">
          <AppButton
            variant="outline"
            tone="neutral"
            size="sm"
            className="backdrop-blur-sm"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑ Torna su
          </AppButton>
        </div>
    </AppPanel>
  );
}
