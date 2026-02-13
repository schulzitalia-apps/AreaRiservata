import { Skeleton } from "@/components/ui/skeleton";

export function OverviewCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark"
        >
          <div className="flex flex-col items-center">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="mt-5 h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-20" />
            <Skeleton className="mt-4 h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
