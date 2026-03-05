import { cn } from "@/server-utils/lib/utils";
import type { CatKey } from "./types";

export function CategoryTabs(props: {
  value: CatKey;
  onChange: (k: CatKey) => void;
  items: { key: CatKey; label: string; color?: string }[];
}) {
  const { value, onChange, items } = props;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => {
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
            title={t.label}
          >
            <span className="inline-flex items-center gap-2">
              {t.key !== "all" ? (
                <span className="h-2 w-2 rounded-full" style={{ background: t.color || "#5750F1" }} />
              ) : null}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}