"use client";

import { useMemo } from "react";
import { AppBadge } from "./AppBadge";
import { AppButton } from "./AppButton";

export type AppPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
};

function buildPageItems(page: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: (number | string)[] = [1];
  if (page > 4) items.push("left-ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  for (let value = start; value <= end; value += 1) {
    items.push(value);
  }

  if (page < totalPages - 3) items.push("right-ellipsis");
  items.push(totalPages);

  return items.filter((item, index) =>
    typeof item === "number" ? items.indexOf(item) === index : true,
  );
}

export function AppPagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: AppPaginationProps) {
  const pageItems = useMemo(
    () => buildPageItems(page, totalPages),
    [page, totalPages],
  );

  const from =
    totalItems && pageSize ? (page - 1) * pageSize + 1 : undefined;
  const to =
    totalItems && pageSize ? Math.min(page * pageSize, totalItems) : undefined;

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <AppBadge tone="neutral" size="sm">
        Pagina {page} di {totalPages}
        {from && to && totalItems ? ` • ${from}-${to} di ${totalItems}` : ""}
      </AppBadge>

      <div className="flex flex-wrap items-center gap-2">
        <AppButton
          variant="outline"
          tone="neutral"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prec
        </AppButton>

        <div className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 dark:bg-gray-dark/70">
          {pageItems.map((item, index) =>
            typeof item === "string" ? (
              <span
                key={`${item}-${index}`}
                className="px-1 text-xs text-dark/45 dark:text-white/45"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={[
                  "min-w-[28px] rounded-full px-2 py-1 text-xs font-medium transition-colors",
                  item === page
                    ? "bg-primary/15 text-primary"
                    : "text-dark/70 hover:bg-primary/10 hover:text-primary dark:text-white/70 dark:hover:bg-primary/15",
                ].join(" ")}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <AppButton
          variant="outline"
          tone="neutral"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Succ
        </AppButton>
      </div>
    </div>
  );
}
