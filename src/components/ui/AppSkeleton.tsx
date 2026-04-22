"use client";

import { cn } from "@/server-utils/lib/utils";
import type { HTMLAttributes } from "react";

export function AppSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-2 dark:bg-dark-2",
        className,
      )}
      {...props}
    />
  );
}
