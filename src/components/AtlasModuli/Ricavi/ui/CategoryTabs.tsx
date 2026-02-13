import { cn } from "@/server-utils/lib/utils";
import type { CategoryKey } from "../types";
import { CATEGORY_TABS } from "../mock";

export function CategoryTabs({ value, onChange }: { value: CategoryKey; onChange: (k: CategoryKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_TABS.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-extrabold transition",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              active
                ? "border-primary/50 bg-primary/10 text-primary dark:border-primary/60 dark:bg-primary/15 dark:text-primary"
                : "border-stroke bg-white/70 text-gray-700 hover:bg-white dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/70 dark:hover:bg-gray-dark/70",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
