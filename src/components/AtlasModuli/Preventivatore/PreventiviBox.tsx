"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "@/components/Store/hooks";
import { deleteAnagrafica } from "@/components/Store/slices/anagraficheSlice";
import { anagraficheService } from "@/components/Store/services/anagraficheService";

import { ResourceListBox, type Column } from "@/components/AtlasModuli/common/ResourceListBox";
import { VisibilityBadge } from "@/components/AtlasModuli/common/VisibilityBadge";
import { RowActions } from "@/components/AtlasModuli/common/RowActions";
import { ConfirmDialog } from "@/components/AtlasModuli/common/ConfirmDialog";
import { Select } from "@/components/ui/select";

import { useCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

import { usePreventiviList, type PreventivoListItem } from "./usePreventiviList";
import { extractRefId } from "./PreventiviUtils";

const PREVENTIVI_TYPE = "preventivi";
const RIGHE_TYPE = "righe-preventivo";

type OptionTuple = [value: string, label: string];

function formatDate(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("it-IT");
}

export default function PreventiviBox() {
  const dispatch = useAppDispatch();

  const { canView, canCreate, canEdit, canDelete } = useCrudPermissions(
    PREVENTIVI_TYPE as AnagraficaTypeSlug,
  );

  const [query, setQuery] = useState("");
  const [stato, setStato] = useState<string>("");

  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [query, stato]);

  const { items, status, totalPages, totalItems } = usePreventiviList({
    query: query || undefined,
    stato: stato || undefined,
    page,
    pageSize,
  });

  const loading = status === "loading" || status === "idle";

  const statoOptions: OptionTuple[] = useMemo(
    () => [
      ["", "Tutti gli stati"],
      ["bozza", "Bozza"],
      ["inviato", "Inviato"],
      ["accettato", "Accettato"],
      ["rifiutato", "Rifiutato"],
      ["fatturato", "Fatturato"],
      ["acconto pagato", "Acconto Pagato"],
      ["saldo pagato", "Saldo Pagato"],
    ],
    [],
  );

  const columns: Column<PreventivoListItem>[] = [
    {
      id: "scheda",
      header: "Preventivo",
      className: "col-span-8",
      isMain: true,
      render: (p) => {
        const cliente = p.clienteLabel ? `Cliente: ${p.clienteLabel}` : "Cliente: —";
        const data = formatDate(p.data?.dataPreventivo);

        // ✅ ora arriva normalizzato dal hook
        const statoText = p.statoPreventivo ? String(p.statoPreventivo) : "—";

        return (
          <>
            <div className="truncate font-semibold">{p.displayName}</div>
            <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
              {cliente} · Data: {data} · Stato: {statoText}
            </div>

            {p.ownerName && !p.visibilityRole && (
              <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
                Proprietario: {p.ownerName}
              </div>
            )}
          </>
        );
      },
    },
    {
      id: "visibility",
      header: "Visibilità",
      className: "hidden xl:block col-span-2 text-xs",
      render: (p) => <VisibilityBadge role={p.visibilityRole ?? ""} />,
    },
  ];

  const toolbarRight = (
    <div className="w-64 text-sm">
      <Select
        value={stato}
        onChange={setStato}
        options={statoOptions}
        placeholder="Stato preventivo"
      />
    </div>
  );

  return (
    <ResourceListBox<PreventivoListItem>
      title="Preventivi"
      newHref={canCreate ? "/preventivi/new" : undefined}
      newLabel="Nuovo preventivo"
      searchPlaceholder="Cerca preventivo…"
      query={query}
      setQuery={setQuery}
      loading={loading}
      items={items}
      emptyMessage="Nessun preventivo"
      columns={columns}
      getKey={(p) => p.id}
      toolbarRight={toolbarRight}
      actionsColumnClassName="md:col-span-4 xl:col-span-2 text-right"
      renderActions={(p) => (
        <RowPreventivoActions
          preventivoId={p.id}
          dispatch={dispatch}
          canView={canView}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
      page={page}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={totalItems}
      onPageChange={setPage}
    />
  );
}

function RowPreventivoActions({
                                preventivoId,
                                dispatch,
                                canView,
                                canEdit,
                                canDelete,
                              }: {
  preventivoId: string;
  dispatch: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClickDelete = () => setConfirmOpen(true);
  const handleCancel = () => {
    if (!deleting) setConfirmOpen(false);
  };

  const handleConfirm = async () => {
    try {
      setDeleting(true);

      const righeRes = await anagraficheService.list({
        type: RIGHE_TYPE,
        page: 1,
        pageSize: 5000,
      });

      const righeItems: any[] = (righeRes as any)?.items ?? [];
      const toDelete = righeItems
        .filter((r: any) => {
          const refId = extractRefId(r?.data?.preventivoRiferimento ?? r?.data?.preventivoId);
          return refId != null && String(refId) === String(preventivoId);
        })
        .map((r: any) => String(r.id));

      for (const id of toDelete) {
        await dispatch(deleteAnagrafica({ type: RIGHE_TYPE, id })).unwrap();
      }

      await dispatch(deleteAnagrafica({ type: PREVENTIVI_TYPE, id: preventivoId })).unwrap();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <RowActions
        viewHref={`/preventivi/${encodeURIComponent(preventivoId)}`}
        editHref={`/preventivi/${encodeURIComponent(preventivoId)}`}
        deleting={deleting}
        onDelete={canDelete ? handleClickDelete : undefined}
        deleteLabel="Elimina"
        canView={canView}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminare questo preventivo?"
        description={
          <>
            Stai per eliminare il preventivo <strong>{preventivoId}</strong> e tutte le sue righe.
            Questa azione non può essere annullata.
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
