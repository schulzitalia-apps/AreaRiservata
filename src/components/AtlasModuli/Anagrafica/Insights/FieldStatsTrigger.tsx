"use client";

import { cn } from "@/server-utils/lib/utils";
import { Icons } from "@/components/AtlasModuli/common/icons";

export function FieldStatsTrigger(props: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!props.disabled) props.onClick();
      }}
      title={props.title ?? "Statistiche"}
      disabled={!!props.disabled}
      className={cn(
        "ml-2 inline-flex items-center justify-center",
        "h-7 w-7 rounded-full",
        "border border-stroke bg-white text-dark shadow-sm",
        "hover:bg-gray-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-2/80",
      )}
    >
      <Icons.PieChart className="h-4 w-4" />
    </button>
  );
}
