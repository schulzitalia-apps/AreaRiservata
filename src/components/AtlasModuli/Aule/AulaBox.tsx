// src/components/AtlasModuli/aule/AulaBox.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuleList } from "./useAuleList";
import {
  ResourceListBox,
  type Column,
} from "@/components/AtlasModuli/common/ResourceListBox";
import { VisibilityBadge } from "@/components/AtlasModuli/common/VisibilityBadge";
import { RowActions } from "@/components/AtlasModuli/common/RowActions";
import { ConfirmDialog } from "@/components/AtlasModuli/common/ConfirmDialog";
import { useAppDispatch } from "@/components/Store/hooks";
import { deleteAula } from "@/components/Store/slices/auleSlice";
import type { AulaPreview } from "@/components/Store/models/aule";
import { getAulaDef } from "@/config/aule.registry";
import type { AulaTypeSlug } from "@/config/aule.types.public";

import { useAulaCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";

export default function AulaBox({ type }: { type: string }) {
  const dispatch = useAppDispatch();
  const def = getAulaDef(type);

  const { canView, canCreate, canEdit, canDelete } =
    useAulaCrudPermissions(type as AulaTypeSlug);

  // filtro di ricerca locale
  const [query, setQuery] = useState("");

  // paginazione locale
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [query]);

  const { items, status, total, totalPages } = useAuleList(
    type,
    { query: query || undefined },
    page,
    pageSize,
  );

  const loading = status === "loading" || status === "idle";

  const columns: Column<AulaPreview>[] = [
    {
      id: "aula",
      header: "Aula",
      // colonna principale
      className: "col-span-2 min-w-0",
      isMain: true,
      render: (aula) => (
        <>
          <div className="truncate font-semibold">{aula.label}</div>
          <div className="mt-0.5 text-[11px] text-dark/60 dark:text-white/60">
            Tipo aula: {aula.tipo}
          </div>
        </>
      ),
    },
    {
      id: "owner",
      header: "Proprietario",
      // visibile solo da lg in su
      className:
        "hidden lg:block col-span-2 truncate text-xs text-dark/80 dark:text-white/80",
      render: (aula) => aula.ownerName || "—",
    },
    {
      id: "anagraficaType",
      header: "Tipo anagrafica",
      // visibile solo da xl in su
      className:
        "hidden xl:block col-span-2 truncate text-xs text-dark/70 dark:text-white/70",
      render: (aula) => aula.anagraficaType,
    },
    {
      id: "visibility",
      header: "Visibilità",
      // visibile solo da xl in su
      className: "hidden xl:block col-span-2 text-xs",
      render: (aula) => <VisibilityBadge role={aula.visibilityRole} />,
    },
    {
      id: "partecipanti",
      header: "Partecipanti",
      className:
        "col-span-3 text-center text-xs text-dark/80 dark:text-white/80",
      render: (aula) => aula.numeroPartecipanti ?? 0,
    },
  ];

  return (
    <ResourceListBox<AulaPreview>
      title={def.label}
      newHref={canCreate ? `/aule/${type}/new` : undefined}
      newLabel="Nuova Aula"
      searchPlaceholder="Cerca aula…"
      query={query}
      setQuery={setQuery}
      loading={loading}
      items={items}
      emptyMessage="Nessuna aula trovata"
      columns={columns}
      getKey={(a) => a.id}
      // 👉 Azioni: md 7 col (riempie a destra), lg 5 col, xl 1 col
      actionsColumnClassName="md:col-span-7 lg:col-span-5 xl:col-span-1 text-right"
      renderActions={(aula) => (
        <RowWithDelete
          type={type}
          aula={aula}
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
                         aula,
                         dispatch,
                         canView,
                         canEdit,
                         canDelete,
                       }: {
  type: string;
  aula: AulaPreview;
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
      await dispatch(deleteAula({ type, id: aula.id })).unwrap();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <RowActions
        viewHref={`/aule/${type}/${aula.id}`}
        editHref={`/aule/${type}/${aula.id}/edit`}
        deleting={deleting}
        onDelete={canDelete ? handleClickDelete : undefined}
        deleteLabel="Delete"
        canView={canView}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare questa aula?"
        description={
          <>
            Stai per eliminare <strong>{aula.label}</strong>. Questa azione non
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
