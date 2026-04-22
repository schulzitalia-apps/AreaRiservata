// src/components/AtlasModuli/common/RowActions.tsx
"use client";

import { AppButton, AppLinkButton } from "@/components/ui";

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
                             deleteLabel = "Elimina",
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
    <div className="flex flex-wrap items-center gap-2">
      {/* VIEW — verde vetroso */}
      {showView && (
        <AppLinkButton
          href={viewHref!}
          variant="outline"
          tone="success"
          size="sm"
          className="w-full backdrop-blur-sm hover:scale-[1.02] active:scale-100 md:w-auto"
        >
          Apri
        </AppLinkButton>
      )}

      {/* EDIT — blu vetroso */}
      {showEdit && (
        <AppLinkButton
          href={editHref!}
          variant="outline"
          tone="primary"
          size="sm"
          className="w-full backdrop-blur-sm hover:scale-[1.02] active:scale-100 md:w-auto"
        >
          Modifica
        </AppLinkButton>
      )}

      {/* DELETE — rosso vetroso */}
      {showDelete && (
        <AppButton
          type="button"
          onClick={onDelete}
          loading={deleting}
          variant="outline"
          tone="danger"
          size="sm"
          className="w-full backdrop-blur-sm hover:scale-[1.02] active:scale-100 md:w-auto"
        >
          {deleting ? "…" : deleteLabel}
        </AppButton>
      )}
    </div>
  );
}
