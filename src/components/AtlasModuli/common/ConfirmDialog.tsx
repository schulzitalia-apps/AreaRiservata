// src/components/AtlasModuli/common/ConfirmDialog.tsx
"use client";

import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
                                open,
                                title = "Sei sicuro?",
                                description,
                                confirmLabel = "Conferma",
                                cancelLabel = "Annulla",
                                loading,
                                onConfirm,
                                onCancel,
                              }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/40 backdrop-blur-sm
      "
    >
      <div
        className="
          mx-4 w-full max-w-md
          rounded-2xl
          border backdrop-blur-xl shadow-xl

          /* LIGHT THEME GLASS */
          bg-white/80 border-slate-200 text-slate-900 shadow-black/10

          /* DARK THEME GLASS */
          dark:bg-gray-900/40 dark:border-white/10 dark:text-white dark:shadow-black/40

          p-6 transition-all duration-200
        "
      >
        {/* Title */}
        <h2 className="text-lg font-semibold text-center">
          {title}
        </h2>

        {/* Description */}
        {description && (
          <div
            className="
              mt-3 text-sm
              text-slate-700 dark:text-gray-300
              text-center leading-relaxed
            "
          >
            {description}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="
              inline-flex items-center justify-center
              rounded-lg border px-4 py-2
              text-sm font-medium transition-all duration-150

              /* Light theme */
              border-slate-300 bg-white/70 text-slate-800
              hover:bg-white/90

              /* Dark theme */
              dark:border-white/20 dark:bg-white/10 dark:text-white
              dark:hover:bg-white/20

              disabled:opacity-60
            "
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="
              inline-flex items-center justify-center
              rounded-lg px-4 py-2 text-sm font-medium
              bg-red-500 text-white hover:bg-red-600
              shadow-sm transition-all duration-150
              disabled:opacity-60
            "
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
