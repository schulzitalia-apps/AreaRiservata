import type {
  SprintTaskPriority,
  TimelineSemaforo,
} from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";
import type { SprintTimelineTaskSnapshot } from "./sprintTimeline.types";

function priorityRank(priority: SprintTaskPriority) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
    default:
      return 3;
  }
}

function signalRank(signal: TimelineSemaforo) {
  switch (signal) {
    case "red":
      return 0;
    case "purple":
      return 1;
    case "yellow":
      return 2;
    case "orange":
      return 3;
    case "blue":
      return 4;
    case "teal":
      return 5;
    case "gray":
      return 6;
    case "green":
    default:
      return 7;
  }
}

function dueBucket(daysRemaining: number | null) {
  if (daysRemaining === null) return 5;
  if (daysRemaining < 0) return 0;
  if (daysRemaining === 0) return 1;
  if (daysRemaining <= 2) return 2;
  if (daysRemaining <= 5) return 3;
  return 4;
}

function describeDueReason(daysRemaining: number | null) {
  if (daysRemaining === null) return null;
  if (daysRemaining < 0) return `e gia oltre il target da ${Math.abs(daysRemaining)}g`;
  if (daysRemaining === 0) return "scade oggi";
  if (daysRemaining === 1) return "scade domani";
  return `scade tra ${daysRemaining}g`;
}

function describePriorityReason(priority: SprintTaskPriority) {
  switch (priority) {
    case "urgent":
      return "ha priorita urgente";
    case "high":
      return "ha priorita alta";
    case "medium":
      return "ha priorita media";
    case "low":
    default:
      return "ha priorita bassa";
  }
}

function describeSignalReason(signal: TimelineSemaforo) {
  switch (signal) {
    case "red":
      return "e bloccato";
    case "purple":
      return "e in validazione";
    case "yellow":
      return "e gia operativo";
    case "orange":
      return "e vicino o oltre la scadenza";
    case "blue":
      return "e gia avviato";
    default:
      return null;
  }
}

function computeSchedulerScore(task: SprintTimelineTaskSnapshot) {
  let score = 0;

  if (task.viewerNeedsToAct) score -= 120;
  score += dueBucket(task.daysRemaining) * 24;
  score += priorityRank(task.priority) * 18;
  score += signalRank(task.signal) * 8;
  score += task.daysRemaining === null ? 20 : Math.max(-5, Math.min(task.daysRemaining, 21));

  return score;
}

function buildSchedulerReason(task: SprintTimelineTaskSnapshot) {
  const reasons = [
    task.viewerNeedsToAct ? "richiede una tua azione" : null,
    describeDueReason(task.daysRemaining),
    describePriorityReason(task.priority),
    describeSignalReason(task.signal),
    task.nextPassageLabel ? `prossimo passaggio: ${task.nextPassageLabel}` : null,
  ].filter(Boolean) as string[];

  return reasons.slice(0, 3).join(", ");
}

export function scheduleSprintTasks(tasks: SprintTimelineTaskSnapshot[]) {
  return [...tasks]
    .map((task) => {
      const schedulerScore = computeSchedulerScore(task);
      return {
        ...task,
        schedulerRank: schedulerScore,
        schedulerReason: buildSchedulerReason(task),
      };
    })
    .sort((a, b) => {
      if ((a.schedulerRank ?? 0) !== (b.schedulerRank ?? 0)) {
        return (a.schedulerRank ?? 0) - (b.schedulerRank ?? 0);
      }
      if (a.viewerNeedsToAct !== b.viewerNeedsToAct) {
        return a.viewerNeedsToAct ? -1 : 1;
      }
      const dueA = a.daysRemaining ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.daysRemaining ?? Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
      if (priorityRank(a.priority) !== priorityRank(b.priority)) {
        return priorityRank(a.priority) - priorityRank(b.priority);
      }
      if (signalRank(a.signal) !== signalRank(b.signal)) {
        return signalRank(a.signal) - signalRank(b.signal);
      }
      return a.title.localeCompare(b.title);
    });
}
