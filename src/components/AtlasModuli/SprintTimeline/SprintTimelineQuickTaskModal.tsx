"use client";

import React, { useEffect, useState } from "react";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";

export type SprintTimelineQuickTaskPayload = {
  title: string;
  description: string;
};

export function SprintTimelineQuickTaskModal({
                                               open,
                                               onClose,
                                               onSave,
                                             }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SprintTimelineQuickTaskPayload) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
  }, [open]);

  return (
    <SprintTimelineModalShell
      open={open}
  onClose={onClose}
  title="Nuovo task"
  subtitle="Inserimento rapido nel backlog. Solo titolo e descrizione."
  maxWidth="max-w-2xl"
  footer={
    <div className="flex items-center justify-end gap-2">
  <button
    type="button"
  className="rounded-xl border border-stroke bg-white/70 px-4 py-2 text-sm text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/60 dark:text-white"
  onClick={onClose}
    >
    Annulla
    </button>

    <button
  type="button"
  className="rounded-xl border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
  disabled={!title.trim()}
  onClick={() => {
    onSave({
      title: title.trim(),
      description: description.trim(),
    });
    onClose();
  }}
>
  Crea nel backlog
  </button>
  </div>
}
>
  <div className="space-y-5">
  <Field label="Titolo task">
  <input
    value={title}
  onChange={(event) => setTitle(event.target.value)}
  placeholder="Es. Conferma ordine ACME"
  className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
    />
    </Field>

    <Field label="Descrizione">
  <textarea
    value={description}
  onChange={(event) => setDescription(event.target.value)}
  rows={5}
  placeholder="Contesto del task, obiettivo, dettaglio utile..."
  className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
    />
    </Field>
    </div>
    </SprintTimelineModalShell>
);
}

function Field({
                 label,
                 children,
               }: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
      {label}
      </div>
  {children}
  </label>
);
}