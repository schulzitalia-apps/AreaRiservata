"use client";

import React, { useEffect, useState } from "react";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";
import { SprintTimelineParticipantSelector } from "./SprintTimelineParticipantSelector";
import type { SprintTimelineParticipantReference } from "./SprintTimeline.types";

export function SprintTimelineBlockSetupModal({
                                                open,
                                                onClose,
                                                onSave,
                                              }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { participants: SprintTimelineParticipantReference[]; note: string; checklistItems: string[] }) => void;
}) {
  const [participants, setParticipants] = useState<SprintTimelineParticipantReference[]>([]);
  const [note, setNote] = useState("");
  const [checklistText, setChecklistText] = useState("");

  useEffect(() => {
    if (!open) return;
    setParticipants([]);
    setNote("");
    setChecklistText("");
  }, [open]);

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title="Configura blocco rosso"
      subtitle="Definisci chi può rimuovere il blocco e, se serve, una checklist di sblocco."
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
            className="rounded-xl border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            onClick={() => {
              onSave({
                participants,
                note: note.trim(),
                checklistItems: checklistText
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              });
              onClose();
            }}
          >
            Salva blocco
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <SprintTimelineParticipantSelector
          value={participants}
          onChange={setParticipants}
          title="Chi può togliere il blocco"
          selectedListTitle="Responsabili sblocco"
        />

        <Field label="Perché è bloccato">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Descrivi il motivo del blocco e l'azione attesa per sbloccarlo..."
            className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
          />
        </Field>

        <Field label="Checklist sblocco">
          <textarea
            value={checklistText}
            onChange={(event) => setChecklistText(event.target.value)}
            rows={5}
            placeholder={"Recupera documento mancante\nVerifica conferma cliente\nRicarica allegato corretto"}
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
