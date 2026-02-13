"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Pagination } from "@/components/AtlasModuli/common/Pagination";

export interface Column<T> {
  id: string;
  header: ReactNode;
  className?: string;
  render: (item: T) => ReactNode;
  isMain?: boolean;
}

interface ResourceListBoxProps<T> {
  title: string;
  newHref?: string;
  newLabel?: string;

  searchPlaceholder?: string;

  query: string;
  setQuery: (v: string) => void;

  loading: boolean;
  items: T[];
  emptyMessage?: string;

  columns: Column<T>[];
  getKey: (item: T) => React.Key;

  renderActions?: (item: T) => ReactNode;

  toolbarRight?: ReactNode;
  actionsColumnClassName?: string;

  page?: number;
  totalPages?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export function ResourceListBox<T>({
                                     title,
                                     newHref,
                                     newLabel = "Nuovo",
                                     searchPlaceholder = "Cerca…",
                                     query,
                                     setQuery,
                                     loading,
                                     items,
                                     emptyMessage = "Nessun risultato",
                                     columns,
                                     getKey,
                                     renderActions,
                                     toolbarRight,
                                     actionsColumnClassName = "col-span-2 text-right",
                                     page,
                                     totalPages,
                                     pageSize,
                                     totalItems,
                                     onPageChange,
                                   }: ResourceListBoxProps<T>) {
  const hasActions = !!renderActions;
  const sortedItems = useMemo(() => items, [items]);

  const hasPagination =
    typeof page === "number" &&
    typeof totalPages === "number" &&
    totalPages > 1 &&
    typeof onPageChange === "function";

  const mainColumn = columns.find((c) => c.isMain) ?? columns[0];
  const otherColumns = columns.filter((c) => c !== mainColumn);

  return (
    <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stroke p-4 dark:border-dark-3">
        <h2 className="text-base font-semibold text-dark dark:text-white">
          {title}
        </h2>

        {newHref && (
          <Link
            href={newHref}
            className="rounded-md border border-stroke px-3 py-1.5 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            {newLabel}
          </Link>
        )}
      </div>

      {/* Search + Toolbar + Pagination */}
      <div className="border-b border-stroke p-4 dark:border-dark-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {toolbarRight && (
            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              {toolbarRight}
            </div>
          )}
        </div>

        {hasPagination && (
          <div className="mt-3">
            <Pagination
              page={page!}
              totalPages={totalPages!}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange!}
            />
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-2 dark:bg-dark-2"
              />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-dark/70 dark:text-white/70">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
            {/* Header tabella */}
            <div className="hidden grid-cols-12 gap-3 border-b border-stroke bg-gray-1 px-4 py-2 text-xs text-dark/70 dark:border-dark-3 dark:bg-dark-2 dark:text-white/70 md:grid">
              {columns.map((c) => (
                <div
                  key={c.id}
                  className={clsx("min-w-0", c.className)}
                >
                  {c.header}
                </div>
              ))}

              {hasActions && (
                <div className={clsx("min-w-0", actionsColumnClassName)}>
                  Azioni
                </div>
              )}
            </div>

            {/* Righe */}
            {sortedItems.map((item) => (
              <div
                key={getKey(item)}
                className="
                  mb-3 rounded-2xl border border-stroke bg-white px-4 py-3
                  text-sm text-dark shadow-sm hover:bg-primary/5
                  dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2/60
                  md:mb-0 md:rounded-none md:border-t md:border-x-0 md:border-b-0 md:bg-transparent md:shadow-none
                  first:md:border-t-0
                "
              >
                <div className="flex flex-col gap-3 md:grid md:grid-cols-12 md:items-center md:gap-3">
                  {/* colonna principale */}
                  <div
                    className={clsx(
                      "min-w-0",
                      mainColumn.className ?? "col-span-4",
                    )}
                  >
                    {mainColumn.render(item)}

                    {/* azioni mobile: sotto alla scheda */}
                    {hasActions && (
                      <div className="mt-3 flex flex-col gap-2 md:hidden">
                        {renderActions!(item)}
                      </div>
                    )}
                  </div>

                  {/* altre colonne: la loro responsabilità è tutta nel className */}
                  {otherColumns.map((c) => (
                    <div
                      key={c.id}
                      className={clsx("min-w-0", c.className)}
                    >
                      {c.render(item)}
                    </div>
                  ))}

                  {/* azioni desktop */}
                  {hasActions && (
                    <div
                      className={clsx(
                        "hidden md:flex justify-end gap-2 min-w-0",
                        actionsColumnClassName,
                      )}
                    >
                      {renderActions!(item)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
