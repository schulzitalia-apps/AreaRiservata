"use client";

import type { Notice } from "../types";

export default function InlineAlert({
                                      notice,
                                      onClose,
                                    }: {
  notice: Notice;
  onClose: () => void;
}) {
  if (!notice) return null;

  const tone =
    notice.type === "success"
      ? "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-100"
      : notice.type === "error"
        ? "bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-100"
        : "bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-100";

  const icon =
    notice.type === "success" ? "✔️" : notice.type === "error" ? "⚠️" : "ℹ️";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 ${tone}`}
    >
      <span className="mt-0.5">{icon}</span>
      <p className="text-sm leading-5">{notice.text}</p>
      <button
        onClick={onClose}
        className="ml-auto rounded px-1.5 text-xs hover:opacity-80"
        aria-label="Chiudi notifica"
      >
        ✕
      </button>
    </div>
  );
}
