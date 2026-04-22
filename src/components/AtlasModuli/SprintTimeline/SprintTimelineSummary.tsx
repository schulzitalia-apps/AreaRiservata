"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import {
  SprintTimelineBoardData,
  TimelineSemaforo
} from "./SprintTimeline.types";
import {
  deriveLaneState,
  getSemaforoDotClasses,
  getSemaforoSurfaceClasses,
  getCheckpointChainStatus,
  getEventChainId,
  isOperationalCheckpoint
} from "./SprintTimeline.helpers";
import {
  isTaskOwner,
  isTaskReferente,
  someParticipantMatchesViewer
} from "./permissions";

interface SummaryStats {
  ownedTasks: number;
  startedTasks: number;
  completedTasks: number;
  activeBlocks: number;
  pendingValidations: number;
  activeCheckpoints: number;
  doneCheckpoints: number;
  totalCheckpoints: number;
  pendingChecklistItems: number;
  delayedTasks: number;
}

export function SprintTimelineSummary({
                                        data,
                                        currentUserId,
                                        currentUserName,
                                        mode = "personal",
                                      }: {
  data: SprintTimelineBoardData;
  currentUserId?: string;
  currentUserName?: string;
  mode?: "personal" | "global";
}) {
  const viewer = useMemo(() => ({
    userId: currentUserId,
    userName: currentUserName
  }), [currentUserId, currentUserName]);

  const stats = useMemo<SummaryStats>(() => {
    let ownedTasks = 0;
    let startedTasks = 0;
    let completedTasks = 0;
    let activeBlocks = 0;
    let pendingValidations = 0;
    let activeCheckpoints = 0;
    let totalCheckpoints = 0;
    let doneCheckpoints = 0;
    let delayedTasks = 0;

    const isGlobal = mode === "global";
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    data.lanes.forEach(lane => {
      const isOwner = isTaskOwner(lane, viewer);
      const isReferente = isTaskReferente(lane, viewer);
      const isParticipant = lane.events.some(
        (event) =>
          someParticipantMatchesViewer(event.participants, viewer) ||
          someParticipantMatchesViewer(event.validators, viewer),
      );
      const isRelevantLane = isGlobal || isOwner || isReferente || isParticipant;
      const derived = deriveLaneState(lane, Number.MAX_SAFE_INTEGER, viewer);

      if (!isRelevantLane) return;

      if (isGlobal || isOwner || isReferente) {
        ownedTasks++;
      }

      if (lane.events.some((event) => event.kind === "start" || event.kind === "reopen")) {
        startedTasks++;
      }

      if (lane.actualEnd || lane.events.some((event) => event.kind === "completion")) {
        completedTasks++;
      }

      if (lane.expectedEnd && !lane.actualEnd && lane.expectedEnd < today) {
        delayedTasks++;
      }

      if (lane.events.some((event) => event.kind === "validation" && event.validationState === "requested")) {
        pendingValidations++;
      }

      if (derived.blockedCheckpointCount > 0 || lane.events.some((event) => event.kind === "task-block")) {
        activeBlocks +=
          derived.blockedCheckpointCount +
          lane.events.filter((event) => event.kind === "task-block").length;
      }

      lane.events
        .filter((event) => isOperationalCheckpoint(event))
        .forEach((event) => {
          const chainId = getEventChainId(event);
          const status = getCheckpointChainStatus(lane, chainId);
          totalCheckpoints++;

          if (status === "open") {
            activeCheckpoints++;
          } else if (status === "completed") {
            doneCheckpoints++;
          }
        });
    });

    return {
      ownedTasks,
      startedTasks,
      completedTasks,
      activeBlocks,
      pendingValidations,
      activeCheckpoints,
      pendingChecklistItems: 0, // Deprecato
      doneCheckpoints,
      totalCheckpoints,
      delayedTasks
    };
  }, [data, viewer, mode]);

  const isGlobal = mode === "global";

  const sprintCountdown = useMemo(() => {
    const sprintEnd = data.sprint.endDate?.slice(0, 10);
    if (!sprintEnd) return null;

    const now = new Date();
    const today = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}T00:00:00`);
    const end = new Date(`${sprintEnd}T00:00:00`);
    const diffDays = Math.floor((end.getTime() - today.getTime()) / 86400000);

    if (diffDays > 1) {
      return {
        tone: "emerald",
        title: `Sprint in corsa: mancano ${diffDays} giorni`,
        subtitle: "Ottimo momento per chiudere gli ultimi checkpoint con calma e ordine.",
      };
    }

    if (diffDays === 1) {
      return {
        tone: "amber",
        title: "Ultimo miglio: manca 1 giorno alla fine dello sprint",
        subtitle: "Teniamo alta l'attenzione su validazioni, blocchi e chiusure finali.",
      };
    }

    if (diffDays === 0) {
      return {
        tone: "orange",
        title: "Sprint in chiusura oggi",
        subtitle: "Giornata perfetta per stringere il cerchio su checkpoint e validazioni.",
      };
    }

    return {
      tone: "rose",
      title: `Sprint oltre la fine da ${Math.abs(diffDays)} giorni`,
      subtitle: "Conviene ripulire le code aperte e riallineare subito le priorita operative.",
    };
  }, [data.sprint.endDate]);

  if (!currentUserId && mode !== "global") return null;

  return (
    <div className="mb-6 space-y-4">
      {sprintCountdown ? (
        <div
          className={clsx(
            "overflow-hidden rounded-[24px] border px-4 py-3 shadow-sm backdrop-blur",
            sprintCountdown.tone === "emerald" &&
            "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            sprintCountdown.tone === "amber" &&
            "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            sprintCountdown.tone === "orange" &&
            "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
            sprintCountdown.tone === "rose" &&
            "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
          )}
        >
          <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">
            Sprint countdown
          </div>
          <div className="mt-1 text-sm font-semibold">{sprintCountdown.title}</div>
          <div className="mt-1 text-xs opacity-80">{sprintCountdown.subtitle}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        <SummaryCard
          label={isGlobal ? "Totale Task" : "I miei Task"}
          value={stats.ownedTasks.toString()}
          tone="blue"
          subLabel={isGlobal ? "Task presenti nello sprint" : "Task dove sei owner o reviewer"}
        />
        <SummaryCard
          label="Avviati"
          value={stats.startedTasks.toString()}
          tone="blue"
          subLabel={isGlobal ? "Task con almeno un nodo blu" : "Task gia partiti nel tuo perimetro"}
        />
        <SummaryCard
          label="Blocchi"
          value={stats.activeBlocks.toString()}
          tone="red"
          subLabel={isGlobal ? "Task / checkpoint bloccati" : "Richiesto il tuo intervento"}
        />
        <SummaryCard
          label="Validazioni"
          value={stats.pendingValidations.toString()}
          tone="purple"
          subLabel={isGlobal ? "Attesa verifica finale" : "In attesa di verifica"}
        />
        <SummaryCard
          label="Checkpoint aperti"
          value={stats.activeCheckpoints.toString()}
          tone="yellow"
          subLabel={isGlobal ? "Checkpoint ancora da lavorare" : "Attivita operative ancora aperte"}
        />
        <SummaryCard
          label="Progresso checkpoint"
          value={`${stats.doneCheckpoints}/${stats.totalCheckpoints}`}
          tone="teal"
          subLabel={isGlobal ? "Completati sul totale" : "Checkpoint completati sul totale"}
        />
        <SummaryCard
          label="Chiusi"
          value={stats.completedTasks.toString()}
          tone="green"
          subLabel={isGlobal ? "Task chiusi con successo" : "Task completati nel tuo perimetro"}
        />
        <SummaryCard
          label="In Ritardo"
          value={stats.delayedTasks.toString()}
          tone="orange"
          subLabel={isGlobal ? "Consegne superate" : "Scadenza superata"}
        />
      </div>
    </div>
  );
}

function SummaryCard({
                       label,
                       value,
                       tone,
                       subLabel
                     }: {
  label: string;
  value: string;
  tone: TimelineSemaforo;
  subLabel?: string;
}) {
  return (
    <div className={clsx(
      "group relative overflow-hidden rounded-[24px] border border-primary/10 p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:border-white/10",
      "bg-white/80 backdrop-blur dark:bg-gray-dark/40",
    )}>
      <div className="flex items-center gap-2">
        <span className={clsx("h-2 w-2 rounded-full", getSemaforoDotClasses(tone))} />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-dark/45 dark:text-white/45">
          {label}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-black text-dark dark:text-white">
          {value}
        </span>
      </div>

      {subLabel && (
        <div className="mt-1 text-[10px] text-dark/40 dark:text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
          {subLabel}
        </div>
      )}

      <div className={clsx(
        "absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
        getSemaforoSurfaceClasses(tone)
      )} />
    </div>
  );
}