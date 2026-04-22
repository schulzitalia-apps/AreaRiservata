"use client";

import React, { useEffect, useMemo, useState } from "react";
import Select from "@/components/ui/select";
import { AnagraficaReferenceMultiInput } from "@/components/AtlasModuli/common/AnagraficaReferenceInput";
import type {
  SprintTimelineCreateEventPayload,
  SprintTimelineLane,
  SprintTimelineParticipantReference,
  SprintTimelineSegment,
} from "./SprintTimeline.types";
import {
  buildDateInputMeta,
  formatDateOnly,
  getDateInputMin,
  getLaneChainEvents,
  getUnitIndexForIsoDate,
} from "./SprintTimeline.helpers";
import {
  canCreateLaneNote,
  canManageCheckpoint,
  type SprintTimelineViewer,
} from "./permissions";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";
import { SprintTimelineParticipantSelector } from "./SprintTimelineParticipantSelector";

const BASE_CREATE_EVENT_OPTIONS: Array<{
  value: SprintTimelineCreateEventPayload["kind"];
  label: string;
  hint: string;
}> = [
  {
    value: "note",
    label: "Nota",
    hint: "Punto informativo libero. Tutti possono inserirla.",
  },
  {
    value: "checkpoint",
    label: "Checkpoint giallo",
    hint: "Owner o reviewer possono crearlo. Poi agiranno solo i partecipanti.",
  },
  {
    value: "task-block",
    label: "Blocco task",
    hint: "Owner o reviewer possono crearlo. Poi agiranno solo i partecipanti. Puoi assegnare chi lo potrà sbloccare.",
  },
];

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function DateMeta({
                    isoDate,
                    sprintStartDate,
                    segments,
                  }: {
  isoDate: string;
  sprintStartDate?: string;
  segments?: SprintTimelineSegment[];
}) {
  const meta = buildDateInputMeta({ isoDate, sprintStartDate, segments });
  return (
    <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
      Giorno scelto: <span className="font-semibold">{formatDateOnly(isoDate)}</span>
      {" · "}
      Sprint: <span className="font-semibold">{meta.segmentLabel}</span>
      {" · "}
      Indice timeline: <span className="font-semibold">{meta.unitIndex}</span>
    </div>
  );
}

export function SprintTimelineEventModal({
                                           open,
                                           onClose,
                                           onSave,
                                           lane,
                                           sprintStartDate,
                                           sprintEndDate,
                                           segments,
                                           initialUnitIndex,
                                           currentUserName,
                                           currentUserId,
                                         }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SprintTimelineCreateEventPayload) => void;
  lane: SprintTimelineLane | null;
  sprintStartDate?: string;
  sprintEndDate?: string;
  segments?: SprintTimelineSegment[];
  initialUnitIndex: number;
  currentUserName?: string;
  currentUserId?: string;
}) {
  const minDate = useMemo(
    () => getDateInputMin(sprintStartDate, sprintEndDate),
    [sprintStartDate, sprintEndDate],
  );
  const maxDate = sprintEndDate?.slice(0, 10) || minDate;

  const [kind, setKind] = useState<SprintTimelineCreateEventPayload["kind"]>("note");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [participants, setParticipants] = useState<SprintTimelineParticipantReference[]>([]);
  const [checklistText, setChecklistText] = useState("");
  const [isoDate, setIsoDate] = useState(minDate);
  const viewer = useMemo<SprintTimelineViewer>(() => ({
    userId: currentUserId,
    userName: currentUserName,
  }), [currentUserId, currentUserName]);

  const availableOptions = useMemo(() => {
    if (!lane) return BASE_CREATE_EVENT_OPTIONS;
    const canCreateNotes = canCreateLaneNote(lane, viewer);
    const canCreateManaged = canManageCheckpoint(lane, viewer);
    return BASE_CREATE_EVENT_OPTIONS.filter((item) => {
      if (item.value === "note") return canCreateNotes;
      if (item.value === "checkpoint" || item.value === "task-block") return canCreateManaged;
      return true;
    });
  }, [lane, viewer]);

  useEffect(() => {
    if (!open) return;
    const initialDate = new Date(`${sprintStartDate?.slice(0, 10) || minDate}T00:00:00`);
    initialDate.setDate(initialDate.getDate() + initialUnitIndex);
    const nextDate = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(
      initialDate.getDate(),
    ).padStart(2, "0")}`;

    setKind(availableOptions[0]?.value || "note");
    setTitle("");
    setNote("");
    setParticipants([]);
    setChecklistText("");
    setIsoDate(nextDate < minDate ? minDate : nextDate > maxDate ? maxDate : nextDate);
  }, [open, lane?.id, initialUnitIndex, sprintStartDate, minDate, maxDate, availableOptions]);

  const chainSummary = useMemo(() => {
    if (!lane) return [];
    return lane.events
      .filter((event) => event.kind === "checkpoint")
      .map((event) => {
        const chainEvents = getLaneChainEvents(lane, event.chainId || event.id);
        return {
          id: event.chainId || event.id,
          title: event.title,
          steps: chainEvents.length,
        };
      });
  }, [lane]);

  const selectedOption = availableOptions.find((option) => option.value === kind);
  const unitIndex = getUnitIndexForIsoDate(sprintStartDate, isoDate);
  const titleFieldLabel =
    kind === "checkpoint"
      ? "Nome checkpoint"
      : kind === "task-block"
        ? "Nome blocco"
        : "Titolo nota";

  const eventTypeOptions = useMemo(
    () =>
      availableOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [availableOptions],
  );

  if (!lane) return null;

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title="Nuovo evento"
      subtitle={`${lane.title} • form pulito e permessi coerenti`}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
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
                laneId: lane.id,
                kind,
                title,
                note,
                unitIndex,
                date: isoDate, // Forziamo il passaggio della data ISO esatta
                participants,
                checklistItems: splitLines(checklistText),
              });
              onClose();
            }}
          >
            Salva evento
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Field label="Tipo evento">
            <Select
              value={kind}
              onChange={(value) =>
                setKind(value as SprintTimelineCreateEventPayload["kind"])
              }
              options={eventTypeOptions}
              placeholder="Tipo evento"
            />
            <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
              {selectedOption?.hint}
            </div>
          </Field>

          <Field label="Data evento">
            <input
              type="date"
              value={isoDate}
              min={minDate}
              max={maxDate}
              onChange={(event) => setIsoDate(event.target.value)}
              className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
            />
            <DateMeta isoDate={isoDate} sprintStartDate={sprintStartDate} segments={segments} />
          </Field>
        </div>

        <Field label={titleFieldLabel}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={selectedOption?.label || "Titolo evento"}
            className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
          />
          <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
            Titolo normalizzato automaticamente come `Titolo task | Tipo evento | Nome / esito`.
          </div>
        </Field>

        <Field label="Nota / dettaglio">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Dettaglio operativo..."
            className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
          />
        </Field>

        {kind === "checkpoint" || kind === "task-block" ? (
          <div className="space-y-4">
            <SprintTimelineParticipantSelector
              value={participants}
              onChange={setParticipants}
              title={kind === "task-block" ? "Chi può sbloccare" : "Partecipanti checkpoint"}
            />

            <Field label={kind === "task-block" ? "Checklist sblocco" : "Checklist operativa"}>
              <textarea
                value={checklistText}
                onChange={(event) => setChecklistText(event.target.value)}
                rows={5}
                placeholder={"Verifica documento\nRichiama cliente\nConferma allegato"}
                className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              />
            </Field>
          </div>
        ) : null}

        <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] p-4">
          <div className="text-sm font-semibold text-dark dark:text-white">Catene checkpoint già presenti</div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {chainSummary.length ? (
              chainSummary.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stroke bg-white/70 px-3 py-3 text-sm dark:border-dark-3 dark:bg-gray-dark/40"
                >
                  <div className="font-semibold text-dark dark:text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                    Evoluzioni collegate: {item.steps}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-dark/60 dark:text-white/60">
                Nessun checkpoint ancora presente.
              </div>
            )}
          </div>
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

