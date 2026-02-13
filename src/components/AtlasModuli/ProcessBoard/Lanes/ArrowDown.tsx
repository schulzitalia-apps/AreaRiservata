"use client";

import { cn } from "@/server-utils/lib/utils";

type Props = {
  className?: string;
  h?: number;
};

export default function ArrowDown({ className, h = 34 }: Props) {
  const height = Math.max(18, h);

  return (
    <div className={cn("flex items-center justify-center", className)} aria-hidden="true">
      <svg width="22" height={height} viewBox={`0 0 22 ${height}`} fill="none">
        {/* linea tratteggiata */}
        <path
          d={`M11 2 V ${height - 10}`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 5"
          opacity="0.9"
        />
        {/* freccia SOLO in fondo */}
        <path
          d={`M6 ${height - 12} L11 ${height - 6} L16 ${height - 12}`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}
