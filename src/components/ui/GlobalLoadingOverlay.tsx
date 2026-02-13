"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/components/Store/hooks";
import { selectGlobalLoading } from "@/components/Store/slices/uiSlice";

export default function GlobalLoadingOverlay() {
  const loading = useAppSelector(selectGlobalLoading);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (t: number) => {
      const elapsed = t - start;
      const ease = 1 - Math.exp(-elapsed / 520);
      const target = 92 * ease;

      setProgress((prev) => Math.max(prev, Math.min(target, prev + 2.2)));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] grid place-items-center px-4 pointer-events-auto"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Backdrop: in light bianco, in dark usa dark.DEFAULT */}
      <div className="absolute inset-0 bg-white dark:bg-dark shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.55)]" />

      {/* Ambient glow: solo token ESISTENTI (primary/green/blue) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
        <div className="absolute bottom-6 left-6 h-80 w-80 rounded-full bg-blue-light/10 blur-[110px]" />
        <div className="absolute -bottom-10 right-0 h-96 w-96 rounded-full bg-green-light-2/14 blur-[120px]" />
      </div>

      {/* Grain */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.09] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22300%22%20height=%22300%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.9%22%20numOctaves=%222%22%20stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect%20width=%22300%22%20height=%22300%22%20filter=%22url(%23n)%22%20opacity=%220.55%22/%3E%3C/svg%3E')]" />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-gray-2/70 dark:border-dark-2/40 bg-white/80 dark:bg-dark-4/70 shadow-card-6 backdrop-blur-xl p-6 sm:p-7 animate-[overlayIn_160ms_cubic-bezier(0.16,1,0.3,1)_both]">
        {/* Glow border: primary (esiste) */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/25 via-transparent to-blue-light/20 opacity-70 blur-[12px]" />

        <div className="relative">
          <div className="text-[16px] font-extrabold tracking-wide text-dark dark:text-dark-5">
            Caricamento…
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-6 dark:text-gray-5">
            Sto aggiornando i dati, un attimo.
          </div>

          {/* Barra unica */}
          <div className="mt-5">
            <div className="relative overflow-hidden rounded-2xl h-5 sm:h-6 bg-gray-2/70 dark:bg-dark-8/70 ring-1 ring-inset ring-gray-2/60 dark:ring-dark-2/40">
              {/* riempimento: gradient SOLO con colori esistenti */}
              <div
                className="h-full rounded-2xl bg-[linear-gradient(90deg,theme(colors.primary),theme(colors.blue.light.DEFAULT),theme(colors.primary))] shadow-[0_0_22px_rgba(255,0,0,0.18)] dark:shadow-[0_0_28px_rgba(255,0,0,0.22)] transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />

              {/* sheen */}
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute inset-y-0 w-1/2 animate-[sheen_1.15s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] dark:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
              </div>

              {/* highlight interno */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]" />
            </div>

            {/* percentuale (opzionale ma carina) */}
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-gray-6 dark:text-gray-5">
              <span>Avanzamento</span>
              <span>{Math.floor(progress)}%</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
          @keyframes overlayIn {
              from {
                  opacity: 0;
                  transform: translateY(10px) scale(0.985);
                  filter: blur(6px);
              }
              to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                  filter: blur(0);
              }
          }
          @keyframes sheen {
              0% {
                  transform: translateX(-120%);
              }
              50% {
                  transform: translateX(40%);
              }
              100% {
                  transform: translateX(220%);
              }
          }
      `}</style>
    </div>
  );
}
