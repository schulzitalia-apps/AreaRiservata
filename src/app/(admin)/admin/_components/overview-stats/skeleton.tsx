import { Skeleton } from "@/components/ui/skeleton";

export function OverviewStatsSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="col-span-12 xl:col-span-3">
          <div className="relative overflow-hidden rounded-[14px] bg-white p-5 shadow-1 dark:bg-gray-dark">
            <div className="flex items-center gap-4">
              <Skeleton className="h-[46px] w-[46px] rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-28" />
                <div className="mt-2 flex items-end justify-between gap-3">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
