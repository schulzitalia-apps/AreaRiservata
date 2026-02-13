"use client";

import { useId, useMemo } from "react";
import { cn } from "@/server-utils/lib/utils";
import type { BilancioGaugeProps } from "./types";
import { arcPath, clamp, pctToArcDeg, polar } from "./geometry";
import { signedEuro } from "./format";

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "").trim();
  const is3 = /^[0-9a-f]{3}$/i.test(h);
  const is6 = /^[0-9a-f]{6}$/i.test(h);
  if (!is3 && !is6) return `rgba(255,255,255,${alpha})`;

  const full = is3
    ? h
      .split("")
      .map((c) => c + c)
      .join("")
    : h;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}

function TrendArrow({ direction, color }: { direction: "up" | "down"; color: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8 shrink-0", direction === "down" && "rotate-180")}
      style={{ filter: `drop-shadow(0 0 10px ${hexToRgba(color, 0.45)})` }}
      aria-hidden="true"
    >
      <path
        d="M4 22 L13 13 L19 19 L28 10"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d="M20 10 H28 V18"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
}

/**
 * Tachimetro puro (solo gauge) — da usare dentro Card/Grid.
 */
export function BilancioTachimetro({
                                     periodLabel,
                                     data,
                                     className,

                                     goodFrom = "#16A34A",
                                     goodTo = "#22D3EE",
                                     badFrom = "#7F1D1D",
                                     badTo = "#EF4444",
                                   }: BilancioGaugeProps) {
  const profit = Math.round(Number(data.profit || 0));
  const isProfit = (typeof data.isProfit === "boolean" ? data.isProfit : profit >= 0) && profit >= 0;

  const rawPct = Math.max(0, Number(data.relativePct) || 0);
  const pctLabel =
    data.relativePctLabel && data.relativePctLabel.trim().length > 0
      ? data.relativePctLabel
      : `${Math.round(rawPct * 100)}%`;

  // arco saturato a 0..1 (label può essere >100%)
  const arcPct01 = clamp(rawPct, 0, 1);

  const profitColor = isProfit ? goodFrom : badTo;
  const arrowDir: "up" | "down" = isProfit ? "up" : "down";
  const arrowColor = isProfit ? goodTo : badTo;

  // ---- SVG gauge ----
  const V = 460;
  const cx = V / 2;
  const cy = V / 2;

  const r = 170;
  const stroke = 30;

  // Split in alto + gap in basso
  const TOP = -90;
  const SPLIT_GAP = 14;
  const BOTTOM_GAP = 56;

  const RIGHT_START = TOP + SPLIT_GAP / 2;
  const RIGHT_END = 90 - BOTTOM_GAP / 2;

  const LEFT_START = TOP - SPLIT_GAP / 2;
  const LEFT_END = (90 + BOTTOM_GAP / 2) - 360;

  const rightTrack = arcPath(cx, cy, r, RIGHT_START, RIGHT_END);
  const leftTrack = arcPath(cx, cy, r, LEFT_START, LEFT_END);

  const rightStartPt = polar(cx, cy, r, RIGHT_START);
  const rightEndPt = polar(cx, cy, r, RIGHT_END);

  const leftStartPt = polar(cx, cy, r, LEFT_START);
  const leftEndPt = polar(cx, cy, r, LEFT_END);

  const rightProgress = isProfit ? arcPct01 : 0;
  const leftProgress = !isProfit ? arcPct01 : 0;

  const activeAngle = isProfit
    ? pctToArcDeg(arcPct01, RIGHT_START, RIGHT_END)
    : pctToArcDeg(arcPct01, LEFT_START, LEFT_END);

  const uid = useId().replace(/:/g, "");
  const ids = useMemo(() => {
    return {
      arcGlow: `arc-glow-${uid}`,
      knobGlow: `knob-glow-${uid}`,

      gradGoodDim: `grad-good-dim-${uid}`,
      gradBadDim: `grad-bad-dim-${uid}`,

      gradGoodActive: `grad-good-active-${uid}`,
      gradBadActive: `grad-bad-active-${uid}`,

      innerRadial: `inner-radial-${uid}`,
    };
  }, [uid]);

  return (
    <div className={cn("relative aspect-square w-full", className)}>
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-70"
        style={{
          background: `
            radial-gradient(circle at 50% 20%, ${hexToRgba(goodTo, 0.18)} 0%, transparent 60%),
            radial-gradient(circle at 30% 86%, ${hexToRgba(badTo, 0.14)} 0%, transparent 62%),
            radial-gradient(circle at 78% 86%, ${hexToRgba(goodFrom, 0.16)} 0%, transparent 62%)
          `,
        }}
      />

      <svg viewBox={`0 0 ${V} ${V}`} className="h-full w-full">
        <defs>
          <filter id={ids.arcGlow} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={ids.knobGlow} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id={ids.innerRadial} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor={hexToRgba("#FFFFFF", 0.08)} />
            <stop offset="40%" stopColor={hexToRgba("#FFFFFF", 0.04)} />
            <stop offset="100%" stopColor={hexToRgba("#000000", 0)} />
          </radialGradient>

          {/* tracks dim */}
          <linearGradient
            id={ids.gradGoodDim}
            gradientUnits="userSpaceOnUse"
            x1={rightStartPt.x}
            y1={rightStartPt.y}
            x2={rightEndPt.x}
            y2={rightEndPt.y}
          >
            <stop offset="0%" stopColor={goodFrom} stopOpacity="0.18" />
            <stop offset="100%" stopColor={goodTo} stopOpacity="0.18" />
          </linearGradient>

          <linearGradient
            id={ids.gradBadDim}
            gradientUnits="userSpaceOnUse"
            x1={leftStartPt.x}
            y1={leftStartPt.y}
            x2={leftEndPt.x}
            y2={leftEndPt.y}
          >
            <stop offset="0%" stopColor={badFrom} stopOpacity="0.18" />
            <stop offset="100%" stopColor={badTo} stopOpacity="0.18" />
          </linearGradient>

          {/* ACTIVE gradients: sfumato “mano a mano” */}
          <linearGradient
            id={ids.gradGoodActive}
            gradientUnits="userSpaceOnUse"
            x1={rightStartPt.x}
            y1={rightStartPt.y}
            x2={rightEndPt.x}
            y2={rightEndPt.y}
          >
            <stop offset="0%" stopColor={goodFrom} stopOpacity="0.10" />
            <stop offset="45%" stopColor={goodFrom} stopOpacity="0.55" />
            <stop offset="78%" stopColor={goodTo} stopOpacity="0.92" />
            <stop offset="100%" stopColor={goodTo} stopOpacity="1" />
          </linearGradient>

          <linearGradient
            id={ids.gradBadActive}
            gradientUnits="userSpaceOnUse"
            x1={leftStartPt.x}
            y1={leftStartPt.y}
            x2={leftEndPt.x}
            y2={leftEndPt.y}
          >
            <stop offset="0%" stopColor={badFrom} stopOpacity="0.10" />
            <stop offset="45%" stopColor={badFrom} stopOpacity="0.55" />
            <stop offset="78%" stopColor={badTo} stopOpacity="0.92" />
            <stop offset="100%" stopColor={badTo} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* inner disc */}
        <circle cx={cx} cy={cy} r={r - stroke * 0.65} fill={`url(#${ids.innerRadial})`} />

        {/* TRACKS */}
        <path
          d={rightTrack}
          stroke={`url(#${ids.gradGoodDim})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={leftTrack}
          stroke={`url(#${ids.gradBadDim})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />

        {/* ACTIVE: glow wide */}
        <path
          d={rightTrack}
          stroke={`url(#${ids.gradGoodActive})`}
          strokeWidth={stroke + 14}
          strokeLinecap="round"
          fill="none"
          opacity={isProfit ? 0.24 : 0}
          pathLength={100}
          strokeDasharray={`${rightProgress * 100} 100`}
          style={{
            transition: "opacity 320ms ease, stroke-dasharray 950ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <path
          d={leftTrack}
          stroke={`url(#${ids.gradBadActive})`}
          strokeWidth={stroke + 14}
          strokeLinecap="round"
          fill="none"
          opacity={!isProfit ? 0.24 : 0}
          pathLength={100}
          strokeDasharray={`${leftProgress * 100} 100`}
          style={{
            transition: "opacity 320ms ease, stroke-dasharray 950ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* ACTIVE: main */}
        <path
          d={rightTrack}
          stroke={`url(#${ids.gradGoodActive})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${ids.arcGlow})`}
          opacity={isProfit ? 1 : 0}
          pathLength={100}
          strokeDasharray={`${rightProgress * 100} 100`}
          style={{
            transition: "opacity 320ms ease, stroke-dasharray 950ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <path
          d={leftTrack}
          stroke={`url(#${ids.gradBadActive})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${ids.arcGlow})`}
          opacity={!isProfit ? 1 : 0}
          pathLength={100}
          strokeDasharray={`${leftProgress * 100} 100`}
          style={{
            transition: "opacity 320ms ease, stroke-dasharray 950ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* KNOB */}
        <g
          filter={`url(#${ids.knobGlow})`}
          style={{
            opacity: arcPct01 > 0.002 ? 1 : 0,
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${activeAngle}deg)`,
            transition: "opacity 220ms ease, transform 950ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <circle
            cx={cx + r}
            cy={cy}
            r={26}
            fill={isProfit ? hexToRgba(goodTo, 0.22) : hexToRgba(badTo, 0.22)}
          />
          <circle cx={cx + r} cy={cy} r={11} fill="#FFFFFF" opacity={0.92} />
        </g>
      </svg>

      {/* CENTER TEXT */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-3">
          <TrendArrow direction={arrowDir} color={arrowColor} />
          <div className="text-6xl font-black leading-none text-white md:text-7xl">
            {pctLabel}
          </div>
        </div>

        <div
          className="mt-3 text-3xl font-extrabold md:text-4xl"
          style={{ color: profitColor, textShadow: `0 0 16px ${hexToRgba(profitColor, 0.25)}` }}
        >
          {signedEuro(profit)}
        </div>

        <div className="mt-2 text-sm font-semibold text-white/60 md:text-base">{periodLabel}</div>
      </div>
    </div>
  );
}
