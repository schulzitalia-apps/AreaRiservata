"use client";

import { AppButton } from "./AppButton";
import { AppLinkButton } from "./AppLinkButton";

export type AppActionRowProps = {
  viewHref?: string;
  editHref?: string;
  onDelete?: () => void;
  deleting?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function AppActionRow({
  viewHref,
  editHref,
  onDelete,
  deleting,
  canView = true,
  canEdit = true,
  canDelete = true,
}: AppActionRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canView && viewHref ? (
        <AppLinkButton href={viewHref} variant="outline" tone="success" size="sm">
          Apri
        </AppLinkButton>
      ) : null}
      {canEdit && editHref ? (
        <AppLinkButton href={editHref} variant="outline" tone="primary" size="sm">
          Modifica
        </AppLinkButton>
      ) : null}
      {canDelete && onDelete ? (
        <AppButton
          variant="outline"
          tone="danger"
          size="sm"
          onClick={onDelete}
          loading={deleting}
        >
          Elimina
        </AppButton>
      ) : null}
    </div>
  );
}
