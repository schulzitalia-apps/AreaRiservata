import { cn } from "@/server-utils/lib/utils";

export function DeltaPill({ deltaPct, showArrow }: { deltaPct: number; showArrow?: boolean }) {
  const up = deltaPct > 0;
  const sign = deltaPct > 0 ? "+" : "";
  const v = Number.isFinite(deltaPct) ? deltaPct : 0;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold",
        up
          ? "border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-200"
          : "border-green-400/30 bg-green-500/10 text-green-700 dark:text-green-200",
      )}
    >
      {showArrow ? <span className="mr-1">{up ? "↑" : "↓"}</span> : null}
      {`${sign}${v.toFixed(0)}%`}
    </span>
  );
}
