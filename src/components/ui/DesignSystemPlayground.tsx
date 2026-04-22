"use client";

import { useMemo, useState } from "react";
import {
  AppActionRow,
  AppAlert,
  AppBadge,
  AppButton,
  AppCard,
  AppDescriptionList,
  AppEmptyState,
  AppFilterBar,
  AppIconButton,
  AppLinkButton,
  AppLoadingOverlay,
  AppModal,
  AppPagination,
  AppPanel,
  AppPropertyGrid,
  AppSearchField,
  AppSelect,
  AppSkeleton,
  AppTable,
  AppTableBody,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
  AppTag,
  AppTextarea,
  AppToolbar,
} from "@/components/ui";

const roleOptions = [
  { value: "commerciale", label: "Commerciale" },
  { value: "amministrazione", label: "Amministrazione" },
  { value: "super", label: "Super" },
];

const filterConfig = [
  {
    id: "query",
    type: "text" as const,
    label: "Query",
    placeholder: "Nome o email",
  },
  {
    id: "ruolo",
    type: "select" as const,
    label: "Ruolo",
    placeholder: "Tutti i ruoli",
    options: roleOptions,
  },
];

export function DesignSystemPlayground() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("amministrazione");
  const [note, setNote] = useState(
    "Questa pagina serve a verificare il nuovo foundation layer senza toccare ancora i moduli legacy.",
  );
  const [page, setPage] = useState(2);
  const [filters, setFilters] = useState<Record<string, string>>({
    query: "",
    ruolo: "",
  });
  const [tags, setTags] = useState(["Dashboard", "Lead", "Mobile"]);

  const tableRows = useMemo(
    () => [
      { name: "AppCard", status: "Attiva", area: "Surface" },
      { name: "AppSelect", status: "Rifinita", area: "Form" },
      { name: "AppFilterBar", status: "Nuova", area: "Shell" },
      { name: "AppPagination", status: "Nuova", area: "Navigation" },
    ],
    [],
  );

  const descriptionItems = useMemo(
    () => [
      { label: "Foundation", value: "Wave 1 completata" },
      { label: "Secondo piano", value: "Wave 2 in apertura" },
      { label: "Tailwind", value: "Ancora adapter attivo" },
      { label: "Migrazione", value: "Incrementale, senza big bang" },
    ],
    [],
  );

  const propertyItems = useMemo(
    () => [
      { label: "Surface", value: "glass", tone: "primary" as const },
      { label: "Tone", value: "primary / neutral / success / danger" },
      { label: "Radius", value: "stabilizzato nelle primitive" },
      { label: "Dropdown", value: "custom, non native select" },
      { label: "Obiettivo", value: "UI piu portabile" },
      { label: "Legacy", value: "convive finche serve" },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <AppToolbar
        title="Design System Playground"
        description="Pagina di test per visualizzare e provare le nuove primitive introdotte nel progetto."
        meta={<AppBadge tone="primary">Wave 1-2 attive</AppBadge>}
        actions={
          <>
            <AppButton
              variant="outline"
              tone="neutral"
              onClick={() => setLoadingOverlay((current) => !current)}
            >
              Toggle overlay
            </AppButton>
            <AppButton onClick={() => setModalOpen(true)}>Apri modal</AppButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Buttons</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Azioni primarie, iconiche e navigazionali dentro una stessa famiglia.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AppButton>Primary</AppButton>
            <AppButton variant="outline" tone="neutral">
              Neutral outline
            </AppButton>
            <AppButton variant="ghost" tone="primary">
              Ghost
            </AppButton>
            <AppButton tone="success">Success</AppButton>
            <AppButton tone="danger">Danger</AppButton>
            <AppButton loading>Loading</AppButton>
            <AppLinkButton href="/design-system" variant="outline" tone="primary">
              Link button
            </AppLinkButton>
            <AppIconButton icon="+" srLabel="Aggiungi" tone="primary" />
            <AppIconButton icon="i" srLabel="Informazioni" tone="neutral" />
            <AppIconButton icon="x" srLabel="Chiudi" tone="danger" />
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Feedback</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Badge, tag e alert iniziano a parlare una lingua comune.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AppBadge tone="neutral">Neutral</AppBadge>
            <AppBadge tone="primary">Primary</AppBadge>
            <AppBadge tone="success">Success</AppBadge>
            <AppBadge tone="warning">Warning</AppBadge>
            <AppBadge tone="danger">Danger</AppBadge>
            <AppBadge tone="info">Info</AppBadge>
            {tags.map((tag) => (
              <AppTag
                key={tag}
                onRemove={() =>
                  setTags((current) => current.filter((item) => item !== tag))
                }
              >
                {tag}
              </AppTag>
            ))}
          </div>
          <AppAlert
            tone="info"
            title="Foundation layer in convivenza"
            description="Le primitive nuove possono nascere ora e i moduli legacy possono migrare poco a poco."
            actions={
              <AppButton variant="ghost" tone="primary" size="sm">
                Apri checklist
              </AppButton>
            }
          />
        </AppCard>

        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Surface</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Card, panel e overlay devono dare gerarchia senza introdurre stili locali.
            </p>
          </div>
          <div className="grid gap-3">
            <AppPanel>
              <div className="text-sm text-dark/70 dark:text-white/70">
                Questo panel resta leggero e va bene per shell secondarie, filtri e blocchi di supporto.
              </div>
            </AppPanel>
            <div className="relative">
              <AppCard surface="glass" elevation="floating" interactive>
                <div className="space-y-3 text-sm text-dark/70 dark:text-white/70">
                  <p>Questa card mostra la direzione piu ricca del layer visuale.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <AppSkeleton className="h-14" />
                    <AppSkeleton className="h-14" />
                    <AppSkeleton className="h-14" />
                  </div>
                </div>
              </AppCard>
              <AppLoadingOverlay open={loadingOverlay} />
            </div>
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Forms</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Il dropdown ora e custom e mantiene meglio il carattere cromatico del vecchio controllo.
            </p>
          </div>
          <div className="grid gap-4">
            <AppSearchField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca una primitive..."
            />
            <AppSelect
              label="Ruolo"
              value={role}
              onChange={setRole}
              options={roleOptions}
              hint="Dropdown custom con look piu vicino al precedente"
            />
            <AppTextarea
              label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              hint="Textarea riusabile"
            />
          </div>
        </AppCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Filter Shell</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Una shell di filtri comune aiuta a evitare toolbar visive diverse per ogni modulo.
            </p>
          </div>
          <AppFilterBar
            filters={filterConfig}
            values={filters}
            onChange={(id, value) =>
              setFilters((current) => ({
                ...current,
                [id]: value,
              }))
            }
          />
          <AppActionRow
            viewHref="/design-system"
            editHref="/design-system"
            onDelete={() => setTags([])}
          />
        </AppCard>

        <AppCard className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Metadata</h2>
            <p className="text-sm text-dark/60 dark:text-white/60">
              Description list e property grid coprono il piano informativo semplice.
            </p>
          </div>
          <AppDescriptionList items={descriptionItems} />
          <AppPropertyGrid items={propertyItems} />
        </AppCard>
      </div>

      <AppCard className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Table & Pagination</h2>
          <p className="text-sm text-dark/60 dark:text-white/60">
            Prima shell tabellare comune con paginazione collegata.
          </p>
        </div>

        <AppTable>
          <AppTableHeader>
            <tr>
              <AppTableHead>Primitive</AppTableHead>
              <AppTableHead>Stato</AppTableHead>
              <AppTableHead>Area</AppTableHead>
            </tr>
          </AppTableHeader>
          <AppTableBody>
            {tableRows.map((row) => (
              <AppTableRow key={row.name}>
                <AppTableCell>{row.name}</AppTableCell>
                <AppTableCell>
                  <AppBadge tone="success" size="sm">
                    {row.status}
                  </AppBadge>
                </AppTableCell>
                <AppTableCell>{row.area}</AppTableCell>
              </AppTableRow>
            ))}
          </AppTableBody>
        </AppTable>

        <AppPagination
          page={page}
          totalPages={8}
          totalItems={64}
          pageSize={8}
          onPageChange={setPage}
        />
      </AppCard>

      <AppEmptyState
        title="Empty state di test"
        description="Questa primitive servira per sostituire i vari stati vuoti sparsi nelle liste e nei pannelli."
        action={
          <AppButton variant="outline" tone="primary">
            Azione demo
          </AppButton>
        }
      />

      <AppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="AppModal"
        subtitle="Questa usa ancora la logica del modal esistente, ma espone un API nuova."
        footer={
          <div className="flex justify-end gap-2">
            <AppButton
              variant="outline"
              tone="neutral"
              onClick={() => setModalOpen(false)}
            >
              Chiudi
            </AppButton>
            <AppButton onClick={() => setModalOpen(false)}>Conferma</AppButton>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-dark/70 dark:text-white/70">
          <p>
            Questa pagina serve a validare il foundation layer senza dover gia migrare i moduli reali.
          </p>
          <p>
            Il Tailwind corrente resta utilizzabile: in questa fase lo stiamo usando come base di implementazione delle primitive.
          </p>
        </div>
      </AppModal>
    </div>
  );
}
