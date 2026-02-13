"use client";

import { cn } from "@/server-utils/lib/utils";
import type { Notice } from "../types";

export default function InlineAlert({
                                      notice,
                                      onClose,
                                    }: {
  notice: Notice;
  onClose: () => void;
}) {
  if (!notice) return null;

  const klass =
    notice.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      : notice.type === "error"
        ? "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", klass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{notice.text}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
