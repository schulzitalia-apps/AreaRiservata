"use client";

import * as React from "react";
import { cn } from "@/server-utils/lib/utils";

export type AppScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal" | "both";
};

export const AppScrollArea = React.forwardRef<HTMLDivElement, AppScrollAreaProps>(
  ({ className, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
          orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
          orientation === "both" && "overflow-auto",
          "[scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
          "[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-gray-4/70 [&::-webkit-scrollbar-thumb]:bg-clip-content",
          "[&::-webkit-scrollbar-thumb:hover]:bg-gray-5",
          "dark:[&::-webkit-scrollbar-thumb]:bg-stroke-dark dark:[&::-webkit-scrollbar-thumb:hover]:bg-dark-3",
          className,
        )}
        {...props}
      />
    );
  },
);

AppScrollArea.displayName = "AppScrollArea";
