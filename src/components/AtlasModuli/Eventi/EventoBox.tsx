// src/components/AtlasModuli/eventi/EventoBox.tsx
"use client";

import { useEffect, useState } from "react";
import { useEventiList } from "./useEventiList";
import {
  ResourceListBox,
  type Column,
} from "@/components/AtlasModuli/common/ResourceListBox";
import { VisibilityBadge } from "@/components/AtlasModuli/common/VisibilityBadge";
import { RowActions } from "@/components/AtlasModuli/common/RowActions";
import { ConfirmDialog } from "@/components/AtlasModuli/common/ConfirmDialog";
import { useAppDispatch } from "@/components/Store/hooks";
import { deleteEvento } from "@/components/Store/slices/eventiSlice";
import type { EventoPreview } from "@/components/Store/models/eventi";
import { getEventoDef } from "@/config/eventi.registry";
import type { EventoTypeSlug } from "@/config/eventi.types.public";
import { useEventoCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";

function formatDateTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "—";

  const fmt = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (start && end) {
    return `${fmt.format(new Date(start))} → ${fmt.format(new Date(end))}`;
  }
  if (start) return fmt.format(new Date(start));
  return `entro ${fmt.format(new Date(end!))}`;
}

function timeKindLabel(kind: EventoPreview["timeKind"]) {
  switch (kind) {
    case "point":
      return "Singolo istante";
    case "interval":
      return "Intervallo";
    case "deadline":
      return "Scadenza";
    case "recurring_master":
      return "Ricorrente (schema)";
    case "recurring_occurrence":
      return "Ricorrente (occorrenza)";
    default:
      return kind;
  }
}

export default function EventoBox({ type }: { type: string }) {
  const dispatch = useAppDispatch();
  const def = getEventoDef(type);

  // permessi CRUD per questo tipo evento
  const { canView, canCreate, canEdit, canDelete } =
    useEventoCrudPermissions(type as EventoTypeSlug);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // quando cambia la query → torna a pagina 1
  useEffect(() => {
    setPage(1);
  }, [query]);

  const { items, status, total, totalPages } = useEventiList(
    type,
    { query: query || undefined },
    page,
    pageSize,
  );

  const loading = status === "loading" || status === "idle";

  const columns: Column<EventoPreview>[] = [
    {
      id: "evento",
      header: "Evento",
      // md:5, lg:4, xl:4 → si stringe man mano che aggiungiamo colonne
      className: "col-span-5 lg:col-span-4 xl:col-span-4 min-w-0",
      isMain: true,
      render: (evento) => (
        <>
          <div className="truncate font-semibold">
            {evento.displayName}
          </div>
          {evento.subtitle && (
            <div className="mt-0.5 text-[11px] text-dark/70 dark:text-white/70">
              {evento.subtitle}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-dark/60 dark:text-white/60">
            {formatDateTimeRange(evento.startAt, evento.endAt)}
          </div>
        </>
      ),
    },
    {
      id: "timeKind",
      header: "Tipo",
      // solo da lg in su, 2 colonne
      className:
        "hidden lg:block lg:col-span-2 xl:col-span-2 min-w-0 truncate text-xs text-dark/70 dark:text-white/70",
      render: (evento) => timeKindLabel(evento.timeKind),
    },
    {
      id: "owner",
      header: "Proprietario",
      // solo da xl in su, 2 colonne
      className:
        "hidden xl:block xl:col-span-2 min-w-0 truncate text-xs text-dark/80 dark:text-white/80",
      render: (evento) => evento.ownerName || "—",
    },
    {
      id: "visibility",
      header: "Visibilità",
      // md:3, lg:3, xl:2
      className: "col-span-3 lg:col-span-3 xl:col-span-2 min-w-0 text-xs",
      render: (evento) => (
        <VisibilityBadge role={evento.visibilityRole} />
      ),
    },
  ];

  return (
    <ResourceListBox<EventoPreview>
      title={def.label}
      newHref={canCreate ? `/eventi/${type}/new` : undefined}
      newLabel="Nuovo evento"
      searchPlaceholder="Cerca evento…"
      query={query}
      setQuery={setQuery}
      loading={loading}
      items={items}
      emptyMessage="Nessun evento trovato"
      columns={columns}
      getKey={(e) => e.id}
      // Azioni: md 4 col, lg 3 col, xl 2 col → chiude sempre a 12
      actionsColumnClassName="md:col-span-4 lg:col-span-3 xl:col-span-2 text-right"
      renderActions={(evento) => (
        <RowWithDelete
          type={type}
          evento={evento}
          dispatch={dispatch}
          canView={canView}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      page={page}
      totalPages={totalPages}
      totalItems={total}
      pageSize={pageSize}
      onPageChange={setPage}
    />
  );
}

function RowWithDelete({
                         type,
                         evento,
                         dispatch,
                         canView,
                         canEdit,
                         canDelete,
                       }: {
  type: string;
  evento: EventoPreview;
  dispatch: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClickDelete = () => setConfirmOpen(true);

  const handleCancel = () => {
    if (deleting) return;
    setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    try {
      setDeleting(true);
      await dispatch(
        deleteEvento({ type, id: evento.id }),
      ).unwrap();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <RowActions
        viewHref={`/eventi/${type}/${evento.id}`}
        editHref={`/eventi/${type}/${evento.id}/edit`}
        deleting={deleting}
        onDelete={canDelete ? handleClickDelete : undefined}
        deleteLabel="Delete"
        canView={canView}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare questo evento?"
        description={
          <>
            Stai per eliminare{" "}
            <strong>{evento.displayName}</strong>. Questa azione non
            può essere annullata.
          </>
        }
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        loading={deleting}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
