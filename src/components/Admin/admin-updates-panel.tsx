"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  DevItemCategory,
  DevItemStatus,
  DevBoardItem,
} from "@/components/Store/models/devBoard"
import {
  fetchDevItems,
  createDevItem,
  updateDevItem,
  deleteDevItem,
} from "@/components/Store/slices/devBoardSlice";
import { releaseNotes } from "@/config/updates.config";
import { cn } from "@/server-utils/lib/utils";
import { Select } from "@/components/ui/select"; // 👈 nuovo select

const CATEGORY_LABEL: Record<DevItemCategory, string> = {
  bug: "Bug fix",
  feature: "Richieste feature",
  training: "Info per formazione",
  note: "Appunti",
};

const STATUS_LABEL: Record<DevItemStatus, string> = {
  open: "Aperto",
  in_progress: "In lavorazione",
  done: "Completato",
};

// opzioni per lo status dropdown (usate dalla Select)
const STATUS_OPTIONS: ReadonlyArray<readonly [DevItemStatus, string]> = (
  Object.keys(STATUS_LABEL) as DevItemStatus[]
).map((s) => [s, STATUS_LABEL[s]] as const);

export function AdminUpdatesPanel() {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((s) => s.devBoard);
  const [category, setCategory] = useState<DevItemCategory>("bug");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [versionTag, setVersionTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchDevItems(undefined));
  }, [dispatch]);

  const filtered = useMemo(
    () => items.filter((it) => it.category === category),
    [items, category],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await dispatch(
        createDevItem({
          category,
          title: title.trim(),
          description: description.trim(),
          versionTag: versionTag.trim() || undefined,
        }),
      ).unwrap();
      setTitle("");
      setDescription("");
      setVersionTag("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    item: DevBoardItem,
    newStatus: DevItemStatus,
  ) {
    setUpdatingId(item.id);
    try {
      await dispatch(
        updateDevItem({ id: item.id, data: { status: newStatus } }),
      ).unwrap();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(item: DevBoardItem) {
    const ok = confirm(
      "Sicuro di voler eliminare questa voce? Operazione definitiva.",
    );
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await dispatch(deleteDevItem({ id: item.id })).unwrap();
    } finally {
      setDeletingId(null);
    }
  }

  const latestRelease = releaseNotes[0];

  return (
    <section className="mt-6 md:mt-8 2xl:mt-10">
      {/* Card grande unica */}
      <div className="rounded-2xl border border-stroke bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6 shadow-1 dark:border-dark-3 dark:from-primary/15 dark:via-gray-dark dark:to-gray-dark dark:shadow-card md:p-7 2xl:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Aggiornamenti &amp; Dev board
            </h2>
            <p className="mt-1 text-sm text-dark/70 dark:text-white/70">
              Changelog dell&apos;ultima versione e spazio condiviso per bug,
              richieste e appunti di sviluppo.
            </p>
          </div>

          {/* Tabs categorie */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/70 p-1.5 text-sm shadow-sm dark:bg-black/40">
            {(Object.keys(CATEGORY_LABEL) as DevItemCategory[]).map((cat) => {
              const active = cat === category;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 font-medium transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "text-dark/70 hover:bg-gray-1 dark:text-white/70 dark:hover:bg-gray-dark",
                  )}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenuto a due colonne */}
        <div className="grid grid-cols-12 gap-6 md:gap-7 2xl:gap-8">
          {/* Release notes */}
          <div className="col-span-12 xl:col-span-4">
            <div className="h-full rounded-[14px] border border-stroke bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              <h3 className="text-base font-semibold text-dark dark:text-white">
                Ultimi aggiornamenti
              </h3>

              {latestRelease ? (
                <>
                  <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
                    Versione{" "}
                    <span className="font-semibold">
                      {latestRelease.version}
                    </span>
                    {latestRelease.date && ` · ${latestRelease.date}`}
                  </p>
                  {latestRelease.title && (
                    <p className="mt-1 text-sm text-dark/80 dark:text-white/80">
                      {latestRelease.title}
                    </p>
                  )}

                  <ul className="mt-3 space-y-1.5 pl-4 text-sm text-dark/80 dark:text-white/80">
                    {latestRelease.items.map((it, idx) => (
                      <li key={idx} className="list-disc">
                        {it}
                      </li>
                    ))}
                  </ul>

                  {releaseNotes.length > 1 && (
                    <details className="mt-4 text-xs text-dark/70 dark:text-white/70">
                      <summary className="cursor-pointer text-primary">
                        Vedi versioni precedenti
                      </summary>
                      <div className="mt-2 space-y-3">
                        {releaseNotes.slice(1).map((rel) => (
                          <div key={rel.version}>
                            <div className="text-xs font-semibold">
                              {rel.version}
                              {rel.date && ` · ${rel.date}`}
                            </div>
                            <ul className="pl-4 text-xs">
                              {rel.items.map((it, idx) => (
                                <li key={idx} className="list-disc">
                                  {it}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-dark/60 dark:text-white/60">
                  Nessun aggiornamento registrato.
                </p>
              )}
            </div>
          </div>

          {/* Dev board */}
          <div className="col-span-12 xl:col-span-8">
            <div className="h-full rounded-[14px] border border-stroke bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
              {/* Form nuova voce */}
              <form
                onSubmit={handleCreate}
                className="mb-6 grid gap-3 rounded-lg border border-stroke bg-gray-1/40 p-4 text-sm dark:border-dark-3 dark:bg-dark-2/60"
              >
                <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-dark/70 dark:text-white/70">
                      Titolo
                    </span>
                    <input
                      className="w-full rounded-md border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Es: Problema accesso nome@nome.it"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-dark/70 dark:text-white/70">
                      Versione (opzionale)
                    </span>
                    <input
                      className="w-full rounded-md border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                      value={versionTag}
                      onChange={(e) => setVersionTag(e.target.value)}
                      placeholder="es. 0.3.0"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-sm text-dark/70 dark:text-white/70">
                    Descrizione
                  </span>
                  <textarea
                    className="min-h-[90px] w-full rounded-md border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Es: Non riesco ad accedere con nome@nome.it e password nome..."
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-dark/60 dark:text-white/60">
                    Categoria corrente:{" "}
                    <strong>{CATEGORY_LABEL[category]}</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={
                      submitting || !title.trim() || !description.trim()
                    }
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Salvo..." : "Aggiungi alla board"}
                  </button>
                </div>
              </form>

              {/* Lista voci */}
              <div className="space-y-3">
                {status === "loading" && items.length === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-12 animate-pulse rounded bg-gray-2 dark:bg-dark-2"
                      />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-sm text-dark/60 dark:text-white/60">
                    Nessuna voce per questa categoria.
                  </div>
                ) : (
                  filtered.map((it) => {
                    const busy =
                      updatingId === it.id || deletingId === it.id;
                    return (
                      <div
                        key={it.id}
                        className="rounded-lg border border-stroke px-4 py-3 text-sm text-dark/80 shadow-sm dark:border-dark-3 dark:text-white/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-dark dark:text-white">
                                {it.title}
                              </span>
                              {it.versionTag && (
                                <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-dark/70 dark:bg-dark-2 dark:text-white/70">
                                  v{it.versionTag}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
                              {it.description}
                            </p>
                            {it.createdBy && (
                              <p className="mt-2 text-xs text-dark/60 dark:text-white/70">
                                <span className="font-semibold">
                                  Segnalato da:
                                </span>{" "}
                                {it.createdBy.name || it.createdBy.email}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5">
                            {/* Dropdown status con Select globale */}
                            <StatusDropdown
                              value={it.status}
                              disabled={busy}
                              onChange={(newStatus) =>
                                handleStatusChange(it, newStatus)
                              }
                            />

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDelete(it)}
                              className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                              {deletingId === it.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------- STATUS DROPDOWN ---------------------- */

type StatusDropdownProps = {
  value: DevItemStatus;
  disabled?: boolean;
  onChange: (value: DevItemStatus) => void;
};

function StatusDropdown({ value, disabled, onChange }: StatusDropdownProps) {
  const label = STATUS_LABEL[value];

  // versione disabilitata: pill statica
  if (disabled) {
    return (
      <div className="flex w-36 items-center justify-between rounded-md border border-stroke bg-transparent px-3 py-1.5 text-xs text-dark opacity-60 dark:border-dark-3 dark:text-white">
        <span>{label}</span>
        <span className="ml-1 text-xs">▾</span>
      </div>
    );
  }

  // versione interattiva con Select globale
  return (
    <div className="w-36 text-xs">
      <Select
        value={value}
        onChange={(v) => onChange(v as DevItemStatus)}
        options={STATUS_OPTIONS}
      />
    </div>
  );
}
