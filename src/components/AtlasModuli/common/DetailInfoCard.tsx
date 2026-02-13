"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";
import { FloatingSection } from "@/components/Layouts/FloatingSection";

export interface DetailField {
  id: string;
  label: ReactNode;
  value: ReactNode;
  className?: string;

  /** ✅ opzionale: rende il campo cliccabile */
  onClick?: () => void;
  clickable?: boolean;
}

export type DetailCardHeaderVariant = "cover-avatar" | "avatar-only" | "none";
export type DetailCardAvatarSize = "small" | "medium" | "large";

interface DetailInfoCardProps {
  title: ReactNode;
  pills?: ReactNode;

  backHref: string;
  editHref?: string;

  canEdit?: boolean;

  loading?: boolean;
  fields: DetailField[];

  gridClassName?: string;
  skeletonRows?: number;

  coverSrc?: string;
  avatarSrc?: string;

  headerActions?: ReactNode;

  headerVariant?: DetailCardHeaderVariant;
  avatarSize?: DetailCardAvatarSize;
  hoverEffect?: boolean;
}

function nodeToText(n: ReactNode): string | null {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) {
    const parts = n
      .map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : ""))
      .join("")
      .trim();
    return parts ? parts : null;
  }
  return null;
}

function isMultilineText(s: string) {
  return s.includes("\n") || s.length > 80;
}

function computeLayout(label: ReactNode, value: ReactNode) {
  const labelText = nodeToText(label);
  const valueText = nodeToText(value);

  const canInline =
    labelText !== null &&
    valueText !== null &&
    !isMultilineText(valueText) &&
    labelText.length <= 28 &&
    valueText.length <= 32 &&
    labelText.length + valueText.length <= 52;

  const isLong = valueText !== null && (isMultilineText(valueText) || valueText.length >= 70);

  const shouldSpanTwo = isLong;
  const isOneLine = canInline;

  return { canInline, shouldSpanTwo, isOneLine, isLong, labelText, valueText };
}

/**
 * ✅ Simula il piazzamento in griglia 2-colonne (md) e decide
 * quali item (span=1) rimangono davvero “orfani” sulla riga.
 */
function computeSolitaryIn2ColGrid(spans: number[]) {
  const solitary = Array(spans.length).fill(false);

  let col = 0; // 0 = sinistra, 1 = destra

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const nextSpan = i + 1 < spans.length ? spans[i + 1] : 0;

    if (span === 2) {
      if (col === 1) col = 0;
      col = 0;
      continue;
    }

    const startCol = col;

    if (col === 0) col = 1;
    else col = 0;

    if (startCol === 0) {
      const last = i === spans.length - 1;
      const nextIsSpanTwo = nextSpan === 2;

      if (last || nextIsSpanTwo) {
        solitary[i] = true;
      }
    }
  }

  return solitary;
}

export function DetailInfoCard({
                                 title,
                                 pills,
                                 backHref,
                                 editHref,
                                 canEdit = true,
                                 loading = false,
                                 fields,
                                 gridClassName = "grid grid-cols-1 gap-3 md:grid-cols-2",
                                 skeletonRows = 6,
                                 coverSrc = "/images/cover/cover-04.png",
                                 avatarSrc = "/images/user/user-02.png",
                                 headerActions,
                                 headerVariant = "cover-avatar",
                                 avatarSize = "medium",
                                 hoverEffect = true,
                               }: DetailInfoCardProps) {
  const layouts = fields.map((f) => computeLayout(f.label, f.value));
  const spans = layouts.map((l) => (l.shouldSpanTwo ? 2 : 1));

  const solitary = computeSolitaryIn2ColGrid(spans);

  return (
    <FloatingSection
      coverSrc={coverSrc}
      avatarSrc={avatarSrc}
      title={title}
      subtitle={
        pills && (
          <div className="flex flex-wrap justify-center gap-2 text-xs">{pills}</div>
        )
      }
      headerVariant={headerVariant}
      avatarSize={avatarSize}
      hoverEffect={hoverEffect}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="
            rounded-lg border border-stroke px-4 py-2 text-sm text-dark
            hover:bg-gray-2
            dark:border-dark-3 dark:text-white dark:hover:bg-dark-2
          "
        >
          Indietro
        </Link>

        {headerActions && <div className="flex flex-1 justify-center">{headerActions}</div>}

        {canEdit && editHref && (
          <Link
            href={editHref}
            className="
              rounded-lg border border-stroke px-4 py-2 text-sm
              text-dark hover:bg-gray-2
              dark:border-dark-3 dark:text-white dark:hover:bg-dark-2
            "
          >
            Modifica
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div
              key={i}
              className="h-[64px] md:h-[72px] animate-pulse rounded bg-gray-2 dark:bg-dark-2"
            />
          ))}
        </div>
      ) : (
        <div className={gridClassName}>
          {fields.map((f, idx) => {
            const l = layouts[idx];
            const isSolitary = solitary[idx] && spans[idx] === 1;

            const preserveNewlines = l.isLong && Boolean(l.valueText && l.valueText.includes("\n"));

            const clickable = !!(f.clickable && f.onClick);

            return (
              <div
                key={f.id}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? f.onClick : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                      if (e.key === "Enter" || e.key === " ") f.onClick?.();
                    }
                    : undefined
                }
                className={clsx(
                  "rounded-lg border border-stroke text-dark dark:border-dark-3 dark:text-white",
                  "px-3 py-2 md:px-4 md:py-2.5",

                  l.isLong ? "h-auto min-h-[64px] md:min-h-[72px]" : "h-[64px] md:h-[72px]",

                  "transition-all duration-200",
                  "hover:border-emerald-400/95 dark:hover:border-emerald-300/95",
                  "hover:bg-emerald-500/[0.10] dark:hover:bg-emerald-400/[0.12]",
                  "hover:shadow-[0_0_0_1px_rgba(16,185,129,0.75),0_0_44px_rgba(16,185,129,0.42)]",
                  "focus-within:border-emerald-400 dark:focus-within:border-emerald-300",
                  "focus-within:shadow-[0_0_0_1px_rgba(16,185,129,0.85),0_0_52px_rgba(16,185,129,0.48)]",

                  l.shouldSpanTwo ? "md:col-span-2" : undefined,
                  isSolitary ? "md:col-span-2 md:w-1/2 md:mx-auto w-full" : undefined,

                  clickable && "cursor-pointer select-none",
                  f.className,
                )}
              >
                <div className={clsx("grid h-full place-items-center", l.isLong && "py-2")}>
                  <div className="w-full max-w-[92%] overflow-hidden">
                    {l.canInline ? (
                      <div className="flex items-center justify-center gap-3 leading-none">
                        <div
                          className={clsx(
                            "min-w-0 text-center break-words",
                            "line-clamp-2 [font-size:clamp(11px,3.2vw,14px)] md:[font-size:14px]",
                            l.isOneLine ? "text-dark/65 dark:text-white/65" : "text-dark/60 dark:text-white/60",
                          )}
                        >
                          {f.label}
                        </div>

                        <span className="select-none text-dark/35 dark:text-white/30">|</span>

                        <div
                          className={clsx(
                            "min-w-0 text-center break-words",
                            "line-clamp-2 [font-size:clamp(13px,4.2vw,18px)] md:[font-size:20px]",
                            l.isOneLine ? "font-semibold drop-shadow-[0_0_14px_rgba(16,185,129,0.34)]" : "font-medium",
                          )}
                        >
                          {f.value}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center leading-tight">
                        <div
                          className={clsx(
                            "break-words text-dark/60 dark:text-white/60",
                            "line-clamp-2 [font-size:clamp(10px,3.0vw,12px)] md:text-xs",
                          )}
                        >
                          {f.label}
                        </div>

                        <div
                          className={clsx(
                            "font-medium break-words",
                            preserveNewlines ? "whitespace-pre-wrap" : "whitespace-normal line-clamp-3",
                            "[font-size:clamp(12px,3.6vw,14px)] md:text-sm",
                          )}
                        >
                          {f.value}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FloatingSection>
  );
}
