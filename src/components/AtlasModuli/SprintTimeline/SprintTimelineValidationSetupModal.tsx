"use client";

import React, { useEffect, useState } from "react";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";
import { SprintTimelineParticipantSelector } from "./SprintTimelineParticipantSelector";
import type { SprintTimelineParticipantReference } from "./SprintTimeline.types";

export function SprintTimelineValidationSetupModal({
                                                     open,
                                                     onClose,
                                                     onSave,
                                                     title,
                                                     subtitle,
                                                   }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /**
   * validators: ID anagrafiche evolver (nuovo campo strutturato)
   * validatorNames: array nomi (DEPRECATO – compat. layer, popolato uguale a validators per ora)
   * note: testo libero
   */
  onSave: (payload: { validators: SprintTimelineParticipantReference[]; note: string }) => void;
}) {
  const [participants, setParticipants] = useState<SprintTimelineParticipantReference[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setParticipants([]);
    setNote("");
  }, [open]);

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title={title || "Configura richiesta validazione"}
      subtitle={subtitle || "Definisci chi può approvare o respingere questa validazione."}
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
            disabled={participants.length === 0}
            className="rounded-xl border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
            onClick={() => {
              onSave({
                validators: participants,
                note: note.trim(),
              });
              onClose();
            }}
          >
            Salva validatori
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <SprintTimelineParticipantSelector
          value={participants}
          onChange={setParticipants}
          title="Chi deve approvare"
          selectedListTitle="Validatori selezionati"
        />

        <Field label="Richiesta / contesto">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Descrivi cosa devono approvare..."
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