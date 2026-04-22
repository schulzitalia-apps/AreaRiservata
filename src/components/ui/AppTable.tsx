"use client";

import { cn } from "@/server-utils/lib/utils";
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function AppTable({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
      <div className="relative w-full overflow-auto">
        <table
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  );
}

export function AppTableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-gray-2/70 dark:bg-dark-2/70 [&_tr]:border-b [&_tr]:border-stroke dark:[&_tr]:border-dark-3",
        className,
      )}
      {...props}
    />
  );
}

export function AppTableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function AppTableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-stroke transition-colors hover:bg-primary/5 dark:border-dark-3 dark:hover:bg-dark-2/70",
        className,
      )}
      {...props}
    />
  );
}

export function AppTableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-dark/60 dark:text-white/60",
        className,
      )}
      {...props}
    />
  );
}

export function AppTableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-dark dark:text-white", className)}
      {...props}
    />
  );
}
