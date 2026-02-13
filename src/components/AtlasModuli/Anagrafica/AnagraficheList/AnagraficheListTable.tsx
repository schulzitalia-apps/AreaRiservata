"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { deleteAnagrafica } from "@/components/Store/slices/anagraficheSlice";

import { VisibilityBadge } from "@/components/AtlasModuli/common/VisibilityBadge";
import { RowActions } from "@/components/AtlasModuli/common/RowActions";
import { ConfirmDialog } from "@/components/AtlasModuli/common/ConfirmDialog";
import { ReferencePill } from "@/components/AtlasModuli/common/ReferencePreviewCell";

import { isReferenceField, type FieldDef, type FieldKey } from "@/config/anagrafiche.fields.catalog";

import { RowHoverPreview } from "./RowHoverPreview";
import {
  formatDateTime,
  formatFieldValue,
  normalizeHoverPreview,
  type AnagraficheListConfig,
  type SortIndex,
} from "./helpers";

export function AnagraficheListTable({
                                       type,
                                       def,
                                       cfg,
                                       items,
                                       loading,
                                       emptyMessage,

                                       titleKeys,
                                       subtitleKeys,
                                       columnKeys,

                                       showVisibilityColumn,

                                       sortKey,
                                       sortDir,
                                       sortIndex,
                                       onSortByKey,

                                       referencePillKeys,
                                       referenceLabelsByField,

                                       dispatch,
                                       canView,
                                       canEdit,
                                       canDelete,
                                     }: {
  type: string;
  def: any;
  cfg: AnagraficheListConfig;
  items: AnagraficaPreview[];
  loading: boolean;
  emptyMessage: string;

  titleKeys: FieldKey[];
  subtitleKeys: FieldKey[];
  columnKeys: FieldKey[];

  showVisibilityColumn: boolean;

  sortKey: string;
  sortDir: "asc" | "desc";
  sortIndex: SortIndex;
  onSortByKey: (k: string) => void;

  referencePillKeys: FieldKey[];
  referenceLabelsByField: Record<string, Record<string, string | null>>;

  dispatch: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const variant = cfg.variant ?? "comfortable";
  const showOwner = cfg.main?.showOwner ?? true;
  const showDate = cfg.main?.showDate ?? "updatedOrCreated";

  // ✅ HOOKS QUI (prima di qualunque return)
  const hp = normalizeHoverPreview(cfg);
  const hoverEnabled = hp.enabled && hp.keys.length > 0;
  const hoverTitle = hp.enabled ? hp.title ?? "Anteprima" : "Anteprima";
  const hoverKeys: FieldKey[] = hp.enabled ? hp.keys : [];

  // ✅ colonne comprimibili: niente minWidth e niente overflow-x-auto
  const gridTemplateColumns = useMemo(() => {
    const cols: string[] = [];
    cols.push("minmax(260px, 2.2fr)"); // Scheda
    cols.push(...columnKeys.map(() => "minmax(0, 1fr)")); // colonne (comprimibili)
    if (showVisibilityColumn) cols.push("minmax(110px, 0.6fr)");
    cols.push("minmax(210px, 0.9fr)"); // azioni
    return cols.join(" ");
  }, [columnKeys, showVisibilityColumn]);

  const wrapIfHoverEnabled = (it: AnagraficaPreview, rowContent: React.ReactNode) => {
    if (!hoverEnabled) return rowContent;

    const title = buildTitle(it, def, titleKeys, referenceLabelsByField);
    const subtitle = buildSubtitle(it, def, subtitleKeys) ?? undefined;

    return (
      <RowHoverPreview
        key={it.id}
        enabled={true}
        item={it}
        title={title}
        subtitle={subtitle}
        moreInfoTitle={hoverTitle}
        moreInfoKeys={hoverKeys}
        renderValue={(k) => renderCellValuePlain(it, def, k, referenceLabelsByField) || "—"}
        ownerName={showOwner ? (it as any).ownerName ?? it.ownerName : undefined}
        updatedAt={it.updatedAt ? formatDateTime(it.updatedAt) : undefined}
        rowContent={rowContent}
      />
    );
  };

  const renderRowDesktopInner = (it: AnagraficaPreview) => (
    <div
      className={clsx(
        "grid items-center px-4",
        variant === "compact" ? "py-2" : "py-2.5",
        "bg-white/70 transition-all hover:bg-primary/5",
        "dark:bg-gray-dark/35 dark:hover:bg-dark-2/60",
      )}
      style={{ gridTemplateColumns }}
    >
      {/* Scheda */}
      <div className="min-w-0 pr-2">
        <MainCell
          it={it}
          def={def}
          titleKeys={titleKeys}
          subtitleKeys={subtitleKeys}
          showOwner={showOwner}
          showDate={showDate}
          referencePillKeys={referencePillKeys}
          referenceLabelsByField={referenceLabelsByField}
        />
      </div>

      {/* Colonne */}
      {columnKeys.map((fk) => (
        <div
          key={String(fk)}
          className="min-w-0 border-l border-stroke/40 px-2 text-[13px] text-dark/85 dark:border-dark-3/60 dark:text-white"
          title={renderCellValuePlain(it, def, fk, referenceLabelsByField)}
        >
          <div className="min-w-0 truncate">{renderCellValue(it, def, fk, referenceLabelsByField)}</div>
        </div>
      ))}

      {/* Visibilità */}
      {showVisibilityColumn ? (
        <div className="min-w-0 border-l border-stroke/40 px-2 dark:border-dark-3/60">
          <VisibilityCell it={it} />
        </div>
      ) : null}

      {/* Azioni */}
      <div className="min-w-0 border-l border-stroke/40 pl-2 text-right dark:border-dark-3/60">
        <div className="inline-flex whitespace-nowrap">
          <RowWithDelete
            type={type}
            anagrafica={it}
            dispatch={dispatch}
            canView={canView}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>
    </div>
  );

  // ✅ ORA puoi fare return early (hooks già chiamati)
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-2xl bg-gray-2 dark:bg-dark-2" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-stroke bg-white/60 text-sm text-dark/70 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/70">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-stroke bg-white/60 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40">
      {/* DESKTOP */}
      <div className="hidden md:block">
        {/* Header (NO scroll) */}
        <div
          className={clsx(
            "sticky top-0 z-10 grid items-center border-b border-stroke/70 px-4 py-2 text-[11px]",
            "bg-gradient-to-r from-primary/10 via-white/70 to-white/40",
            "text-dark/70 dark:border-dark-3 dark:from-primary/15 dark:via-gray-dark/70 dark:to-gray-dark/40 dark:text-white/70",
          )}
          style={{ gridTemplateColumns }}
        >
          <div className="min-w-0 pr-2">
            <HeaderCell label="Scheda" sortable={false} />
          </div>

          {columnKeys.map((fk) => {
            const colSortKey =
              sortIndex.searchKeyByField[fk] ??
              sortIndex.titleKeyByField[fk] ??
              sortIndex.subtitleKeyByField[fk] ??
              "";

            const isActive = !!colSortKey && colSortKey === sortKey;

            return (
              <div
                key={String(fk)}
                className="min-w-0 border-l border-stroke/40 px-2 dark:border-dark-3/60"
              >
                <HeaderCell
                  label={def.fields[fk]?.label ?? String(fk)}
                  sortable={!!colSortKey}
                  active={isActive}
                  dir={isActive ? sortDir : undefined}
                  onClick={() => colSortKey && onSortByKey(colSortKey)}
                />
              </div>
            );
          })}

          {showVisibilityColumn ? (
            <div className="min-w-0 border-l border-stroke/40 px-2 dark:border-dark-3/60">
              <HeaderCell label="Visibilità" sortable={false} />
            </div>
          ) : null}

          <div className="min-w-0 border-l border-stroke/40 pl-2 text-right dark:border-dark-3/60">
            Azioni
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-stroke/70 dark:divide-dark-3/70">
          {items.map((it) => wrapIfHoverEnabled(it, renderRowDesktopInner(it)))}
        </div>
      </div>

      {/* MOBILE */}
      <div className="md:hidden">
        <div className="divide-y divide-stroke/60 dark:divide-dark-3/60">
          {items.map((it) =>
            wrapIfHoverEnabled(
              it,
              <div key={it.id} className="p-4">
                <div className="rounded-2xl border border-stroke bg-white/70 p-4 shadow-sm backdrop-blur dark:border-dark-3 dark:bg-gray-dark/40">
                  <MainCell
                    it={it}
                    def={def}
                    titleKeys={titleKeys}
                    subtitleKeys={subtitleKeys}
                    showOwner={showOwner}
                    showDate={showDate}
                    referencePillKeys={referencePillKeys}
                    referenceLabelsByField={referenceLabelsByField}
                  />

                  {columnKeys.length ? (
                    <div className="mt-4 space-y-2">
                      {columnKeys.map((fk) => (
                        <div key={String(fk)} className="flex items-start justify-between gap-3">
                          <span className="text-xs text-dark/60 dark:text-white/60">
                            {def.fields[fk]?.label ?? String(fk)}
                          </span>
                          <span className="min-w-0 max-w-[60%] truncate text-right text-sm text-dark dark:text-white">
                            {renderCellValue(it, def, fk, referenceLabelsByField)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <VisibilityCell it={it} />
                  </div>

                  <div className="mt-4">
                    <MobileActions
                      type={type}
                      id={it.id}
                      displayName={it.displayName}
                      canView={canView}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      dispatch={dispatch}
                      anagrafica={it}
                    />
                  </div>
                </div>
              </div>,
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
                      label,
                      sortable,
                      active,
                      dir,
                      onClick,
                    }: {
  label: string;
  sortable: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  if (!sortable) {
    return <div className="min-w-0 truncate pr-2">{label}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group flex min-w-0 items-center gap-2 text-left",
        "hover:text-primary",
        "focus:outline-none focus:ring-2 focus:ring-primary/15",
        active ? "text-primary" : "",
      )}
      title="Ordina"
    >
      <span className="min-w-0 truncate">{label}</span>
      <span
        className={clsx(
          "shrink-0 text-[10px] opacity-60 transition-opacity group-hover:opacity-100",
          active ? "opacity-100" : "",
        )}
      >
        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

function MainCell({
                    it,
                    def,
                    titleKeys,
                    subtitleKeys,
                    showOwner,
                    showDate,
                    referencePillKeys,
                    referenceLabelsByField,
                  }: {
  it: AnagraficaPreview;
  def: any;
  titleKeys: FieldKey[];
  subtitleKeys: FieldKey[];
  showOwner: boolean;
  showDate: AnagraficheListConfig["main"] extends infer M
    ? M extends { showDate?: infer V }
      ? V
      : any
    : any;
  referencePillKeys: FieldKey[];
  referenceLabelsByField: Record<string, Record<string, string | null>>;
}) {
  const title = buildTitle(it, def, titleKeys, referenceLabelsByField);
  const subtitle = buildSubtitle(it, def, subtitleKeys);

  const metaParts: string[] = [];

  if (showDate) {
    const createdAt = (it as any).createdAt as string | undefined;
    const updatedAt = it.updatedAt as string | undefined;

    let label = "Aggiornato";
    let iso = updatedAt || createdAt;

    if (showDate === "updatedOrCreated" && createdAt && updatedAt) {
      const ct = new Date(createdAt).getTime();
      const ut = new Date(updatedAt).getTime();
      if (Number.isFinite(ct) && Number.isFinite(ut) && ct === ut) {
        label = "Creato";
        iso = createdAt;
      }
    }

    if (iso) metaParts.push(`${label}: ${formatDateTime(iso)}`);
  }

  if (showOwner && it.ownerName) {
    metaParts.push(`Proprietario: ${it.ownerName}`);
  }

  return (
    <div className="min-w-0">
      <div className="truncate text-base font-semibold text-dark dark:text-white">{title}</div>

      {subtitle ? (
        <div className="mt-1 truncate text-sm text-dark/70 dark:text-white/70">{subtitle}</div>
      ) : null}

      {referencePillKeys.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {referencePillKeys.map((fk) => {
            const fd = def.fields[fk] as FieldDef | undefined;
            if (!fd || !isReferenceField(fd) || !fd.reference) return null;

            const rawId = (it.data as any)?.[fk];
            if (rawId === null || rawId === undefined || rawId === "") return null;

            const idStr = String(rawId);
            const previewLabel = referenceLabelsByField[fk]?.[idStr] ?? undefined;

            return (
              <ReferencePill
                key={`${it.id}-${String(fk)}-${idStr}`}
                targetId={idStr}
                fieldLabel={fd.label}
                config={fd.reference}
                previewLabel={previewLabel}
              />
            );
          })}
        </div>
      ) : null}

      {/* ✅ META come 2 righe semplici */}
      {metaParts.length ? (
        <div className="mt-2 space-y-0.5 text-[12px] text-dark/60 dark:text-white/60">
          {metaParts.map((m) => (
            <div key={m} className="leading-tight">
              {m}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildTitle(
  it: AnagraficaPreview,
  def: any,
  titleKeys: FieldKey[],
  referenceLabelsByField: Record<string, Record<string, string | null>>,
): string {
  const parts: string[] = [];
  for (const fk of titleKeys) {
    const fd = def.fields[fk] as FieldDef | undefined;
    const raw = (it.data as any)?.[fk];
    if (raw === null || raw === undefined || raw === "") continue;

    if (fd && isReferenceField(fd)) {
      const idStr = String(raw);
      parts.push(referenceLabelsByField[fk]?.[idStr] ?? idStr);
    } else {
      parts.push(formatFieldValue(fd, raw));
    }
  }
  return parts.length ? parts.join(" · ") : it.displayName;
}

function buildSubtitle(it: AnagraficaPreview, def: any, subtitleKeys: FieldKey[]): string | null {
  const parts: string[] = [];
  for (const fk of subtitleKeys) {
    const fd = def.fields[fk] as FieldDef | undefined;
    const raw = (it.data as any)?.[fk];
    if (raw === null || raw === undefined || raw === "") continue;
    if (fd && isReferenceField(fd)) continue;
    parts.push(formatFieldValue(fd, raw));
  }
  return parts.length ? parts.join(" · ") : null;
}

function renderCellValuePlain(
  it: AnagraficaPreview,
  def: any,
  fk: FieldKey,
  referenceLabelsByField: Record<string, Record<string, string | null>>,
): string {
  const fd = def.fields[fk] as FieldDef | undefined;
  const raw = (it.data as any)?.[fk];

  if (raw === null || raw === undefined || raw === "") return "";
  if (fd && isReferenceField(fd)) {
    const idStr = String(raw);
    return referenceLabelsByField[fk]?.[idStr] ?? idStr;
  }
  return formatFieldValue(fd, raw);
}

function renderCellValue(
  it: AnagraficaPreview,
  def: any,
  fk: FieldKey,
  referenceLabelsByField: Record<string, Record<string, string | null>>,
) {
  const fd = def.fields[fk] as FieldDef | undefined;
  const raw = (it.data as any)?.[fk];

  if (raw === null || raw === undefined || raw === "") {
    return <span className="text-dark/35 dark:text-white/35">—</span>;
  }

  if (fd && isReferenceField(fd)) {
    const idStr = String(raw);
    const label = referenceLabelsByField[fk]?.[idStr] ?? idStr;
    return <span className="truncate">{label}</span>;
  }

  const s = formatFieldValue(fd, raw);
  return <span className="truncate">{s}</span>;
}

function VisibilityCell({ it }: { it: any }) {
  const roles: string[] = Array.isArray(it.visibilityRoles)
    ? it.visibilityRoles.filter(Boolean)
    : it.visibilityRole
      ? [String(it.visibilityRole)]
      : [];

  const label =
    roles.length === 0 ? "Public" : roles.length === 1 ? roles[0] : `${roles.length} ruoli`;

  return <VisibilityBadge role={label} />;
}

function RowWithDelete({
                         type,
                         anagrafica,
                         dispatch,
                         canView,
                         canEdit,
                         canDelete,
                       }: {
  type: string;
  anagrafica: AnagraficaPreview;
  dispatch: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await dispatch(deleteAnagrafica({ type, id: anagrafica.id })).unwrap();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <RowActions
        viewHref={`/anagrafiche/${type}/${anagrafica.id}`}
        editHref={`/anagrafiche/${type}/${anagrafica.id}/edit`}
        deleting={deleting}
        onDelete={canDelete ? () => setConfirmOpen(true) : undefined}
        deleteLabel="Delete"
        canView={canView}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare questa anagrafica?"
        description={
          <>
            Stai per eliminare <strong>{anagrafica.displayName}</strong>. Questa azione non può essere annullata.
          </>
        }
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => !deleting && setConfirmOpen(false)}
      />
    </>
  );
}

function MobileActions({
                         type,
                         id,
                         displayName,
                         canView,
                         canEdit,
                         canDelete,
                         dispatch,
                         anagrafica,
                       }: {
  type: string;
  id: string;
  displayName: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dispatch: any;
  anagrafica: AnagraficaPreview;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await dispatch(deleteAnagrafica({ type, id: anagrafica.id })).unwrap();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/anagrafiche/${type}/${id}`}
          className={clsx(
            "col-span-1 rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-center text-sm font-semibold text-primary shadow-sm",
            "hover:bg-primary/10 dark:bg-gray-dark/40 dark:hover:bg-dark-2/70",
            !canView ? "pointer-events-none opacity-40" : "",
          )}
        >
          View
        </Link>

        <Link
          href={`/anagrafiche/${type}/${id}/edit`}
          className={clsx(
            "col-span-1 rounded-xl border border-primary/30 bg-white/70 px-3 py-3 text-center text-sm font-semibold text-primary shadow-sm",
            "hover:bg-primary/10 dark:bg-gray-dark/40 dark:hover:bg-dark-2/70",
            !canEdit ? "pointer-events-none opacity-40" : "",
          )}
        >
          Edit
        </Link>

        <button
          type="button"
          onClick={() => canDelete && setConfirmOpen(true)}
          disabled={!canDelete}
          className={clsx(
            "col-span-1 rounded-xl border border-red-400/50 bg-white/70 px-3 py-3 text-sm font-semibold text-red-500 shadow-sm",
            "hover:bg-red-50 dark:bg-gray-dark/40 dark:hover:bg-dark-2/70",
            !canDelete ? "opacity-40" : "",
          )}
        >
          {deleting ? "..." : "Delete"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare questa anagrafica?"
        description={
          <>
            Stai per eliminare <strong>{displayName}</strong>. Questa azione non può essere annullata.
          </>
        }
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={() => !deleting && setConfirmOpen(false)}
      />
    </>
  );
}
