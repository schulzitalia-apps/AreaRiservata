"use client";

import React, { useEffect, useState } from "react";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";

export function SprintTimelineValidationDecisionModal({
                                                        open,
                                                        outcome,
                                                        onClose,
                                                        onSave,
                                                      }: {
  open: boolean;
  outcome: "approved" | "rejected";
  onClose: () => void;
  onSave: (payload: { decisionNote: string }) => void;
}) {
  const [decisionNote, setDecisionNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setDecisionNote("");
  }, [open, outcome]);

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title={outcome === "approved" ? "Motiva approvazione" : "Motiva respinta"}
      subtitle="La decisione è definitiva e non potrà più essere modificata."
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
            disabled={!decisionNote.trim()}
            className="rounded-xl border border-primary/20 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
            onClick={() => {
              onSave({ decisionNote: decisionNote.trim() });
              onClose();
            }}
          >
            Conferma decisione
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Motivazione">
          <textarea
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            rows={6}
            placeholder={
              outcome === "approved"
                ? "Spiega perché la validazione è approvata..."
                : "Spiega perché la validazione è respinta..."
            }
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