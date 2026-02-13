import { cn } from "@/server-utils/lib/utils";
import Link from "next/link";
import type { JSX, SVGProps } from "react";

type PropsType = {
  label: string;
  actionLabel: string;
  href?: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;

  /**
   * Colore “acqua” (tailwind)
   * Esempi:
   * - "bg-sky-500/25 dark:bg-sky-400/22"
   * - "bg-violet-500/25 dark:bg-violet-400/22"
   */
  fillClassName?: string;

  className?: string;
};

export function OverviewCard({
                               label,
                               actionLabel,
                               href,
                               Icon,
                               fillClassName = "bg-slate-900/10 dark:bg-white/10",
                               className,
                             }: PropsType) {
  const CardInner = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[18px] bg-white p-6",
        "border border-slate-200/70 shadow-[0_10px_25px_rgba(15,23,42,0.06)]",
        "transition-all duration-200",
        "hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]",
        "dark:bg-gray-dark dark:border-white/10",
        className,
      )}
    >
      {/* ✅ WATER FILL: sale dal basso */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          "origin-bottom scale-y-0 transform",
          // più lento e percepibile
          "transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)]",
          "group-hover:scale-y-100",
          fillClassName,
        )}
      />

      {/* ✅ WAVE: una banda morbida che “galleggia” sopra il livello dell’acqua */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 right-0 z-0",
          // altezza della wave
          "h-12",
          // parte in basso (quando vuoto) e sale con l’hover
          "bottom-0 translate-y-10 opacity-0",
          // colore wave: un highlight più chiaro sopra il fill
          "bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,255,255,0.55),transparent_60%)]",
          "dark:bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,255,255,0.22),transparent_60%)]",
          // animazione salita
          "transition-all duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)]",
          "group-hover:bottom-[58%] group-hover:translate-y-0 group-hover:opacity-100",
        )}
      />

      {/* contenuto sopra l’acqua */}
      <div className="relative z-10 flex min-h-[150px] flex-col items-center justify-center text-center">
        <div className="text-slate-900 dark:text-white">
          <Icon className="h-[54px] w-[54px]" />
        </div>

        <p className="mt-4 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">
          {actionLabel}
        </p>

        <span className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {label}
        </span>

        {href ? (
          <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-900/80 transition-opacity duration-200 group-hover:text-slate-900 dark:text-white/80 dark:group-hover:text-white">
            Apri <span aria-hidden>→</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="group block focus:outline-none">
      {CardInner}
    </Link>
  ) : (
    <div className="group block">{CardInner}</div>
  );
}
