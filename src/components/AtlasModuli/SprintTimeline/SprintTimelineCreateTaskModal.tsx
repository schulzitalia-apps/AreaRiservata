"use client";

import React, { useEffect, useMemo, useState } from "react";
import Select from "@/components/ui/select";
import {
  AnagraficaReferenceInput,
  AnagraficaReferenceMultiInput,
} from "@/components/AtlasModuli/common/AnagraficaReferenceInput";
import type {
  SprintTaskPriority,
  SprintTaskType,
  SprintTimelineCreateTaskPayload,
  SprintTimelineMilestoneDraft,
  SprintTimelineParticipantReference,
  SprintTimelineSegment,
} from "./SprintTimeline.types";
import {
  buildDateInputMeta,
  formatDateOnly,
  getDateInputMin,
  getIsoDateForUnitIndex,
  getUnitIndexForIsoDate,
  TASK_TYPE_OPTIONS,
} from "./SprintTimeline.helpers";
import { SprintTimelineModalShell } from "./SprintTimelineModalShell";
import { SprintTimelineParticipantSelector } from "./SprintTimelineParticipantSelector";

type MilestoneFormState = {
  id: string;
  eventId?: string;
  title: string;
  isoDate: string;
  note: string;
  participants: SprintTimelineParticipantReference[];
  checklistText: string;
};

export type InitialValues = {
  /** If set, modal is in edit mode */
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  objectives?: string;
  /** @deprecated Usare ownerId */
  ownerName?: string;
  ownerId?: string;
  referenteId?: string;
  taskType?: SprintTaskType;
  priority?: SprintTaskPriority;
  plannedStartIndex?: number;
  expectedEndIndex?: number;
  milestones?: SprintTimelineMilestoneDraft[];
};

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDaysIso(isoDate: string, days: number) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function clampIsoDate(isoDate: string, min: string, max: string) {
  if (!isoDate) return min;
  if (isoDate < min) return min;
  if (isoDate > max) return max;
  return isoDate;
}

function parseCommaText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseChecklistText(value: string): string[] {
  return value
    .split("\n")
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

export function SprintTimelineCreateTaskModal({
                                                open,
                                                onClose,
                                                onSave,
                                                onDelete,
                                                sprintStartDate,
                                                sprintEndDate,
                                                totalUnits,
                                                existingOwners,
                                                segments,
                                                initialValues,
                                                expectedEndMaxDate,
                                                titleOverride,
                                                subtitleOverride,
                                                saveLabel,
                                              }: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SprintTimelineCreateTaskPayload) => void;
  onDelete?: () => void;
  sprintStartDate?: string;
  sprintEndDate?: string;
  totalUnits: number;
  existingOwners?: string[];
  initialValues?: InitialValues;
  expectedEndMaxDate?: string;
  segments?: SprintTimelineSegment[];
  titleOverride?: string;
  subtitleOverride?: string;
  saveLabel?: string;
}) {
  const minDate = useMemo(
    () => getDateInputMin(sprintStartDate, sprintEndDate),
    [sprintStartDate, sprintEndDate],
  );

  const plannedStartMaxDate = useMemo(
    () =>
      sprintEndDate?.slice(0, 10) ||
      getIsoDateForUnitIndex(sprintStartDate, Math.max(0, totalUnits - 1)),
    [sprintEndDate, sprintStartDate, totalUnits],
  );

  const expectedDateMax = useMemo(
    () =>
      expectedEndMaxDate?.slice(0, 10) ||
      sprintEndDate?.slice(0, 10) ||
      getIsoDateForUnitIndex(sprintStartDate, Math.max(0, totalUnits - 1)),
    [expectedEndMaxDate, sprintEndDate, sprintStartDate, totalUnits],
  );

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [referenteId, setReferenteId] = useState("");
  const [taskType, setTaskType] = useState<SprintTaskType>("operations");
  const [priority, setPriority] = useState<SprintTaskPriority>("medium");
  const [plannedStartDate, setPlannedStartDate] = useState(minDate);
  const [expectedEndDate, setExpectedEndDate] = useState(
    clampIsoDate(addDaysIso(minDate, 7), minDate, expectedDateMax),
  );
  const [milestones, setMilestones] = useState<MilestoneFormState[]>([]);

  useEffect(() => {
    if (!open) return;

    const defaultStart = clampIsoDate(minDate, minDate, plannedStartMaxDate);
    const defaultEnd = clampIsoDate(addDaysIso(defaultStart, 7), defaultStart, expectedDateMax);

    setTitle(initialValues?.title ?? "");
    setSubtitle(initialValues?.subtitle ?? "");
    setDescription(initialValues?.description ?? "");
    setObjectives(initialValues?.objectives ?? "");
    setOwnerId(initialValues?.ownerId ?? "");
    setReferenteId(initialValues?.referenteId ?? "");
    setTaskType(initialValues?.taskType ?? "operations");
    setPriority(initialValues?.priority ?? "medium");

    const initialStart = initialValues?.plannedStartIndex !== undefined 
      ? (getIsoDateForUnitIndex(sprintStartDate, initialValues.plannedStartIndex) || defaultStart)
      : defaultStart;
    
    const initialEnd = initialValues?.expectedEndIndex !== undefined
      ? (getIsoDateForUnitIndex(sprintStartDate, initialValues.expectedEndIndex) || defaultEnd)
      : defaultEnd;

    setPlannedStartDate(initialStart);
    setExpectedEndDate(initialEnd);
    
    if (initialValues?.milestones?.length) {
      setMilestones(
        initialValues.milestones.map((m) => ({
          id: makeLocalId(),
          eventId: m.eventId,
          title: m.title,
          isoDate: getIsoDateForUnitIndex(sprintStartDate, m.unitIndex) || defaultStart,
          note: m.note || "",
          participants: m.participants || [],
          checklistText: (m.checklistItems || []).join("\n"),
        }))
      );
    } else {
      setMilestones([]);
    }
  }, [
    open,
    existingOwners,
    minDate,
    plannedStartMaxDate,
    expectedDateMax,
    initialValues,
  ]);

  const isEdit = !!initialValues?.id;

  const ownerSuggestions = useMemo(
    () => Array.from(new Set(existingOwners ?? [])),
    [existingOwners],
  );

  const normalizedMilestones = useMemo<SprintTimelineMilestoneDraft[]>(() => {
    return milestones
      .map((milestone) => ({
        eventId: milestone.eventId,
        title: milestone.title.trim(),
        unitIndex: getUnitIndexForIsoDate(sprintStartDate, milestone.isoDate),
        note: milestone.note.trim() || undefined,
        participants: milestone.participants,
        checklistItems: parseChecklistText(milestone.checklistText),
      }))
      .filter((milestone) => milestone.title);
  }, [milestones, sprintStartDate]);

  const plannedStartIndex = getUnitIndexForIsoDate(sprintStartDate, plannedStartDate);
  const expectedEndIndex = getUnitIndexForIsoDate(sprintStartDate, expectedEndDate);

  const taskTypeOptions = useMemo(
    () =>
      TASK_TYPE_OPTIONS.filter((option) => option.value).map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );

  const priorityOptions = useMemo(
    () => [
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
    [],
  );

  return (
    <SprintTimelineModalShell
      open={open}
      onClose={onClose}
      title={titleOverride || (isEdit ? "Gestione Task" : "Nuovo task")}
      subtitle={
        subtitleOverride ||
        (isEdit
          ? "Modifica i riferimenti o le impostazioni del task corrente."
          : "Start e checkpoint dentro lo sprint; la chiusura attesa può estendersi anche agli sprint successivi.")
      }
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isEdit && (
              <button
                type="button"
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-400"
                onClick={() => {
                  if (confirm("Sei sicuro di voler eliminare questo task e tutti i suoi eventi?")) {
                    onDelete?.();
                    onClose();
                  }
                }}
              >
                Elimina Task
              </button>
            )}
            <div className="text-xs text-dark/60 dark:text-white/60">
              {isEdit 
                ? "Salva per applicare le modifiche ai metadati."
                : "La chiusura attesa viene salvata come evento dedicato e le milestone nascono come checkpoint."
              }
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => {
                onSave({
                  title,
                  subtitle,
                  description,
                  objectives,
                  ownerId,
                  ownerName: undefined,
                  referenteId,
                  referenteName: undefined,
                  taskType,
                  priority,
                  plannedStartIndex,
                  expectedEndIndex,
                  milestones: normalizedMilestones,
                });
                onClose();
              }}
              disabled={!title.trim()}
            >
              {saveLabel || (isEdit ? "Salva modifiche" : "Crea task")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Field label="Titolo task">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Es. Conferma ordine ACME"
                className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              />
            </Field>

            <Field label="Sottotitolo">
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="Es. Preparazione documenti e controllo finale"
                className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              />
            </Field>

            <Field label="Descrizione">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Contesto del task, materiali da usare, scopo..."
                className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              />
            </Field>

            <Field label="Obiettivi">
              <textarea
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                rows={4}
                placeholder="Risultato finale, outcome atteso, definition of done..."
                className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
              />
            </Field>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AnagraficaReferenceInput
                label="Proprietario / Owner"
                value={ownerId}
                onChange={setOwnerId}
                config={{ targetSlug: "evolver", previewField: "nomeEvolver" }}
                placeholder="Cerca proprietario…"
              />

              <AnagraficaReferenceInput
                label="Revisore / Referente interno"
                value={referenteId}
                onChange={setReferenteId}
                config={{ targetSlug: "evolver", previewField: "nomeEvolver" }}
                placeholder="Cerca revisore…"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Tipo task">
                <Select
                  value={taskType}
                  onChange={(value) => setTaskType(value as SprintTaskType)}
                  options={taskTypeOptions}
                  placeholder="Tipo task"
                />
              </Field>

              <Field label="Priorità">
                <Select
                  value={priority}
                  onChange={(value) => setPriority(value as SprintTaskPriority)}
                  options={priorityOptions}
                  placeholder="Priorità"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Start task">
                <input
                  type="date"
                  value={plannedStartDate}
                  min={minDate}
                  max={plannedStartMaxDate}
                  onChange={(event) => {
                    const next = clampIsoDate(event.target.value, minDate, plannedStartMaxDate);
                    setPlannedStartDate(next);
                    setExpectedEndDate((current) => (current < next ? next : current));
                  }}
                  className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                />
                <DateMeta
                  isoDate={plannedStartDate}
                  sprintStartDate={sprintStartDate}
                  segments={segments}
                />
              </Field>

              <Field label="Chiusura attesa">
                <input
                  type="date"
                  value={expectedEndDate}
                  min={plannedStartDate}
                  max={expectedDateMax}
                  onChange={(event) =>
                    setExpectedEndDate(
                      clampIsoDate(event.target.value, plannedStartDate, expectedDateMax),
                    )
                  }
                  className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                />
                <DateMeta
                  isoDate={expectedEndDate}
                  sprintStartDate={sprintStartDate}
                  segments={segments}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] p-4">
              <div className="text-sm font-semibold text-dark dark:text-white">Preview task</div>
              <div className="mt-2 text-sm text-dark/70 dark:text-white/70">
                Parte il <span className="font-semibold">{formatDateOnly(plannedStartDate)}</span>{" "}
                e punta a chiudersi entro{" "}
                <span className="font-semibold">{formatDateOnly(expectedEndDate)}</span>.
              </div>
              <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
                Start index {plannedStartIndex} · End index {expectedEndIndex}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-primary/15 bg-primary/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-dark dark:text-white">
                Milestone future / checkpoint gialli
              </div>
              <div className="mt-1 text-sm text-dark/65 dark:text-white/65">
                Parti da zero e aggiungile solo se servono. Puoi anche rimuoverle tutte.
              </div>
            </div>

            <button
              type="button"
              className="rounded-xl border border-primary/20 bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              onClick={() =>
                setMilestones((current) => [
                  ...current,
                  {
                    id: makeLocalId(),
                    title: "",
                    isoDate: plannedStartDate,
                    note: "",
                    participants: [],
                    checklistText: "",
                  },
                ])
              }
            >
              + Aggiungi milestone
            </button>
          </div>

          {milestones.length === 0 ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-primary/30 bg-white/40 px-4 py-6 text-sm text-dark/60 dark:bg-gray-dark/20 dark:text-white/60">
              Nessuna milestone aggiunta.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className="rounded-[22px] border border-stroke bg-white/70 p-4 dark:border-dark-3 dark:bg-gray-dark/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-dark dark:text-white">
                      Milestone {index + 1}
                    </div>

                    <button
                      type="button"
                      className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/15 dark:text-rose-300"
                      onClick={() =>
                        setMilestones((current) =>
                          current.filter((item) => item.id !== milestone.id),
                        )
                      }
                    >
                      Rimuovi
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_220px]">
                    <Field label="Titolo checkpoint">
                      <input
                        value={milestone.title}
                        onChange={(event) =>
                          setMilestones((current) =>
                            current.map((item) =>
                              item.id === milestone.id
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Es. Validazione cliente"
                        className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                      />
                    </Field>

                    <Field label="Data checkpoint">
                      <input
                        type="date"
                        value={milestone.isoDate}
                        min={minDate}
                        max={plannedStartMaxDate}
                        onChange={(event) =>
                          setMilestones((current) =>
                            current.map((item) =>
                              item.id === milestone.id
                                ? {
                                  ...item,
                                  isoDate: clampIsoDate(
                                    event.target.value,
                                    minDate,
                                    plannedStartMaxDate,
                                  ),
                                }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                      />
                      <DateMeta
                        isoDate={milestone.isoDate}
                        sprintStartDate={sprintStartDate}
                        segments={segments}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                    <SprintTimelineParticipantSelector
                      title="Partecipanti milestone"
                      value={milestone.participants}
                      onChange={(nextParticipants) =>
                        setMilestones((current) =>
                          current.map((item) =>
                            item.id === milestone.id
                              ? { ...item, participants: nextParticipants }
                              : item,
                          ),
                        )
                      }
                    />

                    <Field label="Nota milestone">
                      <input
                        value={milestone.note}
                        onChange={(event) =>
                          setMilestones((current) =>
                            current.map((item) =>
                              item.id === milestone.id
                                ? { ...item, note: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Dettaglio da tenere a mente"
                        className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Checklist milestone">
                      <textarea
                        value={milestone.checklistText}
                        onChange={(event) =>
                          setMilestones((current) =>
                            current.map((item) =>
                              item.id === milestone.id
                                ? { ...item, checklistText: event.target.value }
                                : item,
                            ),
                          )
                        }
                        rows={4}
                        placeholder={"Prepara documenti\nConferma cliente\nInvia allegato finale"}
                        className="w-full rounded-2xl border border-stroke bg-white/70 px-3 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}
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

