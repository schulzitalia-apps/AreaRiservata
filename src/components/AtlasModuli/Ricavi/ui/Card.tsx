import * as React from "react";
import { cn } from "@/server-utils/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white shadow-1 border border-stroke",
        "dark:bg-gray-dark dark:shadow-card dark:border-dark-3",
        "transition",
        "dark:shadow-[0_0_0_1px_rgba(87,80,241,0.10),0_30px_70px_rgba(0,0,0,0.55)]",
        "dark:hover:shadow-[0_0_0_1px_rgba(10,190,249,0.14),0_45px_110px_rgba(0,0,0,0.65)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
