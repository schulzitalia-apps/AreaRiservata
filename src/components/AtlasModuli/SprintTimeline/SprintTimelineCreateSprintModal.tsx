"use client";

import React, { useEffect, useState } from "react";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";

export type SprintTimelineCreateSprintPayload = {
  label: string;
  description: string;
  startDate: string;
  endDate: string;
};

export function SprintTimelineCreateSprintModal({
                                                  open,
                                                  onClose,
                                                  onSave,
                                                }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SprintTimelineCreateSprintPayload) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setDescription("");
    setStartDate("");
    setEndDate("");
  }, [open]);

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title="Nuovo sprint"
      subtitle="Crea uno sprint selezionabile nella vista Scrum Master."
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
            disabled={!label.trim() || !startDate || !endDate || endDate < startDate}
            onClick={() => {
              onSave({
                label: label.trim(),
                description: description.trim(),
                startDate,
                endDate,
              });
              onClose();
            }}
          >
            Crea sprint
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Nome sprint">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Es. Sprint D"
            className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
          />
        </Field>

        <Field label="Descrizione">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Focus operativo dello sprint..."
            className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Data inizio">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
            />
          </Field>

          <Field label="Data fine">
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
            />
          </Field>
        </div>
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