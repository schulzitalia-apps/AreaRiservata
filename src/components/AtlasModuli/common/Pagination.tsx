// src/components/AtlasModuli/common/Pagination.tsx
"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;

  totalItems?: number;
  pageSize?: number;
}

function buildPageItems(page: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | string)[] = [];
  const add = (v: number | string) => items.push(v);

  const showLeftEllipsis = page > 4;
  const showRightEllipsis = page < totalPages - 3;

  add(1);

  if (showLeftEllipsis) add("left-ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  for (let p = start; p <= end; p++) add(p);

  if (showRightEllipsis) add("right-ellipsis");

  add(totalPages);

  return items.filter((item, index) => {
    if (typeof item === "number") {
      return items.indexOf(item) === index;
    }
    return true;
  });
}

export function Pagination({
                             page,
                             totalPages,
                             onPageChange,
                             totalItems,
                             pageSize,
                           }: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pageItems = useMemo(
    () => buildPageItems(page, totalPages),
    [page, totalPages],
  );

  const from =
    totalItems && pageSize
      ? (page - 1) * pageSize + 1
      : undefined;
  const to =
    totalItems && pageSize
      ? Math.min(page * pageSize, totalItems)
      : undefined;

  const handleGoTo = (p: number) => {
    if (p !== page && p >= 1 && p <= totalPages) {
      onPageChange(p);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 py-2 md:flex-row md:items-center md:justify-between">
      {/* Info pill */}
      <div className="flex items-center">
        <InfoPill tone="neutral" className="px-2.5 py-0.5 text-[10px]">
          Pagina {page} di {totalPages}
          {from && to && totalItems !== undefined && (
            <>
              {" "}
              • Mostrati {from}–{to} di {totalItems}
            </>
          )}
        </InfoPill>
      </div>

      {/* Controlli */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {/* Prev */}
        <GlowButton
          color="neutral"
          size="sm"
          className="px-2.5 py-1 text-[11px]"
          disabled={!canPrev}
          onClick={() => canPrev && handleGoTo(page - 1)}
        >
          ← Prec
        </GlowButton>

        {/* numeri pagina */}
        <div className="flex items-center gap-0.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] shadow-sm dark:bg-gray-800/90">
          {pageItems.map((item, idx) => {
            if (typeof item === "string") {
              return (
                <span
                  key={item + idx}
                  className="px-1 text-[10px] text-slate-400 dark:text-slate-500"
                >
                  …
                </span>
              );
            }

            const isCurrent = item === page;
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleGoTo(item)}
                className={clsx(
                  "min-w-[1.75rem] rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  "hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/20",
                  isCurrent
                    ? "bg-primary/20 text-primary shadow-sm dark:bg-primary/40 dark:text-primary-100"
                    : "text-slate-200",
                )}
                aria-current={isCurrent ? "page" : undefined}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Next */}
        <GlowButton
          color="neutral"
          size="sm"
          className="px-2.5 py-1 text-[11px]"
          disabled={!canNext}
          onClick={() => canNext && handleGoTo(page + 1)}
        >
          Succ →
        </GlowButton>
      </div>
    </div>
  );
}
