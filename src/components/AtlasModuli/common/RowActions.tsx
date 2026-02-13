// src/components/AtlasModuli/common/RowActions.tsx
"use client";

import Link from "next/link";

interface RowActionsProps {
  viewHref?: string;
  editHref?: string;
  deleting?: boolean;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;

  // NUOVI flag lato UI
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function RowActions({
                             viewHref,
                             editHref,
                             deleting,
                             onDelete,
                             deleteLabel = "Delete",
                             canView,
                             canEdit,
                             canDelete,
                           }: RowActionsProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium " +
    "transition-all duration-150 backdrop-blur-sm " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
    "disabled:cursor-not-allowed disabled:opacity-60";

  const size =
    "w-full py-2.5 text-sm md:w-auto md:px-3 md:py-1.5 md:text-[11px]";

  const motion = "hover:scale-[1.02] hover:animate-pulse-slow active:scale-100";

  // default: se i flag non sono passati, è come prima (true)
  const showView = (canView ?? true) && !!viewHref;
  const showEdit = (canEdit ?? true) && !!editHref;
  const showDelete = (canDelete ?? true) && !!onDelete;

  return (
    <>
      {/* VIEW — verde vetroso */}
      {showView && (
        <Link
          href={viewHref!}
          className={`
            ${base} ${size} ${motion}
            border border-emerald-500/60 bg-emerald-500/8 text-emerald-500
            hover:bg-emerald-500/15 hover:ring-emerald-400/50
            hover:shadow-[0_0_18px_rgba(16,185,129,0.45)]
            focus-visible:ring-emerald-400/70
            dark:border-emerald-400/60 dark:bg-emerald-400/10 dark:text-emerald-300
            dark:hover:bg-emerald-400/20
          `}
        >
          View
        </Link>
      )}

      {/* EDIT — blu vetroso */}
      {showEdit && (
        <Link
          href={editHref!}
          className={`
            ${base} ${size} ${motion}
            border border-primary/70 bg-primary/10 text-primary
            hover:bg-primary/20 hover:ring-primary/50
            hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]
            focus-visible:ring-primary/60
            dark:border-primary/60 dark:bg-primary/20 dark:text-primary-100
            dark:hover:bg-primary/30
          `}
        >
          Edit
        </Link>
      )}

      {/* DELETE — rosso vetroso */}
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className={`
            ${base} ${size} ${motion}
            border border-red-500/70 bg-red-500/10 text-red-400
            hover:bg-red-500/20 hover:ring-red-400/60
            hover:shadow-[0_0_18px_rgba(239,68,68,0.5)]
            focus-visible:ring-red-400/70
            dark:border-red-400/70 dark:bg-red-400/15 dark:text-red-100
            dark:hover:bg-red-400/25
          `}
        >
          {deleting ? "…" : deleteLabel}
        </button>
      )}
    </>
  );
}
